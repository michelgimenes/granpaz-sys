import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/contratos/[id]/cancelar-cdc
 * RN-04: CDC Arrependimento — Cancel within 7-day cooling-off period (Art. 49 CDC)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized, user } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin pode cancelar contrato por arrependimento CDC.' },
        { status: 403 }
      )
    }

    // Fetch contrato
    const contrato = await db.contrato.findUnique({
      where: { id },
      include: {
        titular: { select: { id: true, nomeCompleto: true } },
        dadosAprovacao: true,
      },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }

    if (contrato.status !== 'APROVADO') {
      return NextResponse.json(
        { error: `Contrato com status '${contrato.status}' não pode ser cancelado por arrependimento CDC. Requer status APROVADO.` },
        { status: 400 }
      )
    }

    // Validate 7-day window from dataInicio
    if (!contrato.dataInicio) {
      return NextResponse.json(
        { error: 'Contrato não possui data de início definida. Impossível calcular prazo de arrependimento.' },
        { status: 400 }
      )
    }

    const prazoCdc = new Date(contrato.dataInicio)
    prazoCdc.setDate(prazoCdc.getDate() + 7)

    if (new Date() > prazoCdc) {
      return NextResponse.json(
        {
          error: 'Prazo de arrependimento expirado.',
          detalhes: `O prazo de 7 dias (Art. 49 CDC) expirou em ${prazoCdc.toISOString()}. Data início do contrato: ${contrato.dataInicio.toISOString()}.`,
        },
        { status: 400 }
      )
    }

    // ── Execute cancellation in transaction ──
    const resultado = await db.$transaction(async (tx) => {
      // 1. Update contrato status
      const contratoAtualizado = await tx.contrato.update({
        where: { id },
        data: {
          status: 'CANCELADO_CDC',
          dataCancelamento: new Date(),
          motivoCancelamento: 'Arrependimento CDC Art. 49',
          updatedAt: new Date(),
        },
      })

      // 2. Cascade estorno of ALL bonificações (LIBERADO → ESTORNADO) for this contract
      const bonificacoesLiberadas = await tx.transacaoBonificacao.findMany({
        where: {
          origemContratoId: id,
          status: 'LIBERADO',
        },
      })

      let valorTotalEstornadoLiberado = 0

      for (const bonif of bonificacoesLiberadas) {
        await tx.transacaoBonificacao.update({
          where: { id: bonif.id },
          data: {
            status: 'ESTORNADO',
            dataEstorno: new Date(),
          },
        })
        valorTotalEstornadoLiberado += bonif.valor
      }

      // 3. Also estorno PENDENTE_APROVACAO bonificações
      const bonificacoesPendentes = await tx.transacaoBonificacao.findMany({
        where: {
          origemContratoId: id,
          status: 'PENDENTE_APROVACAO',
        },
      })

      let valorTotalPendente = 0

      for (const bonif of bonificacoesPendentes) {
        await tx.transacaoBonificacao.update({
          where: { id: bonif.id },
          data: {
            status: 'ESTORNADO',
            dataEstorno: new Date(),
          },
        })
        valorTotalPendente += bonif.valor
      }

      // 4. Update carteiras digitais affected
      // Collect unique carteiraIds from all estornadas bonificações
      const carteiraIds = new Set([
        ...bonificacoesLiberadas.map(b => b.carteiraId),
        ...bonificacoesPendentes.map(b => b.carteiraId),
      ])

      for (const carteiraId of carteiraIds) {
        const carteira = await tx.carteiraDigital.findUnique({ where: { id: carteiraId } })
        if (!carteira) continue

        const liberadas = bonificacoesLiberadas.filter(b => b.carteiraId === carteiraId)
        const pendentes = bonificacoesPendentes.filter(b => b.carteiraId === carteiraId)

        const valorLiberadoEstornado = liberadas.reduce((sum, b) => sum + b.valor, 0)
        const valorPendenteEstornado = pendentes.reduce((sum, b) => sum + b.valor, 0)

        // saldoDisponivel -= LIBERADO values (with devedor logic)
        let novoSaldoDisponivel = carteira.saldoDisponivel - valorLiberadoEstornado
        let deficit = 0
        if (novoSaldoDisponivel < 0) {
          deficit = Math.abs(novoSaldoDisponivel)
          novoSaldoDisponivel = 0
        }

        // saldoBloqueado -= PENDENTE_APROVACAO values
        const novoSaldoBloqueado = Math.max(0, carteira.saldoBloqueado - valorPendenteEstornado)

        await tx.carteiraDigital.update({
          where: { id: carteiraId },
          data: {
            saldoDisponivel: novoSaldoDisponivel,
            saldoBloqueado: novoSaldoBloqueado,
            saldoDevedor: carteira.saldoDevedor + deficit,
            updatedAt: new Date(),
          },
        })
      }

      // 5. Cancel all PENDENTE contas_a_pagar
      const contasCanceladas = await tx.contaAPagar.updateMany({
        where: {
          contratoId: id,
          status: 'PENDENTE',
        },
        data: { status: 'CANCELADO' },
      })

      return {
        contrato: contratoAtualizado,
        bonificacoesEstornadas: bonificacoesLiberadas.length + bonificacoesPendentes.length,
        valorTotalEstornadoLiberado,
        valorTotalPendente,
        contasCanceladas: contasCanceladas.count,
      }
    })

    // ── Audit log with CDC reference ──
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'UPDATE',
        atorId: userId,
        ipAddress,
        valoresAnteriores: JSON.stringify({ status: 'APROVADO' }),
        valoresNovos: JSON.stringify({
          status: 'CANCELADO_CDC',
          motivoCancelamento: 'Arrependimento CDC Art. 49',
          dataInicio: contrato.dataInicio?.toISOString(),
          prazoCdc: prazoCdc.toISOString(),
          bonificacoesEstornadas: resultado.bonificacoesEstornadas,
          valorTotalEstornado: resultado.valorTotalEstornadoLiberado + resultado.valorTotalPendente,
          contasCanceladas: resultado.contasCanceladas,
        }),
        observacao: `Contrato cancelado por arrependimento CDC (Art. 49). Titular: ${contrato.titular.nomeCompleto}. ${resultado.bonificacoesEstornadas} bonificações estornadas. ${resultado.contasCanceladas} contas canceladas. Aprovado por: ${user?.nome || userId}`,
      },
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Cancelar CDC error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
