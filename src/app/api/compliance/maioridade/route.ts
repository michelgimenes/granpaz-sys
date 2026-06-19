import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/compliance/maioridade
 * RN-05: Maioridade job — Expire dependentes FILHO who turned 21
 * SuperAdmin only (simulates a scheduled job)
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized, user } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin pode executar o job de maioridade.' },
        { status: 403 }
      )
    }

    const today = new Date()

    // Find all vinculos where:
    // - tipoVinculo = 'DEPENDENTE' and parentesco = 'FILHO'
    // - pessoa_vinculada.data_nascimento + 21 years <= TODAY
    // - data_fim_vinculo IS NULL (still active)
    const vinculosAtivos = await db.vinculo.findMany({
      where: {
        tipoVinculo: 'DEPENDENTE',
        parentesco: 'FILHO',
        dataFimVinculo: null,
      },
      include: {
        pessoaVinculada: true,
        titularRaiz: { select: { id: true, nomeCompleto: true } },
      },
    })

    const vinculosExpirados: string[] = []
    const vinculosSkipped: { vinculoId: string; motivo: string }[] = []

    for (const vinculo of vinculosAtivos) {
      const dataNascimento = vinculo.pessoaVinculada.dataNascimento
      const idade21 = new Date(dataNascimento)
      idade21.setFullYear(idade21.getFullYear() + 21)

      // Check if turned 21
      if (idade21 > today) {
        continue // Not yet 21
      }

      // Skip if person has special tag (inválido/incapaz) — check observacoes field (RN-05)
      const pessoa = vinculo.pessoaVinculada
      const observacoes = pessoa.observacoes || ''
      const hasSpecialTag = /inv[aá]lido|incapaz/i.test(observacoes)

      if (hasSpecialTag) {
        vinculosSkipped.push({
          vinculoId: vinculo.id,
          motivo: 'Pessoa com tag especial (inválido/incapaz) — não expirada automaticamente',
        })
        continue
      }

      // Expire the vinculo
      await db.vinculo.update({
        where: { id: vinculo.id },
        data: { dataFimVinculo: new Date() },
      })

      vinculosExpirados.push(vinculo.id)

      // Notify titular (audit log for now)
      await db.auditLog.create({
        data: {
          entidade: 'Vinculo',
          entidadeId: vinculo.id,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores: JSON.stringify({ dataFimVinculo: null }),
          valoresNovos: JSON.stringify({ dataFimVinculo: new Date().toISOString() }),
          observacao: `Maioridade: dependente FILHO '${vinculo.pessoaVinculada.nomeCompleto}' expirado (21 anos). Titular: ${vinculo.titularRaiz.nomeCompleto}. Notificar titular sobre exclusão do dependente.`,
        },
      })
    }

    // Summary audit log
    await db.auditLog.create({
      data: {
        entidade: 'Compliance',
        entidadeId: 'MAIORIDADE_JOB',
        acao: 'UPDATE',
        atorId: userId,
        ipAddress,
        valoresNovos: JSON.stringify({
          totalVinculosVerificados: vinculosAtivos.length,
          vinculosExpirados: vinculosExpirados.length,
          vinculosSkipped: vinculosSkipped.length,
          dataExecucao: today.toISOString(),
        }),
        observacao: `Job de maioridade executado por ${user?.nome || userId}. ${vinculosExpirados.length} vínculos expirados, ${vinculosSkipped.length} skipped (tags especiais).`,
      },
    })

    return NextResponse.json({
      totalVerificados: vinculosAtivos.length,
      expirados: vinculosExpirados.length,
      skipped: vinculosSkipped,
      expiradosIds: vinculosExpirados,
    })
  } catch (error) {
    console.error('Maioridade job error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
