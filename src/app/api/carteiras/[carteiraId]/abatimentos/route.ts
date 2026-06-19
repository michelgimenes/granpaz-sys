import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

/**
 * POST /api/carteiras/[carteiraId]/abatimentos
 * Pay a parcela using wallet balance (abatimento)
 *
 * Business rules:
 * - RN-003: If saldo_disponivel <= 0, block with SALDO_INSUFICIENTE
 * - RN-003: If saldo_disponivel < valor_parcela, allow partial abatimento
 * - RN-007: If saldo_devedor > 0, block with SALDO_DEVEDOR_EXISTENTE
 * - EC-008: Validate valor_abatido > 0
 * - EC-009: Validate conta_a_pagar status is not CANCELADO
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ carteiraId: string }> }
) {
  try {
    const { carteiraId } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    const body = await request.json()
    const { contaAPagarId, observacoes } = body

    // ─── Validate carteira exists ───
    const carteira = await db.carteiraDigital.findUnique({
      where: { id: carteiraId },
      include: { titular: { select: { id: true, nomeCompleto: true } } },
    })

    if (!carteira) {
      return NextResponse.json({ error: 'Carteira digital não encontrada.' }, { status: 404 })
    }

    // ─── Validate conta_a_pagar exists ───
    if (!contaAPagarId) {
      return NextResponse.json({ error: 'contaAPagarId é obrigatório.' }, { status: 400 })
    }

    const contaAPagar = await db.contaAPagar.findUnique({
      where: { id: contaAPagarId },
      include: {
        contrato: {
          select: { id: true, titularId: true },
        },
      },
    })

    if (!contaAPagar) {
      return NextResponse.json({ error: 'Conta a pagar não encontrada.' }, { status: 404 })
    }

    // ─── Validate conta_a_pagar belongs to same contrato as carteira's titular ───
    if (contaAPagar.contrato.titularId !== carteira.titularId) {
      return NextResponse.json({ error: 'Conta a pagar não pertence ao titular desta carteira.' }, { status: 404 })
    }

    // ─── EC-009: Validate conta_a_pagar status is not CANCELADO ───
    if (contaAPagar.status === 'CANCELADO') {
      return NextResponse.json(
        { error: 'Não é possível realizar abatimento em conta cancelada.', code: 'CONTA_CANCELADA' },
        { status: 400 }
      )
    }

    // ─── Validate conta_a_pagar is not already fully paid ───
    if (contaAPagar.status === 'PAGO') {
      return NextResponse.json(
        { error: 'Conta a pagar já está totalmente paga.' },
        { status: 400 }
      )
    }

    // ─── RN-007: Check saldo_devedor ───
    if (carteira.saldoDevedor > 0) {
      return NextResponse.json(
        {
          error: `Regularize seu saldo devedor de R$ ${carteira.saldoDevedor.toFixed(2)} antes de realizar novos saques`,
          code: 'SALDO_DEVEDOR_EXISTENTE',
          saldoDevedor: carteira.saldoDevedor,
        },
        { status: 400 }
      )
    }

    // ─── RN-003: Check saldo_disponivel ───
    if (carteira.saldoDisponivel <= 0) {
      return NextResponse.json(
        { error: 'Saldo disponível insuficiente para realizar abatimento.', code: 'SALDO_INSUFICIENTE' },
        { status: 400 }
      )
    }

    // ─── Determine valor to abate ───
    const valorRestante = contaAPagar.valorRestante
    const valorAbatido = Math.min(carteira.saldoDisponivel, valorRestante)

    // ─── EC-008: Validate valor_abatido > 0 ───
    if (valorAbatido <= 0) {
      return NextResponse.json(
        { error: 'Valor do abatimento deve ser maior que zero.', code: 'VALOR_INVALIDO' },
        { status: 400 }
      )
    }

    const isPartial = valorAbatido < valorRestante
    const novoValorRestante = valorRestante - valorAbatido
    const novoStatus = isPartial ? 'PARCIALMENTE_PAGO' : 'PAGO'

    // Sanitize observacoes
    const observacoesSanitized = observacoes ? sanitizeString(observacoes) : null

    // ─── Create TransacaoPagamento ───
    const transacao = await db.transacaoPagamento.create({
      data: {
        carteiraId: carteira.id,
        contaAPagarId: contaAPagar.id,
        contratoId: contaAPagar.contrato.id,
        tipoTransacao: 'ABATIMENTO',
        valorAbatido,
        saldoRestanteParcela: novoValorRestante,
        valorIrrfRetido: 0,
        valorInssRetido: 0,
        status: 'CONCLUIDO',
        observacoes: observacoesSanitized,
      },
    })

    // ─── Update carteira: saldoDisponivel -= valorAbatido ───
    await db.carteiraDigital.update({
      where: { id: carteira.id },
      data: {
        saldoDisponivel: carteira.saldoDisponivel - valorAbatido,
        updatedAt: new Date(),
      },
    })

    // ─── Update conta_a_pagar ───
    await db.contaAPagar.update({
      where: { id: contaAPagar.id },
      data: {
        valorRestante: novoValorRestante,
        status: novoStatus,
        updatedAt: new Date(),
      },
    })

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'TransacaoPagamento',
        entidadeId: transacao.id,
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresNovos: JSON.stringify({
          tipoTransacao: 'ABATIMENTO',
          carteiraId: carteira.id,
          contaAPagarId: contaAPagar.id,
          valorAbatido,
          saldoRestanteParcela: novoValorRestante,
          novoStatusConta: novoStatus,
          isPartial,
        }),
        observacao: isPartial
          ? `Abatimento parcial de R$ ${valorAbatido.toFixed(2)} na conta ${contaAPagar.descricao}. Restante: R$ ${novoValorRestante.toFixed(2)}`
          : `Abatimento total de R$ ${valorAbatido.toFixed(2)} na conta ${contaAPagar.descricao}`,
      },
    })

    return NextResponse.json({
      success: true,
      transacao,
      _meta: {
        valorAbatido,
        isPartial,
        novoStatusConta: novoStatus,
        saldoRestanteParcela: novoValorRestante,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Abatimento error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
