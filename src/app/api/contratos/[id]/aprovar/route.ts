import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { isFeatureEnabled } from '@/lib/flags'

/**
 * POST /api/contratos/[id]/aprovar
 * Approve a contract with full validation, bonificação liberation, and concurrency protection
 *
 * Lacunas fixed:
 * - L31: SuperAdmin role check
 * - L1/RN-01: Validate capitalSegurado > 0
 * - L7: Validate capitalSegurado <= 10_000_000
 * - L8: Validate codigoSeguradora regex ^[A-Z0-9]{1,50}$
 * - L1: Validate codigoSeguradora not null/empty
 * - L9: Validate dataInicio >= today if provided
 * - L12: Optimistic locking concurrency protection
 * - EC-004: Create wallet BEFORE bonificação liberation
 * - L2: Bonificação liberation (PENDENTE_APROVACAO → LIBERADO + wallet update + dataLiberacao)
 * - L30: Audit log with atorId and ipAddress
 * - L32: Audit acao = 'APROVACAO'
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── L31: SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const { capitalSegurado, codigoSeguradora, seguradoraId, observacoes, dataInicio: dataInicioInput } = body

    // ─── L1/RN-01: Validate capitalSegurado > 0 ───
    if (!capitalSegurado || typeof capitalSegurado !== 'number' || capitalSegurado <= 0) {
      return NextResponse.json(
        { error: 'Capital segurado deve ser maior que zero e dentro do limite da apólice master.' },
        { status: 422 }
      )
    }

    // ─── L7: Validate capitalSegurado <= 10_000_000 ───
    if (capitalSegurado > 10_000_000) {
      return NextResponse.json(
        { error: 'Capital segurado deve ser maior que zero e dentro do limite da apólice master.' },
        { status: 422 }
      )
    }

    // ─── L1: Validate codigoSeguradora is not null/empty ───
    if (!codigoSeguradora || typeof codigoSeguradora !== 'string' || codigoSeguradora.trim().length === 0) {
      return NextResponse.json(
        { error: 'Código da seguradora é obrigatório.' },
        { status: 422 }
      )
    }

    // ─── L8: Validate codigoSeguradora regex ───
    if (!/^[A-Z0-9]{1,50}$/.test(codigoSeguradora)) {
      return NextResponse.json(
        { error: 'Código da seguradora inválido. Use apenas letras maiúsculas e números.' },
        { status: 422 }
      )
    }

    // ─── L9: Validate dataInicio if provided is >= today ───
    if (dataInicioInput) {
      const dataInicioParsed = new Date(dataInicioInput)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dataInicioParsed.setHours(0, 0, 0, 0)
      if (dataInicioParsed < today) {
        return NextResponse.json(
          { error: 'Data de início não pode ser anterior à data de aprovação.' },
          { status: 422 }
        )
      }
    }

    // ─── Fetch contrato with optimistic locking data ───
    const contrato = await db.contrato.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contrato.status !== 'AGUARDANDO_APROVACAO') {
      return NextResponse.json({ error: 'Contrato não está aguardando aprovação' }, { status: 400 })
    }

    const dataInicio = dataInicioInput ? new Date(dataInicioInput) : new Date()

    // ─── L12: Optimistic locking - update with updatedAt check ───
    const updateResult = await db.contrato.updateMany({
      where: { id, updatedAt: contrato.updatedAt },
      data: {
        status: 'APROVADO',
        seguradoraId: seguradoraId || null,
        dataInicio,
        updatedAt: new Date(),
      },
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Contrato já processado por outro administrador.' },
        { status: 409 }
      )
    }

    // ─── Create or update approval data ───
    await db.dadosAprovacaoSeguradora.upsert({
      where: { contratoId: id },
      update: {
        capitalSeguradoInformado: capitalSegurado,
        codigoSeguradoraInformado: codigoSeguradora,
        adminAprovadorId: userId,
        dataAprovacao: new Date(),
        observacoesGestor: observacoes || null,
      },
      create: {
        contratoId: id,
        capitalSeguradoInformado: capitalSegurado,
        codigoSeguradoraInformado: codigoSeguradora,
        adminAprovadorId: userId,
        dataAprovacao: new Date(),
        observacoesGestor: observacoes || null,
      },
    })

    // ─── EC-004: Create wallet for titular BEFORE bonificação liberation ───
    const existingWallet = await db.carteiraDigital.findUnique({
      where: { titularId: contrato.titularId },
    })
    if (!existingWallet) {
      await db.carteiraDigital.create({
        data: { titularId: contrato.titularId },
      })
    }

    // ─── L2: Bonificação liberation ───
    // Find all PENDENTE_APROVACAO transactions for this contract
    const bonificacoesPendentes = await db.transacaoBonificacao.findMany({
      where: {
        origemContratoId: id,
        status: 'PENDENTE_APROVACAO',
      },
    })

    if (bonificacoesPendentes.length > 0) {
      const now = new Date()

      // Update all to LIBERADO and set dataLiberacao
      await db.transacaoBonificacao.updateMany({
        where: {
          origemContratoId: id,
          status: 'PENDENTE_APROVACAO',
        },
        data: { status: 'LIBERADO', dataLiberacao: now },
      })

      // Group by carteiraId and sum values
      const carteiraSums: Record<string, number> = {}
      for (const bon of bonificacoesPendentes) {
        if (!carteiraSums[bon.carteiraId]) {
          carteiraSums[bon.carteiraId] = 0
        }
        carteiraSums[bon.carteiraId] += bon.valor
      }

      // Update each carteira: saldoBloqueado -= sum, saldoDisponivel += sum
      // Saldo devedor: abater prioritariamente antes de compor disponível (§2.6)
      for (const [carteiraId, sum] of Object.entries(carteiraSums)) {
        const carteira = await db.carteiraDigital.findUnique({ where: { id: carteiraId } })
        if (carteira) {
          let valorLiquido = sum
          if (carteira.saldoDevedor > 0) {
            const deducao = Math.min(carteira.saldoDevedor, valorLiquido)
            await db.carteiraDigital.update({
              where: { id: carteiraId },
              data: {
                saldoDevedor: carteira.saldoDevedor - deducao,
                saldoDisponivel: carteira.saldoDisponivel + (valorLiquido - deducao),
                saldoBloqueado: Math.max(0, carteira.saldoBloqueado - sum),
                updatedAt: new Date(),
              },
            })
            valorLiquido = valorLiquido - deducao
          } else {
            await db.carteiraDigital.update({
              where: { id: carteiraId },
              data: {
                saldoDisponivel: carteira.saldoDisponivel + valorLiquido,
                saldoBloqueado: Math.max(0, carteira.saldoBloqueado - sum),
                updatedAt: new Date(),
              },
            })
          }
        }
      }
    }

    // ─── L30/L32: Audit log with atorId, ipAddress, acao=APROVACAO ───
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'APROVACAO',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({ status: 'AGUARDANDO_APROVACAO', updatedAt: contrato.updatedAt }),
        valoresNovos: JSON.stringify({
          status: 'APROVADO',
          seguradoraId,
          capitalSegurado,
          codigoSeguradora,
          dataInicio: dataInicio.toISOString(),
          bonificacoesLiberadas: bonificacoesPendentes.length,
        }),
      },
    })

    // ─── P1.4: Webhook notification ───
    const webhookEnabled = await isFeatureEnabled('NOTIFICACAO_WEBHOOK')
    if (webhookEnabled) {
      try {
        const webhookUrl = process.env.WEBHOOK_NOTIFICACAO_URL
        if (webhookUrl) {
          const notificacaoPayload = {
            event: 'CONTRATO_APROVADO',
            contratoId: id,
            titularId: contrato.titularId,
            timestamp: new Date().toISOString(),
          }

          // Fire-and-forget: log and send, never block
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificacaoPayload),
          }).catch(err => {
            console.error('Webhook notification failed (non-blocking):', err)
          })

          await db.auditLog.create({
            data: {
              entidade: 'Contrato',
              entidadeId: id,
              acao: 'NOTIFICACAO_ENVIADA',
              atorId: userId,
              ipAddress: ipAddress || null,
              valoresNovos: JSON.stringify({
                webhookUrl,
                event: 'CONTRATO_APROVADO',
                titulo: 'Contrato Aprovado',
                mensagem: `Seu contrato foi aprovado. A partir de agora você e sua família estão protegidos.`,
              }),
              observacao: `Notificação de aprovação enviada via webhook para ${webhookUrl}`,
            },
          })
        }
      } catch (notifError) {
        console.error('Notification error (non-blocking):', notifError)
      }
    }

    // Fetch updated contrato for response
    const contratoAtualizado = await db.contrato.findUnique({
      where: { id },
      include: {
        titular: { select: { id: true, nomeCompleto: true, cpf: true } },
        plano: true,
        seguradora: true,
        dadosAprovacao: true,
      },
    })

    return NextResponse.json({
      success: true,
      contrato: contratoAtualizado,
      _meta: {
        bonificacoesLiberadas: bonificacoesPendentes.length,
      },
    })
  } catch (error) {
    console.error('Aprovar contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
