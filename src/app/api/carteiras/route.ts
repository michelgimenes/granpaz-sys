import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const carteiras = await db.carteiraDigital.findMany({
      include: {
        titular: {
          select: { nomeCompleto: true, cpf: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(carteiras)
  } catch (error) {
    console.error('List carteiras error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
