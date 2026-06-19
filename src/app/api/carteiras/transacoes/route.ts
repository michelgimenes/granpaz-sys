import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/carteiras/transacoes
 * List payment transactions with pagination and filters
 *
 * Features:
 * - Pagination (page, limit)
 * - Filter by tipo (ABATIMENTO/SAQUE)
 * - Filter by status (CONCLUIDO/ESTORNADO/PENDENTE_APROVACAO)
 * - Filter by date range (data_inicio, data_fim)
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
    const tipo = searchParams.get('tipo') // ABATIMENTO / SAQUE
    const status = searchParams.get('status') // CONCLUIDO / ESTORNADO / PENDENTE_APROVACAO
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')

    const where: Record<string, unknown> = {}
    if (tipo) where.tipoTransacao = tipo
    if (status) where.status = status
    if (dataInicio || dataFim) {
      where.dataTransacao = {}
      if (dataInicio) (where.dataTransacao as Record<string, unknown>).gte = new Date(dataInicio)
      if (dataFim) (where.dataTransacao as Record<string, unknown>).lte = new Date(dataFim)
    }

    const [transacoes, total] = await Promise.all([
      db.transacaoPagamento.findMany({
        where,
        orderBy: { dataTransacao: 'desc' },
        include: {
          carteira: {
            include: {
              titular: {
                select: { id: true, nomeCompleto: true, cpf: true },
              },
            },
          },
          contaAPagar: {
            select: { id: true, descricao: true, status: true },
          },
        },
        skip,
        take: limit,
      }),
      db.transacaoPagamento.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: transacoes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('List transacoes error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
