import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'
import { getConfigBool, getConfigValue } from '@/lib/validations'

/**
 * POST /api/carteiras/[carteiraId]/saques
 * Withdraw funds from wallet (saque)
 *
 * Business rules:
 * - RN-005: Check SAQUE_PF_ATIVO config; calculate IRRF + INSS
 * - RN-006: If valor > LIMITE_SAQUE_DIARIO, status = PENDENTE_APROVACAO
 * - RN-007: If saldo_devedor > 0, block with SALDO_DEVEDOR_EXISTENTE
 * - Minimum withdrawal: R$ 10
 *
 * IRRF 2026 progressive table:
 *   Up to R$ 2,251.05: exempt
 *   R$ 2,251.06 – R$ 2,826.65: 7.5% (deduction R$ 168.83)
 *   R$ 2,826.66 – R$ 3,751.05: 15% (deduction R$ 381.44)
 *   R$ 3,751.06 – R$ 4,664.68: 22.5% (deduction R$ 662.77)
 *   Above R$ 4,664.68: 27.5% (deduction R$ 896.00)
 *
 * INSS: 11% capped at R$ 908.85 (8260.42 * 11%)
 */

function calcularIRRF(base: number): number {
  if (base <= 2251.05) return 0
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 168.83)
  if (base <= 3751.05) return Math.max(0, base * 0.15 - 381.44)
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77)
  return Math.max(0, base * 0.275 - 896.00)
}

function calcularINSS(base: number): number {
  const teto = 908.85
  const calculado = base * 0.11
  return Math.min(calculado, teto)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ carteiraId: string }> }
) {
  try {
    const { carteiraId } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    const body = await request.json()
    const { valor, observacoes } = body

    // ─── Validate valor ───
    if (!valor || typeof valor !== 'number' || valor < 10) {
      return NextResponse.json(
        { error: 'Valor mínimo para saque é R$ 10,00.', code: 'VALOR_MINIMO' },
        { status: 400 }
      )
    }

    // ─── RN-005: Check SAQUE_PF_ATIVO ───
    const saqueAtivo = await getConfigBool('SAQUE_PF_ATIVO')
    if (!saqueAtivo) {
      return NextResponse.json(
        { error: 'Saque para pessoa física está desativado no momento.', code: 'SAQUE_PF_DESATIVADO' },
        { status: 400 }
      )
    }

    // ─── Validate carteira exists ───
    const carteira = await db.carteiraDigital.findUnique({
      where: { id: carteiraId },
      include: { titular: { select: { id: true, nomeCompleto: true, cpf: true } } },
    })

    if (!carteira) {
      return NextResponse.json({ error: 'Carteira digital não encontrada.' }, { status: 404 })
    }

    // ─── Validate valor <= saldoDisponivel ───
    if (valor > carteira.saldoDisponivel) {
      return NextResponse.json(
        { error: 'Saldo disponível insuficiente para realizar saque.', code: 'SALDO_INSUFICIENTE' },
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

    // ─── RN-005: Calculate IRRF and INSS ───
    const valorIrrfRetido = Math.round(calcularIRRF(valor) * 100) / 100
    const valorInssRetido = Math.round(calcularINSS(valor) * 100) / 100
    const valorLiquido = Math.round((valor - valorIrrfRetido - valorInssRetido) * 100) / 100

    // ─── RN-006: Check LIMITE_SAQUE_DIARIO ───
    const limiteDiarioStr = await getConfigValue('LIMITE_SAQUE_DIARIO')
    const limiteDiario = limiteDiarioStr ? parseFloat(limiteDiarioStr) : 5000
    const requiresApproval = valor > limiteDiario

    const status = requiresApproval ? 'PENDENTE_APROVACAO' : 'CONCLUIDO'

    // Sanitize observacoes
    const observacoesSanitized = observacoes ? sanitizeString(observacoes) : null

    // ─── Create TransacaoPagamento ───
    const transacao = await db.transacaoPagamento.create({
      data: {
        carteiraId: carteira.id,
        tipoTransacao: 'SAQUE',
        valorAbatido: valor,
        valorIrrfRetido,
        valorInssRetido,
        valorLiquido,
        status,
        observacoes: observacoesSanitized,
      },
    })

    // ─── Update carteira based on status ───
    if (requiresApproval) {
      // Move valor to saldoBloqueado (don't debit yet)
      await db.carteiraDigital.update({
        where: { id: carteira.id },
        data: {
          saldoDisponivel: carteira.saldoDisponivel - valor,
          saldoBloqueado: carteira.saldoBloqueado + valor,
          updatedAt: new Date(),
        },
      })
    } else {
      // Debit from saldoDisponivel
      await db.carteiraDigital.update({
        where: { id: carteira.id },
        data: {
          saldoDisponivel: carteira.saldoDisponivel - valor,
          updatedAt: new Date(),
        },
      })
    }

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'TransacaoPagamento',
        entidadeId: transacao.id,
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresNovos: JSON.stringify({
          tipoTransacao: 'SAQUE',
          carteiraId: carteira.id,
          valor,
          valorIrrfRetido,
          valorInssRetido,
          valorLiquido,
          status,
          requiresApproval,
          limiteDiario,
        }),
        observacao: requiresApproval
          ? `Saque de R$ ${valor.toFixed(2)} (líquido R$ ${valorLiquido.toFixed(2)}) aguardando aprovação. Excede limite diário de R$ ${limiteDiario.toFixed(2)}.`
          : `Saque de R$ ${valor.toFixed(2)} (líquido R$ ${valorLiquido.toFixed(2)}) processado automaticamente.`,
      },
    })

    return NextResponse.json({
      success: true,
      transacao,
      _meta: {
        valor,
        valorIrrfRetido,
        valorInssRetido,
        valorLiquido,
        status,
        requiresApproval,
        limiteDiario,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Saque error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
