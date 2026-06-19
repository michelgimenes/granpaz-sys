import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const seguradoras = await db.seguradora.findMany({
      where: { ativa: true },
      select: {
        id: true,
        nome: true,
        cnpj: true,
        codigoSeguradora: true,
        telefoneSinistro: true,
        processoSusep: true,
      },
    })

    return NextResponse.json(seguradoras)
  } catch (error) {
    console.error('List seguradoras error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
