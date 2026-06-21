import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkFinanceiroOrAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

/**
 * POST /api/admin/saques/[transacaoId]/aprovar
 * Maker/Checker approval for saque withdrawals
 *
 * Business rules:
 * - SuperAdmin/FINANCEIRO role check
 * - Validate transacao exists and status is PENDENTE_APROVACAO
 * - If aprovado=true: deduct from saldoBloqueado, set status=CONCLUIDO
 * - If aprovado=false: move saldoBloqueado back to saldoDisponivel, set status=ESTORNADO, require motivoRejeicao (min 10 chars)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ transacaoId: string }> }
) {
  try {
    const { transacaoId } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── Role check: SuperAdmin or FINANCEIRO ───
    const { authorized } = await checkFinanceiroOrAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso restrito a administradores ou financeiro.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { aprovado, motivoRejeicao } = body

    // ─── Validate aprovado field ───
    if (typeof aprovado !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo "aprovado" é obrigatório (true/false).' },
        { status: 400 }
      )
    }

    // ─── Validate transacao exists ───
    const transacao = await db.transacaoPagamento.findUnique({
      where: { id: transacaoId },
      include: {
        carteira: true,
      },
    })

    if (!transacao) {
      return NextResponse.json({ error: 'Transação não encontrada.' }, { status: 404 })
    }

    // ─── Validate status is PENDENTE_APROVACAO ───
    if (transacao.status !== 'PENDENTE_APROVACAO') {
      return NextResponse.json(
        { error: 'Transação não está pendente de aprovação.' },
        { status: 400 }
      )
    }

    // ─── Validate tipoTransacao is SAQUE ───
    if (transacao.tipoTransacao !== 'SAQUE') {
      return NextResponse.json(
        { error: 'Transação não é um saque.' },
        { status: 400 }
      )
    }

    const valor = transacao.valorAbatido
    const carteira = transacao.carteira

    if (aprovado) {
      // ─── Approve: deduct from saldoBloqueado ───
      await db.carteiraDigital.update({
        where: { id: carteira.id },
        data: {
          saldoBloqueado: Math.max(0, carteira.saldoBloqueado - valor),
          updatedAt: new Date(),
        },
      })

      // ─── Update transacao status ───
      await db.transacaoPagamento.update({
        where: { id: transacaoId },
        data: {
          status: 'CONCLUIDO',
          adminAprovadorId: userId,
        },
      })

      // ─── Audit log ───
      await db.auditLog.create({
        data: {
          entidade: 'TransacaoPagamento',
          entidadeId: transacaoId,
          acao: 'APROVACAO',
          atorId: userId,
          ipAddress: ipAddress || null,
          valoresAnteriores: JSON.stringify({ status: 'PENDENTE_APROVACAO' }),
          valoresNovos: JSON.stringify({
            status: 'CONCLUIDO',
            valor,
            adminAprovadorId: userId,
          }),
          observacao: `Saque de R$ ${valor.toFixed(2)} aprovado pelo admin ${userId}`,
        },
      })

      return NextResponse.json({
        success: true,
        _meta: { acao: 'APROVADO', valor, transacaoId },
      })
    } else {
      // ─── Reject: validate motivoRejeicao ───
      if (!motivoRejeicao || typeof motivoRejeicao !== 'string' || motivoRejeicao.trim().length < 10) {
        return NextResponse.json(
          { error: 'Motivo da rejeição é obrigatório e deve ter pelo menos 10 caracteres.' },
          { status: 422 }
        )
      }

      const motivoSanitized = sanitizeString(motivoRejeicao)

      // ─── Move saldoBloqueado back to saldoDisponivel ───
      await db.carteiraDigital.update({
        where: { id: carteira.id },
        data: {
          saldoBloqueado: Math.max(0, carteira.saldoBloqueado - valor),
          saldoDisponivel: carteira.saldoDisponivel + valor,
          updatedAt: new Date(),
        },
      })

      // ─── Update transacao status ───
      await db.transacaoPagamento.update({
        where: { id: transacaoId },
        data: {
          status: 'ESTORNADO',
          motivoRejeicao: motivoSanitized,
          adminAprovadorId: userId,
        },
      })

      // ─── Audit log ───
      await db.auditLog.create({
        data: {
          entidade: 'TransacaoPagamento',
          entidadeId: transacaoId,
          acao: 'ESTORNO',
          atorId: userId,
          ipAddress: ipAddress || null,
          valoresAnteriores: JSON.stringify({ status: 'PENDENTE_APROVACAO' }),
          valoresNovos: JSON.stringify({
            status: 'ESTORNADO',
            motivoRejeicao: motivoSanitized,
            adminAprovadorId: userId,
          }),
          observacao: `Saque de R$ ${valor.toFixed(2)} rejeitado: ${motivoSanitized}`,
        },
      })

      return NextResponse.json({
        success: true,
        _meta: { acao: 'REJEITADO', valor, transacaoId, motivoRejeicao: motivoSanitized },
      })
    }
  } catch (error) {
    console.error('Aprovar saque error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
