import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/carteiras
 * List digital wallets with pagination and filters
 *
 * Features:
 * - Pagination (page, limit)
 * - Filter by titularId
 * - Paginated response format
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // ─── Pagination ───
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // ─── Filters ───
    const titularId = searchParams.get('titularId')

    const where: Record<string, unknown> = {}
    if (titularId) where.titularId = titularId

    const [carteiras, total] = await Promise.all([
      db.carteiraDigital.findMany({
        where,
        include: {
          titular: {
            select: { id: true, nomeCompleto: true, cpf: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.carteiraDigital.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: carteiras,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('List carteiras error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
