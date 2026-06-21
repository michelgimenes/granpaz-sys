import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

// ─────────────────────────────────────────────────────────
// POST /api/diagnostico/integridade
// Integrity diagnostics endpoint (SuperAdmin only)
//
// Runs 5 diagnostic checks:
// 1. Órfãos de Vínculo (RN-03)
// 2. Ciclos de Patrocínio
// 3. Duplicidade de CPF
// 4. Saldo Devedor Crítico
// 5. Air-Gap Clínico
//
// Returns: { checks: [...], totalAlertas, totalCriticos }
// ─────────────────────────────────────────────────────────

type DiagnosticStatus = 'OK' | 'ALERTA' | 'CRITICO'

interface DiagnosticCheck {
  check: string
  status: DiagnosticStatus
  count: number
  details: unknown[]
}

// ─────────────────────────────────────────────────────────
// Check 1: Órfãos de Vínculo (RN-03)
// Find pessoas_fisicas where tipo_registro IN
// ('DEPENDENTE','AGREGADO','SUB_DEPENDENTE') that have NO
// active vinculo (dataFimVinculo IS NULL) for their titularRaizId
// ─────────────────────────────────────────────────────────
async function checkOrfaosVinculo(): Promise<DiagnosticCheck> {
  // Find all non-TITULAR pessoas with a titularRaizId
  const nonTitulares = await db.pessoaFisica.findMany({
    where: {
      tipoRegistro: { in: ['DEPENDENTE', 'AGREGADO', 'SUB_DEPENDENTE'] },
      titularRaizId: { not: null },
    },
    select: {
      id: true,
      nomeCompleto: true,
      tipoRegistro: true,
      titularRaizId: true,
    },
  })

  // Find all active vinculos
  const activeVinculos = await db.vinculo.findMany({
    where: {
      dataFimVinculo: null,
    },
    select: {
      pessoaVinculadaId: true,
      titularRaizId: true,
    },
  })

  // Build a set of active vinculo keys: pessoaVinculadaId
  const activeVinculoIds = new Set(activeVinculos.map(v => v.pessoaVinculadaId))

  // Orphans: non-titulares that have NO active vinculo
  const orfaos = nonTitulares.filter(p => !activeVinculoIds.has(p.id))

  const status: DiagnosticStatus = orfaos.length === 0 ? 'OK' : orfaos.length <= 5 ? 'ALERTA' : 'CRITICO'

  return {
    check: 'Órfãos de Vínculo (RN-03)',
    status,
    count: orfaos.length,
    details: orfaos.map(o => ({
      id: o.id,
      nomeCompleto: o.nomeCompleto,
      tipoRegistro: o.tipoRegistro,
      titularRaizId: o.titularRaizId,
    })),
  }
}

// ─────────────────────────────────────────────────────────
// Check 2: Ciclos de Patrocínio
// Find cycles in the patrocinios tree
// ─────────────────────────────────────────────────────────
async function checkCiclosPatrocinio(): Promise<DiagnosticCheck> {
  // Get all active patrocinios
  const activePatrocinios = await db.patrocinio.findMany({
    where: { dataFimVinculo: null },
    select: {
      id: true,
      revendedorId: true,
      patrocinadorId: true,
      nivelProfundidade: true,
    },
  })

  // Build adjacency: revendedorId -> patrocinadorId
  const childToParent = new Map<string, string>()
  for (const p of activePatrocinios) {
    childToParent.set(p.revendedorId, p.patrocinadorId)
  }

  // Detect cycles using simple loop tracing
  const visited = new Set<string>()
  const cycles: { startNode: string; cycle: string[] }[] = []

  for (const p of activePatrocinios) {
    if (visited.has(p.revendedorId)) continue

    const path = new Map<string, number>()
    let currentId: string | undefined = p.revendedorId
    let step = 0

    while (currentId) {
      if (path.has(currentId)) {
        // Cycle found
        const cycleStart = path.get(currentId)!
        const cyclePath: string[] = []
        // Reconstruct cycle
        let nodeId: string | undefined = currentId
        for (let i = cycleStart; i < step; i++) {
          cyclePath.push(nodeId!)
          nodeId = childToParent.get(nodeId!)
        }
        cyclePath.push(currentId) // Close the cycle
        cycles.push({ startNode: currentId, cycle: cyclePath })
        break
      }

      path.set(currentId, step)
      visited.add(currentId)
      currentId = childToParent.get(currentId)
      step++
    }
  }

  const status: DiagnosticStatus = cycles.length === 0 ? 'OK' : cycles.length === 1 ? 'ALERTA' : 'CRITICO'

  return {
    check: 'Ciclos de Patrocínio',
    status,
    count: cycles.length,
    details: cycles,
  }
}

// ─────────────────────────────────────────────────────────
// Check 3: Duplicidade de CPF
// Find pessoas_fisicas with same CPF (non-null) appearing more than once
// ─────────────────────────────────────────────────────────
async function checkDuplicidadeCPF(): Promise<DiagnosticCheck> {
  // Get all pessoas with non-null CPF
  const pessoas = await db.pessoaFisica.findMany({
    where: { cpf: { not: null } },
    select: { id: true, cpf: true, nomeCompleto: true },
  })

  // Group by CPF
  const cpfMap = new Map<string, { id: string; nomeCompleto: string }[]>()
  for (const p of pessoas) {
    const cpf = p.cpf!
    if (!cpfMap.has(cpf)) {
      cpfMap.set(cpf, [])
    }
    cpfMap.get(cpf)!.push({ id: p.id, nomeCompleto: p.nomeCompleto })
  }

  // Find duplicates (CPF appearing more than once)
  const duplicates: { cpf: string; pessoas: { id: string; nomeCompleto: string }[] }[] = []
  for (const [cpf, items] of cpfMap.entries()) {
    if (items.length > 1) {
      duplicates.push({ cpf, pessoas: items })
    }
  }

  const totalDuplicates = duplicates.length
  const status: DiagnosticStatus = totalDuplicates === 0 ? 'OK' : totalDuplicates <= 3 ? 'ALERTA' : 'CRITICO'

  return {
    check: 'Duplicidade de CPF',
    status,
    count: totalDuplicates,
    details: duplicates,
  }
}

// ─────────────────────────────────────────────────────────
// Check 4: Saldo Devedor Crítico
// Find carteiras_digitais where saldoDevedor > 1000 AND
// no recent bonificações (no LIBERADO transacoes_bonificacao
// in last 30 days)
// ─────────────────────────────────────────────────────────
async function checkSaldoDevedorCritico(): Promise<DiagnosticCheck> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Find wallets with high debt
  const walletsCriticas = await db.carteiraDigital.findMany({
    where: {
      saldoDevedor: { gt: 1000 },
    },
    select: {
      id: true,
      titularId: true,
      saldoDevedor: true,
    },
  })

  // For each, check if there are recent LIBERADO bonificações
  const walletIds = walletsCriticas.map(w => w.id)

  // Find recent LIBERADO transactions for these wallets
  const recentBonificacoes = await db.transacaoBonificacao.findMany({
    where: {
      carteiraId: { in: walletIds },
      status: 'LIBERADO',
      dataLiberacao: { gte: thirtyDaysAgo },
    },
    select: {
      carteiraId: true,
    },
  })

  const walletsComBonificacao = new Set(recentBonificacoes.map(b => b.carteiraId))

  // Filter out wallets that have recent bonificações
  const walletSemBonificacao = walletsCriticas.filter(w => !walletsComBonificacao.has(w.id))

  const status: DiagnosticStatus = walletSemBonificacao.length === 0 ? 'OK' : walletSemBonificacao.length <= 5 ? 'ALERTA' : 'CRITICO'

  return {
    check: 'Saldo Devedor Crítico',
    status,
    count: walletSemBonificacao.length,
    details: walletSemBonificacao.map(w => ({
      carteiraId: w.id,
      titularId: w.titularId,
      saldoDevedor: w.saldoDevedor,
    })),
  }
}

// ─────────────────────────────────────────────────────────
// Check 5: Air-Gap Clínico
// Find sinistros where observacoes contains clinical terms
// OR documentoS3Hash is null but observacoes contains health data
// ─────────────────────────────────────────────────────────
async function checkAirGapClinico(): Promise<DiagnosticCheck> {
  // Clinical terms that should NOT appear in observacoes
  const clinicalTermsRegex = /\b(CID|diagn[oó]stico|causa_mortis|causa mortis|laudo|atestado|m[eé]dico|paciente|tratamento|doença|enfermidade)\b/i

  // Health data indicators when there's no document hash
  const healthDataRegex = /\b(hospital|cl[ií]nica|m[eé]dico|paciente|rem[eé]dio|medica[cç][aã]o|receita|exame|internado|cirurgia)\b/i

  // Get sinistros with observacoes
  const sinistros = await db.sinistro.findMany({
    where: {
      observacoes: { not: null },
    },
    select: {
      id: true,
      observacoes: true,
      documentoS3Hash: true,
    },
  })

  const violacoes: {
    sinistroId: string
    tipo: 'clinical_term_in_observacoes' | 'health_data_without_hash'
    termoDetectado: string
  }[] = []

  for (const s of sinistros) {
    if (!s.observacoes) continue

    // Check for clinical terms
    const clinicalMatch = s.observacoes.match(clinicalTermsRegex)
    if (clinicalMatch) {
      violacoes.push({
        sinistroId: s.id,
        tipo: 'clinical_term_in_observacoes',
        termoDetectado: clinicalMatch[0],
      })
      continue // Don't double-report
    }

    // Check for health data when no document hash
    if (!s.documentoS3Hash) {
      const healthMatch = s.observacoes.match(healthDataRegex)
      if (healthMatch) {
        violacoes.push({
          sinistroId: s.id,
          tipo: 'health_data_without_hash',
          termoDetectado: healthMatch[0],
        })
      }
    }
  }

  const status: DiagnosticStatus = violacoes.length === 0 ? 'OK' : violacoes.length <= 3 ? 'ALERTA' : 'CRITICO'

  return {
    check: 'Air-Gap Clínico',
    status,
    count: violacoes.length,
    details: violacoes,
  }
}

// ─────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Apenas SUPERADMIN pode executar diagnósticos de integridade' },
        { status: 403 }
      )
    }

    // Run all 5 diagnostic checks in parallel
    const [orfaos, ciclos, duplicidade, saldoDevedor, airGapClinico] = await Promise.all([
      checkOrfaosVinculo(),
      checkCiclosPatrocinio(),
      checkDuplicidadeCPF(),
      checkSaldoDevedorCritico(),
      checkAirGapClinico(),
    ])

    const checks = [orfaos, ciclos, duplicidade, saldoDevedor, airGapClinico]

    const totalAlertas = checks.filter(c => c.status === 'ALERTA').length
    const totalCriticos = checks.filter(c => c.status === 'CRITICO').length

    // Audit log
    await db.auditLog.create({
      data: {
        entidade: 'DiagnosticoIntegridade',
        entidadeId: 'INTEGRIDADE_CHECK',
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        observacao: `Diagnóstico de integridade executado: ${totalAlertas} alerta(s), ${totalCriticos} crítico(s)`,
        valoresNovos: JSON.stringify({
          checks: checks.map(c => ({ check: c.check, status: c.status, count: c.count })),
        }),
      },
    })

    return NextResponse.json({
      checks,
      totalAlertas,
      totalCriticos,
    })
  } catch (error) {
    console.error('Diagnostico integridade error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
