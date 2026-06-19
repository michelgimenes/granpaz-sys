import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkFinanceiroOrAdmin } from '@/lib/auth-helpers'

/**
 * GET /api/admin/saques
 * List pending saques for Maker/Checker dashboard
 *
 * Features:
 * - SuperAdmin/FINANCEIRO role check
 * - List TransacaoPagamento where tipoTransacao='SAQUE' and status='PENDENTE_APROVACAO'
 * - Include carteira with titular info
 * - Pagination
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = request.headers.get('x-user-id')

    // ─── Role check: SuperAdmin or FINANCEIRO ───
    const { authorized } = await checkFinanceiroOrAdmin(userId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso restrito a administradores ou financeiro.' },
        { status: 403 }
      )
    }

    // ─── Pagination ───
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // ─── Optional status filter (default: PENDENTE_APROVACAO) ───
    const statusFilter = searchParams.get('status') || 'PENDENTE_APROVACAO'

    const where = {
      tipoTransacao: 'SAQUE' as const,
      status: statusFilter,
    }

    const [saques, total] = await Promise.all([
      db.transacaoPagamento.findMany({
        where,
        include: {
          carteira: {
            include: {
              titular: {
                select: {
                  id: true,
                  nomeCompleto: true,
                  cpf: true,
                  email: true,
                  telefone: true,
                },
              },
            },
          },
        },
        orderBy: { dataTransacao: 'asc' }, // oldest first for approval queue
        skip,
        take: limit,
      }),
      db.transacaoPagamento.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: saques,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('List pending saques error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
