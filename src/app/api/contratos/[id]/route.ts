import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/contratos/[id]
 * Get a single contract with full related data including vinculos and dadosAprovacao
 */
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

    // Also get vinculos for the titular (including inactive ones for endosso history)
    const vinculos = await db.vinculo.findMany({
      where: { titularRaizId: contrato.titularId },
      include: { pessoaVinculada: true },
    })

    return NextResponse.json({ ...contrato, vinculos })
  } catch (error) {
    console.error('Get contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/contratos/[id]
 * Update a contract with immutability protection (RN-03)
 *
 * Lacunas fixed:
 * - L5/RN-03: Financial fields are immutable post-approval
 * - Optimistic concurrency via updatedAt
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Fetch current contrato for immutability check
    const contrato = await db.contrato.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    // ─── L5/RN-03: Financial fields immutability check ───
    const FINANCIAL_FIELDS = [
      'capital_segurado_informado',
      'codigo_seguradora_informado',
      'valorParcelaBase',
      'valorTaxaAdesao',
      'seguradoraId',
      'dataInicio',
    ]

    if (contrato.status === 'APROVADO') {
      const attemptedFields = FINANCIAL_FIELDS.filter(field => field in body)
      if (attemptedFields.length > 0) {
        return NextResponse.json(
          { error: 'Campos financeiros são imutáveis pós-aprovação. Use fluxo de endosso.', fields: attemptedFields },
          { status: 403 }
        )
      }
    }

    // Remove fields that should never be directly updated via PATCH
    delete body.id
    delete body.createdAt

    // Add updatedAt for optimistic concurrency
    body.updatedAt = new Date()

    const updatedContrato = await db.contrato.update({
      where: { id },
      data: body,
      include: {
        titular: { select: { id: true, nomeCompleto: true, cpf: true } },
        plano: true,
        seguradora: true,
        dadosAprovacao: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: id,
        acao: 'UPDATE',
        atorId: request.headers.get('x-user-id'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresAnteriores: JSON.stringify({ status: contrato.status, updatedAt: contrato.updatedAt }),
        valoresNovos: JSON.stringify(body),
      },
    })

    return NextResponse.json(updatedContrato)
  } catch (error) {
    console.error('Update contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
