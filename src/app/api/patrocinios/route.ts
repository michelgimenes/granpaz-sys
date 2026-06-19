import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const patrocinios = await db.patrocinio.findMany({
      where: { dataFimVinculo: null },
      include: {
        revendedor: {
          select: { nomeCompleto: true, cpf: true },
        },
        patrocinador: {
          select: { nomeCompleto: true, cpf: true },
        },
      },
      orderBy: { nivelProfundidade: 'asc' },
    })

    return NextResponse.json(patrocinios)
  } catch (error) {
    console.error('List patrocinios error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
