import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import crypto from 'crypto'

/**
 * POST /api/compliance/lgpd
 * RN-06: LGPD anonymization job — Anonymize PII for ended contracts (5-year retention)
 * SuperAdmin only
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized, user } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin pode executar o job de anonimização LGPD.' },
        { status: 403 }
      )
    }

    const today = new Date()
    const fiveYearsAgo = new Date(today)
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    // Find candidates for anonymization:
    // 1. Pessoas with ended contracts (CANCELADO/CANCELADO_CDC) where dataCancelamento + 5 years <= TODAY
    // 2. OR where sinistro APROVADO with OBITO and sinistro.dataOcorrencia + 5 years <= TODAY
    const contratosCancelados = await db.contrato.findMany({
      where: {
        status: { in: ['CANCELADO', 'CANCELADO_CDC'] },
        dataCancelamento: { lte: fiveYearsAgo },
      },
      select: { titularId: true, dataCancelamento: true },
    })

    const sinistrosObito = await db.sinistro.findMany({
      where: {
        status: 'APROVADO',
        tipoSinistro: { in: ['OBITO_NATURAL', 'OBITO_ACIDENTAL', 'SUICIDIO'] },
        dataOcorrencia: { lte: fiveYearsAgo },
      },
      select: { pessoaVinculadaId: true, dataOcorrencia: true },
    })

    // Collect unique pessoa IDs
    const candidatoIds = new Set<string>()
    const motivosMap = new Map<string, string>()

    for (const c of contratosCancelados) {
      candidatoIds.add(c.titularId)
      motivosMap.set(c.titularId, `CANCELAMENTO_5_ANOS (cancelado em ${c.dataCancelamento?.toISOString()})`)
    }

    for (const s of sinistrosObito) {
      candidatoIds.add(s.pessoaVinculadaId)
      if (!motivosMap.has(s.pessoaVinculadaId)) {
        motivosMap.set(s.pessoaVinculadaId, `OBITO_5_ANOS (óbito em ${s.dataOcorrencia.toISOString()})`)
      }
    }

    let countAnonimizados = 0
    let countSkipped = 0
    const skippedDetails: { pessoaId: string; motivo: string }[] = []

    for (const pessoaId of candidatoIds) {
      // EC-03: Check no active financial pendências
      // 1. Check carteira digital: saldo_devedor must be 0
      const carteira = await db.carteiraDigital.findUnique({ where: { titularId: pessoaId } })
      if (carteira && carteira.saldoDevedor > 0) {
        countSkipped++
        skippedDetails.push({
          pessoaId,
          motivo: `PENDENCIA_FINANCEIRA: saldo_devedor = ${carteira.saldoDevedor}`,
        })
        continue
      }

      // 2. Check no PENDENTE contas_a_pagar
      const contasPendentes = await db.contaAPagar.findFirst({
        where: {
          contrato: { titularId: pessoaId },
          status: 'PENDENTE',
        },
      })
      if (contasPendentes) {
        countSkipped++
        skippedDetails.push({
          pessoaId,
          motivo: 'PENDENCIA_FINANCEIRA: contas_a_pagar PENDENTE encontradas',
        })
        continue
      }

      // ── Proceed with anonymization ──
      const pessoa = await db.pessoaFisica.findUnique({ where: { id: pessoaId } })
      if (!pessoa) continue

      // Generate salted hash of original name for audit trail
      const salt = crypto.randomBytes(16).toString('hex')
      const hashOriginal = crypto
        .createHash('sha256')
        .update(pessoa.nomeCompleto + salt)
        .digest('hex')

      // Record which fields are being anonymized
      const camposAnonimizados: Record<string, string> = {}

      // Anonymize PII fields
      const updateData: Record<string, any> = {
        nomeCompleto: `ANONIMIZADO_${hashOriginal.substring(0, 12)}`,
        cpf: null,
        email: null,
        telefone: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        profissao: null,
      }

      camposAnonimizados.nomeCompleto = pessoa.nomeCompleto
      camposAnonimizados.cpf = pessoa.cpf ? 'REDACTED' : null
      camposAnonimizados.email = pessoa.email ? 'REDACTED' : null
      camposAnonimizados.telefone = pessoa.telefone ? 'REDACTED' : null
      camposAnonimizados.cep = pessoa.cep ? 'REDACTED' : null
      camposAnonimizados.logradouro = pessoa.logradouro ? 'REDACTED' : null
      camposAnonimizados.numero = pessoa.numero ? 'REDACTED' : null
      camposAnonimizados.complemento = pessoa.complemento ? 'REDACTED' : null
      camposAnonimizados.bairro = pessoa.bairro ? 'REDACTED' : null
      camposAnonimizados.profissao = pessoa.profissao ? 'REDACTED' : null

      await db.pessoaFisica.update({
        where: { id: pessoaId },
        data: updateData,
      })

      // Create LogAnonimizacaoLGPD record
      const motivo = motivosMap.get(pessoaId) || 'DESCONHECIDO'
      await db.logAnonimizacaoLGPD.create({
        data: {
          pessoaFisicaId: pessoaId,
          motivo: motivo.split(' ')[0], // OBITO_5_ANOS or CANCELAMENTO_5_ANOS
          camposAnonimizados: JSON.stringify(camposAnonimizados),
          hashOriginalSalt: `${hashOriginal}:${salt}`,
        },
      })

      countAnonimizados++

      // Audit log
      await db.auditLog.create({
        data: {
          entidade: 'PessoaFisica',
          entidadeId: pessoaId,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores: JSON.stringify({ nomeCompleto: pessoa.nomeCompleto, cpf: pessoa.cpf ? 'REDACTED' : null }),
          valoresNovos: JSON.stringify({ anonimizado: true, motivo }),
          observacao: `LGPD: PII anonimizada. Motivo: ${motivo}. Executado por: ${user?.nome || userId}`,
        },
      })
    }

    // Summary audit log
    await db.auditLog.create({
      data: {
        entidade: 'Compliance',
        entidadeId: 'LGPD_JOB',
        acao: 'UPDATE',
        atorId: userId,
        ipAddress,
        valoresNovos: JSON.stringify({
          totalCandidatos: candidatoIds.size,
          anonimizados: countAnonimizados,
          skipped: countSkipped,
          dataExecucao: today.toISOString(),
        }),
        observacao: `Job LGPD executado. ${countAnonimizados} anonimizados, ${countSkipped} com pendência financeira.`,
      },
    })

    return NextResponse.json({
      totalCandidatos: candidatoIds.size,
      anonimizados: countAnonimizados,
      skipped: countSkipped,
      skippedDetails,
    })
  } catch (error) {
    console.error('LGPD anonymization job error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
