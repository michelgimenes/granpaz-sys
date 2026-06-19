import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const contas = await db.contaAPagar.findMany({
      include: {
        contrato: {
          include: {
            titular: {
              select: { nomeCompleto: true, cpf: true },
            },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    })

    return NextResponse.json(contas)
  } catch (error) {
    console.error('List contas a pagar error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
