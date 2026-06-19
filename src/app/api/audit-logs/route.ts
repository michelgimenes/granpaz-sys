import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────
// GET /api/audit-logs
// Paginated audit log with filters
// ─────────────────────────────────────────────────────────
// Query params:
//   page         — page number (default: 1)
//   limit        — items per page (default: 20, max: 100)
//   entidade     — filter by entity name
//   entidade_id  — filter by entity ID
//   atorId       — filter by actor ID
//   acao         — filter by action (CREATE, UPDATE, DELETE, ESTORNO, APROVACAO, etc.)
//   data_inicio  — filter from date (ISO string)
//   data_fim     — filter to date (ISO string)
//
// Response:
//   { data: [...], pagination: { page, limit, total, totalPages } }
// ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Filters
    const entidade = searchParams.get('entidade') || undefined
    const entidade_id = searchParams.get('entidade_id') || undefined
    const atorId = searchParams.get('atorId') || undefined
    const acao = searchParams.get('acao') || undefined
    const data_inicio = searchParams.get('data_inicio') || undefined
    const data_fim = searchParams.get('data_fim') || undefined

    // Build where clause using Prisma's typed where input
    const where: Prisma.AuditLogWhereInput = {}

    if (entidade) where.entidade = entidade
    if (entidade_id) where.entidadeId = entidade_id
    if (atorId) where.atorId = atorId
    if (acao) where.acao = acao

    // Date range filter
    if (data_inicio || data_fim) {
      where.createdAt = {}
      if (data_inicio) {
        where.createdAt.gte = new Date(data_inicio)
      }
      if (data_fim) {
        where.createdAt.lte = new Date(data_fim)
      }
    }

    // Count total matching records
    const total = await db.auditLog.count({ where })
    const totalPages = Math.ceil(total / limit)

    // Fetch paginated results
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('List audit logs error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
