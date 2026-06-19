import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const transacoes = await db.transacaoPagamento.findMany({
      take: 50,
      orderBy: { dataTransacao: 'desc' },
      include: {
        carteira: {
          include: {
            titular: {
              select: { nomeCompleto: true },
            },
          },
        },
      },
    })

    return NextResponse.json(transacoes)
  } catch (error) {
    console.error('List transacoes error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
