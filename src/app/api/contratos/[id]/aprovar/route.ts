import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { capitalSegurado, codigoSeguradora, seguradoraId, observacoes, adminAprovadorId } = body

    const contrato = await db.contrato.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contrato.status !== 'AGUARDANDO_APROVACAO') {
      return NextResponse.json({ error: 'Contrato não está aguardando aprovação' }, { status: 400 })
    }

    // Update contract status
    await db.contrato.update({
      where: { id },
      data: {
        status: 'APROVADO',
        seguradoraId: seguradoraId || null,
        dataInicio: new Date(),
      },
    })

    // Create or update approval data
    await db.dadosAprovacaoSeguradora.upsert({
      where: { contratoId: id },
      update: {
        capitalSeguradoInformado: capitalSegurado || null,
        codigoSeguradoraInformado: codigoSeguradora || null,
        adminAprovadorId: adminAprovadorId || null,
        dataAprovacao: new Date(),
        observacoesGestor: observacoes || null,
      },
      create: {
        contratoId: id,
        capitalSeguradoInformado: capitalSegurado || null,
        codigoSeguradoraInformado: codigoSeguradora || null,
        adminAprovadorId: adminAprovadorId || null,
        dataAprovacao: new Date(),
        observacoesGestor: observacoes || null,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'APROVACAO',
        valoresAnteriores: JSON.stringify({ status: 'AGUARDANDO_APROVACAO' }),
        valoresNovos: JSON.stringify({ status: 'APROVADO', seguradoraId, capitalSegurado }),
      },
    })

    // Create wallet for titular if not exists
    const existingWallet = await db.carteiraDigital.findUnique({
      where: { titularId: contrato.titularId },
    })
    if (!existingWallet) {
      await db.carteiraDigital.create({
        data: { titularId: contrato.titularId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Aprovar contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
