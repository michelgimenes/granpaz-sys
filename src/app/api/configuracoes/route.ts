import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const configs = await db.configuracaoRegraNegocio.findMany({
      orderBy: { chave: 'asc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('List configuracoes error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, valor } = body

    if (!id || valor === undefined) {
      return NextResponse.json({ error: 'ID e valor são obrigatórios' }, { status: 400 })
    }

    const current = await db.configuracaoRegraNegocio.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 })
    }

    // Type validation
    if (current.tipoParse === 'INT' && isNaN(parseInt(valor))) {
      return NextResponse.json({ error: 'Valor deve ser um número inteiro' }, { status: 400 })
    }
    if (current.tipoParse === 'DECIMAL' && isNaN(parseFloat(valor))) {
      return NextResponse.json({ error: 'Valor deve ser um número decimal' }, { status: 400 })
    }
    if (current.tipoParse === 'BOOLEAN' && !['true', 'false'].includes(valor.toLowerCase())) {
      return NextResponse.json({ error: 'Valor deve ser true ou false' }, { status: 400 })
    }

    const updated = await db.configuracaoRegraNegocio.update({
      where: { id },
      data: { valor, updatedAt: new Date() },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        entidade: 'ConfiguracaoRegraNegocio',
        entidadeId: id,
        acao: 'UPDATE',
        valoresAnteriores: JSON.stringify({ valor: current.valor }),
        valoresNovos: JSON.stringify({ valor }),
        observacao: `Configuração ${current.chave} alterada`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update configuracao error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
