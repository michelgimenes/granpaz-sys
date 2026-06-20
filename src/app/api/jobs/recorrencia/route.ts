import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * POST /api/jobs/recorrencia
 * Job diário de recorrência (§4.4): Gera novas contas_a_pagar para contratos APROVADOS
 * cuja última parcela quitada/vencida foi há mais de 5 dias.
 *
 * Autorização: Apenas SuperAdmin (x-user-role) ou sistema (x-api-key = JOB_API_KEY)
 */
export async function POST(request: Request) {
  try {
    // Verificar autorização (apenas SuperAdmin ou sistema)
    const userRole = request.headers.get('x-user-role')
    const apiKey = request.headers.get('x-api-key')
    if (userRole !== 'SUPERADMIN' && apiKey !== process.env.JOB_API_KEY) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const today = new Date()
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

    // Buscar contratos APROVADOS com periodicidade MENSAL
    const contratosAtivos = await db.contrato.findMany({
      where: {
        status: 'APROVADO',
        periodicidade: 'MENSAL',
      },
      include: {
        plano: true,
        titular: { select: { id: true } },
      },
    })

    let parcelasGeradas = 0
    const erros: Array<string> = []

    for (const contrato of contratosAtivos) {
      try {
        // Buscar agregados ativos do titular do contrato
        const agregadosAtivosList = await db.vinculo.findMany({
          where: {
            titularRaizId: contrato.titularId,
            dataFimVinculo: null,
            tipoVinculo: 'AGREGADO',
          },
        })
        const agregadosAtivos = agregadosAtivosList.length
        // Buscar última conta_a_pagar do contrato
        const ultimaParcela = await db.contaAPagar.findFirst({
          where: { contratoId: contrato.id },
          orderBy: { dataVencimento: 'desc' },
        })

        if (!ultimaParcela) continue

        // Verificar se já existe parcela para o próximo mês
        const proximoVencimento = new Date(ultimaParcela.dataVencimento)
        proximoVencimento.setMonth(proximoVencimento.getMonth() + 1)

        // Usar dia de vencimento do contrato
        proximoVencimento.setDate(contrato.diaVencimento || 10)

        const parcelaJaExiste = await db.contaAPagar.findFirst({
          where: {
            contratoId: contrato.id,
            dataVencimento: proximoVencimento,
          },
        })

        if (parcelaJaExiste) continue

        // Verificar se última parcela foi quitada/vencida há > 5 dias
        const isQuitada = ['PAGO', 'CANCELADO'].includes(ultimaParcela.status)
        const isVencida = ultimaParcela.dataVencimento < fiveDaysAgo

        if (!isQuitada && !isVencida) continue

        // Recalcular valor baseado em agregados ativos
        const valorBase = contrato.valorParcelaBase
        const valorAgregados = (contrato.plano?.valorPorAgregado || 0) * agregadosAtivos
        const valorTotal = valorBase + valorAgregados

        // Gerar nova parcela
        await db.contaAPagar.create({
          data: {
            contratoId: contrato.id,
            descricao: `Mensalidade - Plano ${contrato.plano?.nome || 'Granpaz'} - ${proximoVencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            valor: valorTotal,
            valorRestante: valorTotal,
            dataVencimento: proximoVencimento,
            status: 'PENDENTE',
          },
        })

        parcelasGeradas++
      } catch (err) {
        erros.push(`Contrato ${contrato.id}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        entidade: 'Sistema',
        entidadeId: 'recorrencia_job',
        acao: 'JOB_RECURRENCE',
        atorId: request.headers.get('x-user-id') || 'system',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresNovos: JSON.stringify({
          parcelasGeradas,
          contratosVerificados: contratosAtivos.length,
          erros: erros.length > 0 ? erros : undefined,
          dataExecucao: today.toISOString(),
        }),
      },
    })

    return NextResponse.json({
      message: 'Job de recorrência executado com sucesso.',
      parcelasGeradas,
      contratosVerificados: contratosAtivos.length,
      erros: erros.length > 0 ? erros : undefined,
    })
  } catch (error) {
    console.error('Recorrencia job error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
