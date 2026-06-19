import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const entidade = searchParams.get('entidade')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where = entidade ? { entidade } : {}

    const logs = await db.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('List audit logs error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
