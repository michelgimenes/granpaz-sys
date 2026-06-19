import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { motivo } = body

    const contrato = await db.contrato.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contrato.status !== 'AGUARDANDO_APROVACAO') {
      return NextResponse.json({ error: 'Contrato não está aguardando aprovação' }, { status: 400 })
    }

    await db.contrato.update({
      where: { id },
      data: {
        status: 'REJEITADO',
        motivoCancelamento: motivo || 'Rejeitado pelo gestor',
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'UPDATE',
        valoresAnteriores: JSON.stringify({ status: 'AGUARDANDO_APROVACAO' }),
        valoresNovos: JSON.stringify({ status: 'REJEITADO', motivo }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rejeitar contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
