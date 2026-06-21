import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { getConfigInt } from '@/lib/validations'
import { canRunJob } from '@/lib/jobs-auth'

/**
 * POST /api/compliance/suspensao-auto
 * RN-03: Auto-suspension job — Suspend contracts with overdue bills past DIAS_SUSPENSAO_INADIMPLENCIA
 * Accepts: SuperAdmin (manual) or JOB_API_KEY (cron)
 */
export async function POST(request: Request) {
  try {
    const jobAuth = await canRunJob(request)
    if (!jobAuth.authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin ou sistema (JOB_API_KEY) pode executar o job de auto-suspensão.' },
        { status: 403 }
      )
    }

    const userId = jobAuth.userId || 'system'
    const ipAddress = jobAuth.isSystem ? null : extractRequestMeta(request).ipAddress
    const userName = jobAuth.isSystem ? 'Sistema (cron)' : (await checkSuperAdmin(userId, request)).user?.nome

    const today = new Date()
    const diasSuspensao = await getConfigInt('DIAS_SUSPENSAO_INADIMPLENCIA')

    if (diasSuspensao <= 0) {
      return NextResponse.json(
        { error: 'Configuração DIAS_SUSPENSAO_INADIMPLENCIA inválida ou não definida.' },
        { status: 500 }
      )
    }

    // Find all APROVADO contracts with contas_a_pagar that are PENDENTE
    // and data_vencimento + DIAS_SUSPENSAO_INADIMPLENCIA days < TODAY
    const dataLimite = new Date(today)
    dataLimite.setDate(dataLimite.getDate() - diasSuspensao)

    // Find overdue contas_a_pagar for APROVADO contracts
    const contasVencidas = await db.contaAPagar.findMany({
      where: {
        status: 'PENDENTE',
        dataVencimento: { lt: dataLimite },
        contrato: {
          status: 'APROVADO',
        },
      },
      include: {
        contrato: {
          include: {
            titular: { select: { id: true, nomeCompleto: true } },
          },
        },
      },
    })

    // Group by contratoId
    const contratoMap = new Map<string, {
      contratoId: string
      titularNome: string
      contasVencidas: number
      diasAtraso: number
    }>()

    for (const conta of contasVencidas) {
      const contratoId = conta.contratoId
      if (!contratoMap.has(contratoId)) {
        const diasAtraso = Math.floor(
          (today.getTime() - conta.dataVencimento.getTime()) / (1000 * 60 * 60 * 24)
        )
        contratoMap.set(contratoId, {
          contratoId,
          titularNome: conta.contrato.titular.nomeCompleto,
          contasVencidas: 1,
          diasAtraso,
        })
      } else {
        const entry = contratoMap.get(contratoId)!
        entry.contasVencidas++
      }
    }

    let countSuspensos = 0

    for (const [contratoId, info] of contratoMap) {
      // Buscar contrato completo para obter titularId
      const contrato = await db.contrato.findUnique({
        where: { id: contratoId },
        select: { id: true, titularId: true },
      })

      // Suspend the contract
      await db.contrato.update({
        where: { id: contratoId },
        data: {
          status: 'SUSPENSO',
          dataSuspensao: new Date(),
          updatedAt: new Date(),
        },
      })

      countSuspensos++

      // Audit log
      await db.auditLog.create({
        data: {
          entidade: 'Contrato',
          entidadeId: contratoId,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores: JSON.stringify({ status: 'APROVADO' }),
          valoresNovos: JSON.stringify({
            status: 'SUSPENSO',
            dataSuspensao: new Date().toISOString(),
          }),
          observacao: `Auto-suspensão por inadimplência. Titular: ${info.titularNome}. Dias em atraso: ${info.diasAtraso}. Contas vencidas: ${info.contasVencidas}. Limite: ${diasSuspensao} dias. Executado por: ${userName}`,
        },
      })

      // Notificação CDC obrigatória (§4.5) — Log para serviço de notificação
      await db.auditLog.create({
        data: {
          entidade: 'Contrato',
          entidadeId: contratoId,
          acao: 'NOTIFICACAO_CDC_SUSPENSAO',
          atorId: null,
          ipAddress: null,
          valoresNovos: JSON.stringify({
            tipo: 'NOTIFICACAO_OBRIGATORIA_CDC',
            mensagem: 'Contrato suspenso por inadimplência. Notificação obrigatória ao titular conforme CDC Art. 39 e SUSEP.',
            titularId: contrato?.titularId,
            contratoId: contratoId,
            statusAnterior: 'APROVADO',
            statusNovo: 'SUSPENSO',
            canal: 'EMAIL_SMS_APP',
            dataSuspensao: new Date().toISOString(),
          }),
        },
      })
    }

    // Summary audit log
    await db.auditLog.create({
      data: {
        entidade: 'Compliance',
        entidadeId: 'AUTO_SUSPENSAO_JOB',
        acao: 'UPDATE',
        atorId: userId,
        ipAddress,
        valoresNovos: JSON.stringify({
          contratosSuspensos: countSuspensos,
          diasSuspensao,
          dataLimite: dataLimite.toISOString(),
          dataExecucao: today.toISOString(),
        }),
        observacao: `Job de auto-suspensão executado. ${countSuspensos} contratos suspensos por inadimplência (> ${diasSuspensao} dias).`,
      },
    })

    return NextResponse.json({
      contratosSuspensos: countSuspensos,
      diasSuspensao,
      detalhes: Array.from(contratoMap.values()),
    })
  } catch (error) {
    console.error('Auto-suspensão job error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
