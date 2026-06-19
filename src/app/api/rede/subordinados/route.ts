import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/rede/subordinados
 * List direct and indirect subordinates of a revendedor
 *
 * Query params:
 * - revendedor_id (required)
 * - tipo (diretos/indiretos/todos, default diretos)
 * - nivel (filter by depth level)
 * - page (default 1)
 * - limit (default 20, max 100)
 *
 * Returns paginated list with: revendedor data, nivelProfundidade, dataEntrada
 * Include total count per level
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const revendedorId = searchParams.get('revendedor_id')
    const tipo = searchParams.get('tipo') || 'diretos' // diretos | indiretos | todos
    const nivelFilter = searchParams.get('nivel') ? parseInt(searchParams.get('nivel')!, 10) : undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    if (!revendedorId) {
      return NextResponse.json(
        { error: 'revendedor_id é obrigatório.' },
        { status: 400 }
      )
    }

    // Validate revendedor exists
    const revendedor = await db.pessoaFisica.findUnique({ where: { id: revendedorId } })
    if (!revendedor) {
      return NextResponse.json({ error: 'Revendedor não encontrado.' }, { status: 404 })
    }

    // Get the revendedor's active patrocínio to determine their level
    const patrocinioAtivo = await db.patrocinio.findFirst({
      where: { revendedorId, dataFimVinculo: null },
    })
    const nivelBase = patrocinioAtivo ? patrocinioAtivo.nivelProfundidade : 0

    // Collect subordinates based on tipo
    let allSubordinados: SubordinadoItem[] = []

    if (tipo === 'diretos') {
      // Only direct subordinates (1 level down)
      const whereClause: Record<string, unknown> = {
        patrocinadorId: revendedorId,
        dataFimVinculo: null,
      }
      if (nivelFilter !== undefined) {
        whereClause.nivelProfundidade = nivelFilter
      }

      const patrocinios = await db.patrocinio.findMany({
        where: whereClause,
        include: {
          revendedor: {
            select: { id: true, nomeCompleto: true, cpf: true, tipoRegistro: true },
          },
        },
        orderBy: { dataEntrada: 'asc' },
      })

      allSubordinados = patrocinios.map(p => ({
        patrocinioId: p.id,
        revendedorId: p.revendedorId,
        nomeCompleto: p.revendedor.nomeCompleto,
        cpf: p.revendedor.cpf,
        tipoRegistro: p.revendedor.tipoRegistro,
        nivelProfundidade: p.nivelProfundidade,
        dataEntrada: p.dataEntrada,
        relacao: 'direto' as const,
      }))
    } else {
      // indiretos or todos — recursively find subordinates up to 10 levels
      allSubordinados = await findSubordinatesRecursive(
        revendedorId,
        nivelBase + 1,
        tipo === 'indiretos' ? 2 : 1, // for indiretos, skip direct (depth 1)
        10,
        nivelFilter
      )
    }

    // Build count per level
    const countPorNivel: Record<number, number> = {}
    for (const sub of allSubordinados) {
      countPorNivel[sub.nivelProfundidade] = (countPorNivel[sub.nivelProfundidade] || 0) + 1
    }

    // Paginate
    const total = allSubordinados.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedSubordinados = allSubordinados.slice(offset, offset + limit)

    return NextResponse.json({
      data: paginatedSubordinados,
      countPorNivel,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Subordinados query error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

interface SubordinadoItem {
  patrocinioId: string
  revendedorId: string
  nomeCompleto: string
  cpf: string | null
  tipoRegistro: string
  nivelProfundidade: number
  dataEntrada: Date
  relacao: 'direto' | 'indireto'
}

/**
 * Recursively find subordinates with depth tracking
 * skipUntilDepth: minimum depth to include (1 = all, 2 = skip direct)
 */
async function findSubordinatesRecursive(
  patrocinadorId: string,
  currentNivel: number,
  skipUntilDepth: number,
  maxDepth: number,
  nivelFilter?: number
): Promise<SubordinadoItem[]> {
  const results: SubordinadoItem[] = []

  if (currentNivel > maxDepth + 100) return results // safety limit

  const patrocinios = await db.patrocinio.findMany({
    where: { patrocinadorId, dataFimVinculo: null },
    include: {
      revendedor: {
        select: { id: true, nomeCompleto: true, cpf: true, tipoRegistro: true },
      },
    },
    orderBy: { dataEntrada: 'asc' },
  })

  for (const p of patrocinios) {
    const depth = p.nivelProfundidade - (currentNivel - 1) // relative depth from original revendedor
    const shouldInclude = depth >= skipUntilDepth && (nivelFilter === undefined || p.nivelProfundidade === nivelFilter)

    if (shouldInclude) {
      results.push({
        patrocinioId: p.id,
        revendedorId: p.revendedorId,
        nomeCompleto: p.revendedor.nomeCompleto,
        cpf: p.revendedor.cpf,
        tipoRegistro: p.revendedor.tipoRegistro,
        nivelProfundidade: p.nivelProfundidade,
        dataEntrada: p.dataEntrada,
        relacao: depth === 1 ? 'direto' : 'indireto',
      })
    }

    // Recurse into subordinates (always, to find indirect ones)
    if (p.nivelProfundidade < maxDepth + 100) {
      const subResults = await findSubordinatesRecursive(
        p.revendedorId,
        currentNivel + 1,
        skipUntilDepth,
        maxDepth,
        nivelFilter
      )
      results.push(...subResults)
    }
  }

  return results
}
