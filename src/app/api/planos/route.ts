import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/planos - Public plans WITHOUT seguradora data (Air-Gap!)
export async function GET() {
  try {
    const planos = await db.plano.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        valorBase: true,
        valorTaxaAdesao: true,
        valorPorAgregado: true,
        maxDependentes: true,
        maxAgregados: true,
        descricao: true,
      },
      orderBy: { valorBase: 'asc' },
    })

    // Air-Gap: NEVER include seguradora_id or capital_segurado
    return NextResponse.json(planos)
  } catch (error) {
    console.error('List planos error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
