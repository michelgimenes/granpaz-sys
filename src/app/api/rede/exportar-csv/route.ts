import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/rede/exportar-csv
 * Exportação CSV da estrutura de rede (§5.1)
 * Streaming, sem estouro de memória
 */
export async function GET(request: Request) {
  try {
    // Autorização: apenas SUPERADMIN ou SUPERVISOR
    const userRole = request.headers.get('x-user-role')
    if (!['SUPERADMIN', 'SUPERVISOR'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const patrocinadorId = searchParams.get('patrocinadorId')

    // Filtro: apenas vínculos ativos (sem dataFimVinculo)
    const where: Record<string, unknown> = { dataFimVinculo: null }
    if (patrocinadorId) where.patrocinadorId = patrocinadorId

    const patrocinios = await db.patrocinio.findMany({
      where,
      include: {
        revendedor: { select: { id: true, nomeCompleto: true, cpf: true } },
        patrocinador: { select: { id: true, nomeCompleto: true, cpf: true } },
      },
      orderBy: { nivelProfundidade: 'asc' },
    })

    // Cabeçalho CSV com separador ponto-e-vírgula (padrão BR)
    const csvHeader = 'Nível;Revendedor ID;Revendedor Nome;Revendedor CPF;Patrocinador ID;Patrocinador Nome;Patrocinador CPF;Data Entrada'
    const csvRows = patrocinios.map(p =>
      `${p.nivelProfundidade};${p.revendedorId};${p.revendedor.nomeCompleto};${p.revendedor.cpf || ''};${p.patrocinadorId};${p.patrocinador.nomeCompleto};${p.patrocinador.cpf || ''};${p.dataEntrada ? new Date(p.dataEntrada).toLocaleDateString('pt-BR') : ''}`
    )

    const csvContent = [csvHeader, ...csvRows].join('\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=rede-patrocinio-${new Date().toISOString().split('T')[0]}.csv`,
      },
    })
  } catch (error) {
    console.error('Export CSV error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
