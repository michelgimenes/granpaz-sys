import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const sinistros = await db.sinistro.findMany({
      include: {
        contrato: {
          include: {
            titular: { select: { nomeCompleto: true } },
          },
        },
        pessoaVinculada: {
          select: { nomeCompleto: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sinistros)
  } catch (error) {
    console.error('List sinistros error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contratoId, pessoaVinculadaId, tipoSinistro, dataOcorrencia, observacoes } = body

    if (!contratoId || !tipoSinistro || !dataOcorrencia) {
      return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 })
    }

    // Validate contrato exists
    const contrato = await db.contrato.findUnique({ where: { id: contratoId } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    // Use titular as pessoaVinculada if not specified
    const pessoaId = pessoaVinculadaId || contrato.titularId

    const sinistro = await db.sinistro.create({
      data: {
        contratoId,
        pessoaVinculadaId: pessoaId,
        tipoSinistro,
        dataOcorrencia: new Date(dataOcorrencia),
        status: 'EM_ANALISE',
        observacoes: observacoes || null,
      },
      include: {
        contrato: { include: { titular: true } },
        pessoaVinculada: true,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        entidade: 'Sinistro',
        entidadeId: sinistro.id,
        acao: 'CREATE',
        valoresNovos: JSON.stringify({ tipoSinistro, status: 'EM_ANALISE' }),
      },
    })

    return NextResponse.json(sinistro, { status: 201 })
  } catch (error) {
    console.error('Create sinistro error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
