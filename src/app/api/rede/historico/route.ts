import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/rede/historico
 * List patrocínio history for a revendedor
 *
 * Query param: revendedor_id (required)
 *
 * Returns ALL patrocínios (active and inactive) for this revendedor
 * Each entry: patrocinadorId, patrocinadorNome, nivelProfundidade, dataEntrada, dataFimVinculo, motivoRealocacao
 * Ordered by dataEntrada DESC
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const revendedorId = searchParams.get('revendedor_id')

    if (!revendedorId) {
      return NextResponse.json(
        { error: 'revendedor_id é obrigatório.' },
        { status: 400 }
      )
    }

    // Validate revendedor exists
    const revendedor = await db.pessoaFisica.findUnique({
      where: { id: revendedorId },
      select: { id: true, nomeCompleto: true, cpf: true },
    })
    if (!revendedor) {
      return NextResponse.json({ error: 'Revendedor não encontrado.' }, { status: 404 })
    }

    // Get ALL patrocínios for this revendedor (active + inactive)
    const historico = await db.patrocinio.findMany({
      where: { revendedorId },
      include: {
        patrocinador: {
          select: { id: true, nomeCompleto: true, cpf: true },
        },
      },
      orderBy: { dataEntrada: 'desc' },
    })

    const resultado = historico.map(p => ({
      id: p.id,
      patrocinadorId: p.patrocinadorId,
      patrocinadorNome: p.patrocinador.nomeCompleto,
      patrocinadorCpf: p.patrocinador.cpf,
      nivelProfundidade: p.nivelProfundidade,
      dataEntrada: p.dataEntrada,
      dataFimVinculo: p.dataFimVinculo,
      motivoRealocacao: p.motivoRealocacao,
      ativo: p.dataFimVinculo === null,
    }))

    return NextResponse.json({
      revendedor: {
        id: revendedor.id,
        nomeCompleto: revendedor.nomeCompleto,
        cpf: revendedor.cpf,
      },
      historico: resultado,
      total: resultado.length,
      ativos: resultado.filter(h => h.ativo).length,
      realocacoes: resultado.filter(h => !h.ativo).length,
    })
  } catch (error) {
    console.error('Historico query error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
