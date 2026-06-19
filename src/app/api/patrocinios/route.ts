import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

// ─── CLT prohibited terms (RN-04: Air-Gap Funcional) ───
const CLT_PROHIBITED_TERMS = [
  'meta_', 'horario_', 'ponto_', 'chefe', 'salario', 'salário',
  'subordinação', 'subordinacao', 'supervisor_funcional', 'desempenho',
  'avaliacao', 'avaliação', 'ferias', 'férias', 'contrato_trabalho',
  'clt', 'empregado', 'empregador', 'jornada', 'carga_horaria',
]

/**
 * Check request body for CLT-related terms (RN-04)
 */
function checkCltViolations(body: Record<string, unknown>): string[] {
  const violations: string[] = []
  const bodyStr = JSON.stringify(body).toLowerCase()
  for (const term of CLT_PROHIBITED_TERMS) {
    if (bodyStr.includes(term.toLowerCase())) {
      violations.push(term)
    }
  }
  return violations
}

/**
 * GET /api/patrocinios
 * List patrocínios with pagination, filtering, and option to include inactive (historical) records
 *
 * Query params:
 * - page (default 1)
 * - limit (default 20, max 100)
 * - revendedorId (filter by revendedor)
 * - patrocinadorId (filter by patrocinador)
 * - nivel (filter by nivelProfundidade)
 * - incluirInativos (boolean, default false — include records with dataFimVinculo set)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const revendedorId = searchParams.get('revendedorId') || undefined
    const patrocinadorId = searchParams.get('patrocinadorId') || undefined
    const nivel = searchParams.get('nivel') ? parseInt(searchParams.get('nivel')!, 10) : undefined
    const incluirInativos = searchParams.get('incluirInativos') === 'true'

    const where: Record<string, unknown> = {}
    if (!incluirInativos) {
      where.dataFimVinculo = null
    }
    if (revendedorId) where.revendedorId = revendedorId
    if (patrocinadorId) where.patrocinadorId = patrocinadorId
    if (nivel !== undefined) where.nivelProfundidade = nivel

    const [patrocinios, total] = await Promise.all([
      db.patrocinio.findMany({
        where,
        include: {
          revendedor: {
            select: { id: true, nomeCompleto: true, cpf: true },
          },
          patrocinador: {
            select: { id: true, nomeCompleto: true, cpf: true },
          },
        },
        orderBy: { nivelProfundidade: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.patrocinio.count({ where }),
    ])

    return NextResponse.json({
      data: patrocinios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List patrocinios error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/patrocinios
 * Create a new patrocínio (sponsorship link)
 *
 * Business rules:
 * - RN-009: Validate that revendedorId doesn't already have an active patrocínio (CONFLITO_DE_REDE)
 * - RN-010: Validate that revendedorId !== patrocinadorId (AUTO_PATROCINIO_PROIBIDO)
 * - RN-01: Validate no dependent patrocínio (cônjuge/filho of revendedor cannot be their patrocinador)
 * - RN-04: Air-Gap Funcional — reject CLT-related fields in request body
 * - Validate patrocinador has an active vínculo in the network
 * - Calculate nivelProfundidade based on patrocinador's current level
 * - Ensure both have carteiras digitais (create if not exists)
 * - Audit log
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)
    const body = await request.json()
    const { revendedorId, patrocinadorId } = body

    // ─── Validate required fields ───
    if (!revendedorId || !patrocinadorId) {
      return NextResponse.json(
        { error: 'revendedorId e patrocinadorId são obrigatórios.' },
        { status: 400 }
      )
    }

    // ─── RN-04: Air-Gap Funcional — validate no CLT-related fields ───
    const cltViolations = checkCltViolations(body)
    if (cltViolations.length > 0) {
      await db.auditLog.create({
        data: {
          entidade: 'Patrocinio',
          entidadeId: 'CLT_VALIDATION',
          acao: 'REJEICAO_CLT',
          atorId: userId,
          ipAddress: ipAddress || null,
          observacao: `Tentativa de criação de patrocínio com termos CLT: ${cltViolations.join(', ')}`,
          valoresNovos: JSON.stringify({ violations: cltViolations }),
        },
      })
      return NextResponse.json(
        { error: 'Requisição contém termos proibidos (Air-Gap CLT). Violações: ' + cltViolations.join(', '), code: 'AIR_GAP_CLT', violations: cltViolations },
        { status: 400 }
      )
    }

    // ─── RN-010: Validate revendedorId !== patrocinadorId (auto-patrocínio) ───
    if (revendedorId === patrocinadorId) {
      return NextResponse.json(
        { error: 'Auto-patrocínio não é permitido. Um revendedor não pode ser seu próprio patrocinador.', code: 'AUTO_PATROCINIO_PROIBIDO' },
        { status: 400 }
      )
    }

    // ─── Validate revendedor exists ───
    const revendedor = await db.pessoaFisica.findUnique({ where: { id: revendedorId } })
    if (!revendedor) {
      return NextResponse.json({ error: 'Revendedor não encontrado.' }, { status: 404 })
    }

    // ─── Validate patrocinador exists ───
    const patrocinador = await db.pessoaFisica.findUnique({ where: { id: patrocinadorId } })
    if (!patrocinador) {
      return NextResponse.json({ error: 'Patrocinador não encontrado.' }, { status: 404 })
    }

    // ─── RN-01: Validate no dependent patrocínio ───
    // Check if patrocinadorId is a dependent (cônjuge/filho) of revendedorId
    const vinculoDependente = await db.vinculo.findFirst({
      where: {
        pessoaVinculadaId: patrocinadorId,
        titularRaizId: revendedorId,
        dataFimVinculo: null,
        parentesco: { in: ['CONJUGE', 'FILHO'] },
      },
    })
    if (vinculoDependente) {
      return NextResponse.json(
        { error: `Patrocinador é ${vinculoDependente.parentesco === 'CONJUGE' ? 'cônjuge' : 'filho'} do revendedor. Patrocínio por dependente direto não é permitido.`, code: 'AUTO_PATROCINIO_PROIBIDO' },
        { status: 400 }
      )
    }

    // Check for indirect family relationship (not blocking, but log audit alert)
    const vinculoIndireto = await db.vinculo.findFirst({
      where: {
        pessoaVinculadaId: patrocinadorId,
        titularRaizId: revendedorId,
        dataFimVinculo: null,
        parentesco: { notIn: ['CONJUGE', 'FILHO'] },
      },
    })
    if (vinculoIndireto) {
      // Log alert but allow the patrocínio
      await db.auditLog.create({
        data: {
          entidade: 'Patrocinio',
          entidadeId: 'ALERTA_FAMILIAR',
          acao: 'ALERTA',
          atorId: userId,
          ipAddress: ipAddress || null,
          observacao: `Patrocinador é familiar (${vinculoIndireto.parentesco}) do revendedor. Patrocínio permitido com alerta.`,
          valoresNovos: JSON.stringify({
            revendedorId,
            patrocinadorId,
            parentesco: vinculoIndireto.parentesco,
          }),
        },
      })
    }

    // ─── RN-009: Validate revendedor doesn't already have active patrocínio ───
    const patrocinioAtivoRevendedor = await db.patrocinio.findFirst({
      where: { revendedorId, dataFimVinculo: null },
    })
    if (patrocinioAtivoRevendedor) {
      return NextResponse.json(
        { error: 'Revendedor já possui um vínculo ativo em outra árvore de patrocínio. Encerre o vínculo atual antes de criar um novo.', code: 'CONFLITO_DE_REDE' },
        { status: 409 }
      )
    }

    // ─── Validate patrocinador has an active vínculo (dataFimVinculo IS NULL) ───
    const patrocinioAtivoPatrocinador = await db.patrocinio.findFirst({
      where: { revendedorId: patrocinadorId, dataFimVinculo: null },
    })

    // Patrocinador must be active in the network — either has an active patrocínio or is a root node
    // A root node is someone who appears as patrocinador but has no active patrocínio as revendedor
    // If patrocinadorId has no active patrocínio as revendedor, check if they have been a patrocinador before
    if (!patrocinioAtivoPatrocinador) {
      // Check if patrocinador has any active patrocínio where they are the patrocinador
      // (i.e., they are a root node with at least one active subordinate)
      const patrociniosComoPatrocinador = await db.patrocinio.findFirst({
        where: { patrocinadorId: patrocinadorId, dataFimVinculo: null },
      })

      // Also check if they're a known root — if they've never been a revendedor at all, they could be a root
      const qualquerPatrocinioComoRevendedor = await db.patrocinio.findFirst({
        where: { revendedorId: patrocinadorId },
      })

      // If patrocinador has no active vínculo as revendedor AND has never been a patrocinador with active subordinates
      // AND has been a revendedor before (meaning they left the network), reject
      if (!patrociniosComoPatrocinador && qualquerPatrocinioComoRevendedor) {
        return NextResponse.json(
          { error: 'Patrocinador não possui vínculo ativo na rede. Apenas revendedores ativos podem patrocinar.', code: 'PATROCINADOR_INATIVO' },
          { status: 400 }
        )
      }
      // Otherwise: patrocinador is a root node (first time or has active subordinates) — allowed
    }

    // ─── Calculate nivelProfundidade based on patrocinador's current level ───
    const nivelProfundidade = patrocinioAtivoPatrocinador
      ? patrocinioAtivoPatrocinador.nivelProfundidade + 1
      : 1

    // ─── Ensure revendedor has carteira digital ───
    let carteiraRevendedor = await db.carteiraDigital.findUnique({
      where: { titularId: revendedorId },
    })
    if (!carteiraRevendedor) {
      carteiraRevendedor = await db.carteiraDigital.create({
        data: {
          titularId: revendedorId,
          saldoDisponivel: 0,
          saldoBloqueado: 0,
          saldoDevedor: 0,
        },
      })
    }

    // ─── Ensure patrocinador has carteira digital ───
    let carteiraPatrocinador = await db.carteiraDigital.findUnique({
      where: { titularId: patrocinadorId },
    })
    if (!carteiraPatrocinador) {
      carteiraPatrocinador = await db.carteiraDigital.create({
        data: {
          titularId: patrocinadorId,
          saldoDisponivel: 0,
          saldoBloqueado: 0,
          saldoDevedor: 0,
        },
      })
    }

    // ─── Create patrocínio ───
    const patrocinio = await db.patrocinio.create({
      data: {
        revendedorId,
        patrocinadorId,
        nivelProfundidade,
      },
      include: {
        revendedor: { select: { id: true, nomeCompleto: true, cpf: true } },
        patrocinador: { select: { id: true, nomeCompleto: true, cpf: true } },
      },
    })

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'Patrocinio',
        entidadeId: patrocinio.id,
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresNovos: JSON.stringify({
          revendedorId,
          patrocinadorId,
          nivelProfundidade,
          revendedorNome: revendedor.nomeCompleto,
          patrocinadorNome: patrocinador.nomeCompleto,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      patrocinio,
    }, { status: 201 })
  } catch (error) {
    console.error('Create patrocinio error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
