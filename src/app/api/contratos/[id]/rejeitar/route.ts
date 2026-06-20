import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/contratos/[id]/rejeitar
 * Reject a contract with motivo validation, cascade estorno, and audit
 *
 * Lacunas fixed:
 * - L31: SuperAdmin role check
 * - L10/L3: Validate motivo (string, min 10 chars, max 1000 chars)
 * - L4: Cascade estorno of bonificações (PENDENTE_APROVACAO → ESTORNADO, saldoBloqueado -= sum, dataEstorno set)
 * - L30: Audit log with atorId and ipAddress
 * - L32: Audit acao = 'REJEICAO'
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── L31: SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const { motivo } = body

    // ─── L10/L3: Validate motivo ───
    if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 10) {
      return NextResponse.json(
        { error: 'Motivo da rejeição é obrigatório e deve ter pelo menos 10 caracteres.' },
        { status: 422 }
      )
    }
    if (motivo.length > 1000) {
      return NextResponse.json(
        { error: 'Motivo da rejeição não pode exceder 1000 caracteres.' },
        { status: 422 }
      )
    }

    const contrato = await db.contrato.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contrato.status !== 'AGUARDANDO_APROVACAO') {
      return NextResponse.json({ error: 'Contrato não está aguardando aprovação' }, { status: 400 })
    }

    // ─── L12: Optimistic locking concurrency protection ───
    const updateResult = await db.contrato.updateMany({
      where: { id, updatedAt: contrato.updatedAt },
      data: {
        status: 'REJEITADO',
        motivoCancelamento: motivo.trim(),
        dataCancelamento: new Date(),
        updatedAt: new Date(),
      },
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Contrato já processado por outro administrador.' },
        { status: 409 }
      )
    }

    // ─── L4: Cascade estorno of bonificações ───
    const bonificacoesPendentes = await db.transacaoBonificacao.findMany({
      where: {
        origemContratoId: id,
        status: 'PENDENTE_APROVACAO',
      },
    })

    if (bonificacoesPendentes.length > 0) {
      const now = new Date()

      // Update all to ESTORNADO and set dataEstorno
      await db.transacaoBonificacao.updateMany({
        where: {
          origemContratoId: id,
          status: 'PENDENTE_APROVACAO',
        },
        data: { status: 'ESTORNADO', dataEstorno: now },
      })

      // Group by carteiraId and sum values
      const carteiraSums: Record<string, number> = {}
      for (const bon of bonificacoesPendentes) {
        if (!carteiraSums[bon.carteiraId]) {
          carteiraSums[bon.carteiraId] = 0
        }
        carteiraSums[bon.carteiraId] += bon.valor
      }

      // Update each carteira: saldoBloqueado -= sum (just remove from blocked, don't add to available)
      for (const [carteiraId, sum] of Object.entries(carteiraSums)) {
        const carteira = await db.carteiraDigital.findUnique({ where: { id: carteiraId } })
        if (carteira) {
          await db.carteiraDigital.update({
            where: { id: carteiraId },
            data: {
              saldoBloqueado: Math.max(0, carteira.saldoBloqueado - sum),
              updatedAt: new Date(),
            },
          })
        }
      }
    }

    // ─── L30/L32: Audit log with atorId, ipAddress, acao=REJEICAO ───
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'REJEICAO',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({ status: 'AGUARDANDO_APROVACAO', updatedAt: contrato.updatedAt }),
        valoresNovos: JSON.stringify({
          status: 'REJEITADO',
          motivo: motivo.trim(),
          bonificacoesEstornadas: bonificacoesPendentes.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      _meta: {
        bonificacoesEstornadas: bonificacoesPendentes.length,
      },
    })
  } catch (error) {
    console.error('Rejeitar contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
