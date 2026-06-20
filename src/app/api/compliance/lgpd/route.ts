import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import crypto from 'crypto'

/**
 * POST /api/compliance/lgpd
 * RN-06: LGPD anonymization job — Anonymize PII for ended contracts (5-year retention)
 * SuperAdmin only
 *
 * Suporta dois modos:
 * 1. Job automático (sem body): anonimiza pessoas com contratos cancelados há 5+ anos ou óbito há 5+ anos
 * 2. Anonimização manual (body com pessoaFisicaId + motivo): para SOLICITACAO_TITULAR ou DETERMINACAO_JUDICIAL
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

    const body = await request.json().catch(() => ({}))
    const { pessoaFisicaId, motivo: motivoManual } = body as { pessoaFisicaId?: string; motivo?: string }

    // ── Modo manual: SOLICITACAO_TITULAR ou DETERMINACAO_JUDICIAL ──
    const MOTIVOS_MANUAIS = ['SOLICITACAO_TITULAR', 'DETERMINACAO_JUDICIAL']
    if (pessoaFisicaId && motivoManual) {
      if (!MOTIVOS_MANUAIS.includes(motivoManual)) {
        return NextResponse.json(
          { error: `Motivo manual inválido. Permitidos: ${MOTIVOS_MANUAIS.join(', ')}` },
          { status: 400 }
        )
      }

      // Verificar se a pessoa existe
      const pessoa = await db.pessoaFisica.findUnique({ where: { id: pessoaFisicaId } })
      if (!pessoa) {
        return NextResponse.json({ error: 'Pessoa física não encontrada.' }, { status: 404 })
      }

      // Verificar se já foi anonimizada
      const jaAnonimizada = await db.logAnonimizacaoLGPD.findFirst({
        where: { pessoaFisicaId },
      })
      if (jaAnonimizada) {
        return NextResponse.json({ error: 'Esta pessoa já foi anonimizada.' }, { status: 409 })
      }

      // EC-03: Verificar pendências financeiras
      const carteira = await db.carteiraDigital.findUnique({ where: { titularId: pessoaFisicaId } })
      if (carteira && carteira.saldoDevedor > 0) {
        return NextResponse.json(
          { error: `Pessoa com pendência financeira: saldo_devedor = ${carteira.saldoDevedor}` },
          { status: 400 }
        )
      }

      const contasPendentes = await db.contaAPagar.findFirst({
        where: {
          contrato: { titularId: pessoaFisicaId },
          status: 'PENDENTE',
        },
      })
      if (contasPendentes) {
        return NextResponse.json(
          { error: 'Pessoa com pendência financeira: contas_a_pagar PENDENTE encontradas.' },
          { status: 400 }
        )
      }

      // Anonimizar
      const salt = crypto.randomBytes(16).toString('hex')
      const hashOriginal = crypto
        .createHash('sha256')
        .update(pessoa.nomeCompleto + salt)
        .digest('hex')

      const camposAnonimizados: Record<string, string> = {
        nomeCompleto: pessoa.nomeCompleto,
        cpf: pessoa.cpf ? 'REDACTED' : '',
        email: pessoa.email ? 'REDACTED' : '',
        telefone: pessoa.telefone ? 'REDACTED' : '',
        cep: pessoa.cep ? 'REDACTED' : '',
        logradouro: pessoa.logradouro ? 'REDACTED' : '',
        numero: pessoa.numero ? 'REDACTED' : '',
        complemento: pessoa.complemento ? 'REDACTED' : '',
        bairro: pessoa.bairro ? 'REDACTED' : '',
        profissao: pessoa.profissao ? 'REDACTED' : '',
      }

      await db.pessoaFisica.update({
        where: { id: pessoaFisicaId },
        data: {
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
        },
      })

      await db.logAnonimizacaoLGPD.create({
        data: {
          pessoaFisicaId,
          motivo: motivoManual,
          camposAnonimizados: JSON.stringify(camposAnonimizados),
          hashOriginalSalt: `${hashOriginal}:${salt}`,
        },
      })

      await db.auditLog.create({
        data: {
          entidade: 'PessoaFisica',
          entidadeId: pessoaFisicaId,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores: JSON.stringify({ nomeCompleto: pessoa.nomeCompleto, cpf: pessoa.cpf ? 'REDACTED' : null }),
          valoresNovos: JSON.stringify({ anonimizado: true, motivo: motivoManual }),
          observacao: `LGPD: PII anonimizada manualmente. Motivo: ${motivoManual}. Executado por: ${user?.nome || userId}`,
        },
      })

      return NextResponse.json({
        message: 'Anonimização manual realizada com sucesso.',
        pessoaFisicaId,
        motivo: motivoManual,
      })
    }

    // ── Modo automático: job de 5 anos ──
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
    const candidatoIds: Set<string> = new Set()
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
