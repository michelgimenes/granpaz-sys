import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/auth-helpers'

/**
 * GET /api/patrocinios
 * List active patrocínios (sponsorships)
 */
export async function GET() {
  try {
    const patrocinios = await db.patrocinio.findMany({
      where: { dataFimVinculo: null },
      include: {
        revendedor: {
          select: { nomeCompleto: true, cpf: true },
        },
        patrocinador: {
          select: { nomeCompleto: true, cpf: true },
        },
      },
      orderBy: { nivelProfundidade: 'asc' },
    })

    return NextResponse.json(patrocinios)
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
 * - RN-009: Validate that revendedorId CPF doesn't already exist in another active tree (data_fim_vinculo IS NULL)
 * - RN-010: Validate that revendedorId !== patrocinadorId (auto-patrocínio)
 * - Validate both revendedor and patrocinador exist
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

    // ─── Calculate nivelProfundidade based on patrocinador's current level ───
    const patrocinioAtivoPatrocinador = await db.patrocinio.findFirst({
      where: { revendedorId: patrocinadorId, dataFimVinculo: null },
    })
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
