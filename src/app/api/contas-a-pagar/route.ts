import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/contas-a-pagar
 * List bills to pay with pagination and filters
 *
 * Features:
 * - Pagination (page, limit)
 * - Filter by contratoId
 * - Filter by status (PENDENTE/PARCIALMENTE_PAGO/PAGO/VENCIDO/CANCELADO)
 * - Filter by date range (data_inicio, data_fim) on dataVencimento
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
    const contratoId = searchParams.get('contratoId')
    const status = searchParams.get('status')
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')

    const where: Record<string, unknown> = {}
    if (contratoId) where.contratoId = contratoId
    if (status) where.status = status
    if (dataInicio || dataFim) {
      where.dataVencimento = {}
      if (dataInicio) (where.dataVencimento as Record<string, unknown>).gte = new Date(dataInicio)
      if (dataFim) (where.dataVencimento as Record<string, unknown>).lte = new Date(dataFim)
    }

    const [contas, total] = await Promise.all([
      db.contaAPagar.findMany({
        where,
        include: {
          contrato: {
            include: {
              titular: {
                select: { id: true, nomeCompleto: true, cpf: true },
              },
            },
          },
        },
        orderBy: { dataVencimento: 'asc' },
        skip,
        take: limit,
      }),
      db.contaAPagar.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: contas,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('List contas a pagar error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
