import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/carteiras/[carteiraId]/extrato
 * Get wallet statement (extrato) with filters and pagination
 *
 * Features:
 * - Filter by tipo (bonificacao, pagamento, todos)
 * - Filter by date range (data_inicio, data_fim)
 * - Pagination (page, limit)
 * - Returns combined list from transacoes_bonificacao and transacoes_pagamento
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ carteiraId: string }> }
) {
  try {
    const { carteiraId } = await params
    const { searchParams } = new URL(request.url)

    // ─── Validate carteira exists ───
    const carteira = await db.carteiraDigital.findUnique({
      where: { id: carteiraId },
      include: { titular: { select: { id: true, nomeCompleto: true, cpf: true } } },
    })

    if (!carteira) {
      return NextResponse.json({ error: 'Carteira digital não encontrada.' }, { status: 404 })
    }

    // ─── Pagination ───
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // ─── Filters ───
    const tipo = searchParams.get('tipo') || 'todos' // bonificacao, pagamento, todos
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')

    const dataInicioFilter = dataInicio ? new Date(dataInicio) : undefined
    const dataFimFilter = dataFim ? new Date(dataFim) : undefined

    type ExtratoItem = {
      id: string
      tipo: string
      valor: number
      status: string
      data: Date
      descricao: string
    }

    const items: ExtratoItem[] = []

    // ─── Fetch bonificações ───
    if (tipo === 'todos' || tipo === 'bonificacao') {
      const bonificacaoWhere: Record<string, unknown> = { carteiraId }
      if (dataInicioFilter || dataFimFilter) {
        bonificacaoWhere.createdAt = {}
        if (dataInicioFilter) (bonificacaoWhere.createdAt as Record<string, unknown>).gte = dataInicioFilter
        if (dataFimFilter) (bonificacaoWhere.createdAt as Record<string, unknown>).lte = dataFimFilter
      }

      const bonificacoes = await db.transacaoBonificacao.findMany({
        where: bonificacaoWhere,
        include: {
          origemContrato: {
            select: { id: true, titular: { select: { nomeCompleto: true } } },
          },
        },
      })

      for (const bon of bonificacoes) {
        items.push({
          id: bon.id,
          tipo: 'bonificacao',
          valor: bon.valor,
          status: bon.status,
          data: bon.createdAt,
          descricao: `Bonificação Nível ${bon.nivelOrigem} (${bon.percentualAplicado}%) — Contrato de ${bon.origemContrato.titular.nomeCompleto}`,
        })
      }
    }

    // ─── Fetch pagamentos ───
    if (tipo === 'todos' || tipo === 'pagamento') {
      const pagamentoWhere: Record<string, unknown> = { carteiraId }
      if (dataInicioFilter || dataFimFilter) {
        pagamentoWhere.dataTransacao = {}
        if (dataInicioFilter) (pagamentoWhere.dataTransacao as Record<string, unknown>).gte = dataInicioFilter
        if (dataFimFilter) (pagamentoWhere.dataTransacao as Record<string, unknown>).lte = dataFimFilter
      }

      const pagamentos = await db.transacaoPagamento.findMany({
        where: pagamentoWhere,
        include: {
          contaAPagar: { select: { descricao: true } },
        },
      })

      for (const pag of pagamentos) {
        let descricao = ''
        if (pag.tipoTransacao === 'ABATIMENTO') {
          descricao = `Abatimento — ${pag.contaAPagar?.descricao || 'Conta a pagar'}`
        } else if (pag.tipoTransacao === 'SAQUE') {
          descricao = `Saque (Líquido: R$ ${(pag.valorLiquido ?? 0).toFixed(2)})`
        }
        items.push({
          id: pag.id,
          tipo: 'pagamento',
          valor: pag.valorAbatido,
          status: pag.status,
          data: pag.dataTransacao,
          descricao,
        })
      }
    }

    // ─── Sort by date descending ───
    items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    // ─── Paginate ───
    const total = items.length
    const totalPages = Math.ceil(total / limit)
    const skip = (page - 1) * limit
    const paginatedItems = items.slice(skip, skip + limit)

    // Serialize dates
    const serialized = paginatedItems.map(item => ({
      ...item,
      data: new Date(item.data).toISOString(),
    }))

    return NextResponse.json({
      data: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Extrato error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
