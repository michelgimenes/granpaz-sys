import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeMarkdown, sanitizeString } from '@/lib/sanitization'

/**
 * GET /api/seguradoras/[id] - Get a single seguradora
 * Air-Gap de Seguradora (§1.2): Apenas SUPERADMIN pode visualizar seguradora
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Air-Gap de Seguradora (§1.2): Apenas SUPERADMIN pode visualizar seguradora
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    if (!userId || userRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const { id } = await params
    const seguradora = await db.seguradora.findUnique({ where: { id } })

    if (!seguradora || !seguradora.ativa) {
      return NextResponse.json({ error: 'Seguradora não encontrada' }, { status: 404 })
    }

    return NextResponse.json(seguradora)
  } catch (error) {
    console.error('Get seguradora error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PUT /api/seguradoras/[id] - Update a seguradora
 *
 * Lacunas fixed:
 * - L6/RN-04: Sanitize clausulasMarkdown on update
 * - L11: Alert if >20% content was sanitized
 * - L20: SuperAdmin role check
 * - Audit log
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── L20: SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const seguradora = await db.seguradora.findUnique({ where: { id } })

    if (!seguradora) {
      return NextResponse.json({ error: 'Seguradora não encontrada' }, { status: 404 })
    }

    // ─── Validate fields if provided ───
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string' || body.nome.trim().length < 2) {
        return NextResponse.json(
          { error: 'Nome da seguradora deve ter pelo menos 2 caracteres.' },
          { status: 422 }
        )
      }
      updateData.nome = sanitizeString(body.nome)
    }

    if (body.cnpj !== undefined) {
      const cnpjDigits = body.cnpj.replace(/\D/g, '')
      if (cnpjDigits.length !== 14) {
        return NextResponse.json(
          { error: 'CNPJ deve conter exatamente 14 dígitos numéricos.' },
          { status: 422 }
        )
      }
      updateData.cnpj = cnpjDigits
    }

    if (body.codigoSeguradora !== undefined) {
      if (typeof body.codigoSeguradora !== 'string' || !/^[A-Z0-9]{1,50}$/.test(body.codigoSeguradora)) {
        return NextResponse.json(
          { error: 'Código da seguradora inválido. Use apenas letras maiúsculas e números (até 50 caracteres).' },
          { status: 422 }
        )
      }
      updateData.codigoSeguradora = body.codigoSeguradora
    }

    if (body.telefoneSinistro !== undefined) {
      const telefoneDigits = body.telefoneSinistro.replace(/\D/g, '')
      if (telefoneDigits.length < 10 || telefoneDigits.length > 11) {
        return NextResponse.json(
          { error: 'Telefone de sinistro deve conter DDD + número (10 ou 11 dígitos).' },
          { status: 422 }
        )
      }
      updateData.telefoneSinistro = telefoneDigits
    }

    if (body.processoSusep !== undefined) {
      updateData.processoSusep = body.processoSusep ? sanitizeString(body.processoSusep) : null
    }

    // ─── L6/RN-04: Sanitize clausulasMarkdown ───
    let sanitizationWarning: string | null = null

    if (body.clausulasMarkdown !== undefined) {
      if (body.clausulasMarkdown && typeof body.clausulasMarkdown === 'string') {
        const result = sanitizeMarkdown(body.clausulasMarkdown)
        updateData.clausulasMarkdown = result.sanitized

        // ─── L11: Alert if >20% content was sanitized ───
        if (result.percentageRemoved > 20) {
          sanitizationWarning = `Atenção: ${result.percentageRemoved.toFixed(1)}% do conteúdo das cláusulas foi removido durante a sanitização por conter elementos potencialmente perigosos.`
        }
      } else {
        updateData.clausulasMarkdown = null
      }
    }

    // ─── Update seguradora ───
    const updatedSeguradora = await db.seguradora.update({
      where: { id },
      data: updateData,
    })

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'Seguradora',
        entidadeId: id,
        acao: 'UPDATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({
          nome: seguradora.nome,
          cnpj: seguradora.cnpj,
          codigoSeguradora: seguradora.codigoSeguradora,
        }),
        valoresNovos: JSON.stringify(updateData),
      },
    })

    const response: Record<string, unknown> = {
      success: true,
      seguradora: updatedSeguradora,
    }

    if (sanitizationWarning) {
      response._warning = sanitizationWarning
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('Update seguradora error:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json({ error: 'CNPJ ou código da seguradora já cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/seguradoras/[id] - Soft delete (set ativa = false)
 *
 * Lacunas fixed:
 * - L20: SuperAdmin role check
 * - Audit log
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── L20: SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const seguradora = await db.seguradora.findUnique({ where: { id } })

    if (!seguradora) {
      return NextResponse.json({ error: 'Seguradora não encontrada' }, { status: 404 })
    }

    if (!seguradora.ativa) {
      return NextResponse.json({ error: 'Seguradora já está inativa' }, { status: 400 })
    }

    // Check if any active contracts reference this seguradora
    const contratosAtivos = await db.contrato.count({
      where: {
        seguradoraId: id,
        status: { in: ['AGUARDANDO_APROVACAO', 'APROVADO', 'SUSPENSO'] },
      },
    })

    if (contratosAtivos > 0) {
      return NextResponse.json(
        { error: `Não é possível desativar seguradora com ${contratosAtivos} contrato(s) ativo(s).` },
        { status: 400 }
      )
    }

    // ─── Soft delete ───
    await db.seguradora.update({
      where: { id },
      data: { ativa: false, updatedAt: new Date() },
    })

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'Seguradora',
        entidadeId: id,
        acao: 'DELETE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({
          nome: seguradora.nome,
          cnpj: seguradora.cnpj,
          ativa: true,
        }),
        valoresNovos: JSON.stringify({ ativa: false }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete seguradora error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
