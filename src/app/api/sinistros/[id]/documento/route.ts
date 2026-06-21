import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkFinanceiroOrAdmin, checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { storeDocument, getDocument, computeSHA256, deleteDocument } from '@/lib/s3'

/**
 * POST /api/sinistros/[id]/documento
 * Upload a document for a sinistro (Air-Gap RN-01 compliant).
 * 
 * Only SHA-256 hash is stored in the database — no clinical data.
 * Accepts multipart/form-data with field 'file'.
 * Max file size: 10MB.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    const { authorized } = await checkFinanceiroOrAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const sinistro = await db.sinistro.findUnique({ where: { id } })
    if (!sinistro) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }
    if (sinistro.status !== 'EM_ANALISE') {
      return NextResponse.json({ error: 'Sinistro não está em análise.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const doc = await storeDocument(buffer, file.name, file.type)

    // Update sinistro with S3 hash
    await db.sinistro.update({
      where: { id },
      data: {
        documentoS3Hash: doc.key,
        updatedAt: new Date(),
      },
    })

    await db.auditLog.create({
      data: {
        entidade: 'Sinistro',
        entidadeId: id,
        acao: 'DOCUMENTO_UPLOAD',
        atorId: userId,
        ipAddress,
        valoresNovos: JSON.stringify({
          documentoS3Hash: doc.key,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
        }),
        observacao: `Documento enviado para sinistro ${id}. Hash SHA-256: ${doc.key}`,
      },
    })

    return NextResponse.json({
      message: 'Documento enviado com sucesso.',
      documentoS3Hash: doc.key,
      originalName: doc.originalName,
      size: doc.size,
      mimeType: doc.mimeType,
    })
  } catch (error) {
    console.error('Upload sinistro documento error:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/sinistros/[id]/documento
 * Retrieve the stored document for a sinistro.
 * Returns the file with appropriate Content-Type.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = extractRequestMeta(request)

    const { authorized } = await checkFinanceiroOrAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const sinistro = await db.sinistro.findUnique({
      where: { id },
      select: { documentoS3Hash: true },
    })
    if (!sinistro) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }
    if (!sinistro.documentoS3Hash) {
      return NextResponse.json({ error: 'Nenhum documento associado a este sinistro.' }, { status: 404 })
    }

    const doc = await getDocument(sinistro.documentoS3Hash)
    if (!doc) {
      return NextResponse.json({ error: 'Documento não encontrado no storage.' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(doc.buffer), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${doc.originalName}"`,
        'X-SHA256-Hash': sinistro.documentoS3Hash,
      },
    })
  } catch (error) {
    console.error('Get sinistro documento error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/sinistros/[id]/documento
 * Remove the stored document for a sinistro.
 * SuperAdmin only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado. Apenas SuperAdmin.' }, { status: 403 })
    }

    const sinistro = await db.sinistro.findUnique({
      where: { id },
      select: { documentoS3Hash: true },
    })
    if (!sinistro) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }

    const oldHash = sinistro.documentoS3Hash
    if (!oldHash) {
      return NextResponse.json({ error: 'Nenhum documento para remover.' }, { status: 404 })
    }

    await deleteDocument(oldHash)

    await db.sinistro.update({
      where: { id },
      data: { documentoS3Hash: null, updatedAt: new Date() },
    })

    await db.auditLog.create({
      data: {
        entidade: 'Sinistro',
        entidadeId: id,
        acao: 'DELETE',
        atorId: userId,
        ipAddress,
        valoresAnteriores: JSON.stringify({ documentoS3Hash: oldHash }),
        observacao: `Documento removido do sinistro ${id}. Hash: ${oldHash}`,
      },
    })

    return NextResponse.json({ message: 'Documento removido com sucesso.' })
  } catch (error) {
    console.error('Delete sinistro documento error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
