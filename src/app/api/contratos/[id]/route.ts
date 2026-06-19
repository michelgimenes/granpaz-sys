import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contrato = await db.contrato.findUnique({
      where: { id },
      include: {
        titular: true,
        plano: true,
        seguradora: true,
        dadosAprovacao: true,
        sinistros: true,
      },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    // Get vinculos
    const vinculos = await db.vinculo.findMany({
      where: { titularRaizId: contrato.titularId, dataFimVinculo: null },
      include: { pessoaVinculada: true },
    })

    return NextResponse.json({ ...contrato, vinculos })
  } catch (error) {
    console.error('Get contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const contrato = await db.contrato.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Update contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
