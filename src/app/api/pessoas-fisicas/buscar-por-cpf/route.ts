import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cpf = searchParams.get('cpf')

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })
    }

    const pessoa = await db.pessoaFisica.findUnique({
      where: { cpf },
      include: {
        vinculosComoTitular: {
          include: { pessoaVinculada: true },
        },
        contratos: {
          include: { plano: true },
        },
      },
    })

    if (!pessoa) {
      return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })
    }

    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('Buscar CPF error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
