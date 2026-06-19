import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chave: string }> }
) {
  try {
    const { chave } = await params
    const config = await db.configuracaoRegraNegocio.findUnique({
      where: { chave },
    })

    if (!config) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Get config by chave error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chave: string }> }
) {
  try {
    const { chave } = await params
    const body = await request.json()
    const { valor, motivo_alteracao, confirmado } = body

    if (valor === undefined) {
      return NextResponse.json({ error: 'Valor é obrigatório' }, { status: 400 })
    }

    const current = await db.configuracaoRegraNegocio.findUnique({ where: { chave } })
    if (!current) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 })
    }

    // Critical key confirmation check
    const CRITICAL_KEYS = ['PREVALENCIA_APIOLICE_SOBRE_CONFIG', 'HASH_ASSINATURA_PDF_SALT']
    if (CRITICAL_KEYS.includes(chave) && !confirmado) {
      return NextResponse.json(
        { error: 'Chave crítica requer confirmação dupla. Envie confirmado: true.' },
        { status: 400 }
      )
    }

    // Motivo_alteracao validation
    if (motivo_alteracao && (motivo_alteracao.length < 20 || motivo_alteracao.length > 500)) {
      return NextResponse.json(
        { error: 'Motivo da alteração deve ter entre 20 e 500 caracteres.' },
        { status: 400 }
      )
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

    // Optimistic concurrency: check if value changed since read
    if (body._version && current.valor !== body._version) {
      return NextResponse.json(
        { error: 'Conflito: configuração foi alterada por outro usuário. Recarregue.' },
        { status: 409 }
      )
    }

    const updated = await db.configuracaoRegraNegocio.update({
      where: { chave },
      data: { valor, updatedAt: new Date() },
    })

    // Create audit log with motivo
    await db.auditLog.create({
      data: {
        entidade: 'ConfiguracaoRegraNegocio',
        entidadeId: current.id,
        acao: 'UPDATE',
        valoresAnteriores: JSON.stringify({ valor: current.valor }),
        valoresNovos: JSON.stringify({ valor }),
        observacao: motivo_alteracao || `Configuração ${chave} alterada`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update config by chave error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
