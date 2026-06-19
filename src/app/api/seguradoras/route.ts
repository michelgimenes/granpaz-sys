import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeMarkdown, sanitizeString } from '@/lib/sanitization'

/**
 * GET /api/seguradoras - List all active seguradoras
 * L17: Basic listing endpoint
 */
export async function GET() {
  try {
    const seguradoras = await db.seguradora.findMany({
      where: { ativa: true },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json(seguradoras)
  } catch (error) {
    console.error('List seguradoras error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/seguradoras - Create new seguradora
 *
 * Lacunas fixed:
 * - L6/RN-04: Sanitize clausulasMarkdown (strip dangerous tags)
 * - L11: Alert if >20% content was sanitized
 * - L17: Create endpoint
 * - L20: SuperAdmin role check
 * - Audit log
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── L20: SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, cnpj, codigoSeguradora, telefoneSinistro, processoSusep, clausulasMarkdown } = body

    // ─── Validate nome ───
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome da seguradora é obrigatório e deve ter pelo menos 2 caracteres.' },
        { status: 422 }
      )
    }

    // ─── Validate cnpj (digits only, 14 digits) ───
    const cnpjDigits = (cnpj || '').replace(/\D/g, '')
    if (!cnpj || cnpjDigits.length !== 14) {
      return NextResponse.json(
        { error: 'CNPJ deve conter exatamente 14 dígitos numéricos.' },
        { status: 422 }
      )
    }

    // ─── Validate codigoSeguradora (regex ^[A-Z0-9]{1,50}$) ───
    if (!codigoSeguradora || typeof codigoSeguradora !== 'string' || !/^[A-Z0-9]{1,50}$/.test(codigoSeguradora)) {
      return NextResponse.json(
        { error: 'Código da seguradora inválido. Use apenas letras maiúsculas e números (até 50 caracteres).' },
        { status: 422 }
      )
    }

    // ─── Validate telefoneSinistro (digits only, 10-11 digits) ───
    const telefoneDigits = (telefoneSinistro || '').replace(/\D/g, '')
    if (!telefoneSinistro || telefoneDigits.length < 10 || telefoneDigits.length > 11) {
      return NextResponse.json(
        { error: 'Telefone de sinistro deve conter DDD + número (10 ou 11 dígitos).' },
        { status: 422 }
      )
    }

    // ─── L6/RN-04: Sanitize clausulasMarkdown ───
    let sanitizedClausulas = clausulasMarkdown || null
    let sanitizationWarning: string | null = null

    if (sanitizedClausulas && typeof sanitizedClausulas === 'string') {
      const result = sanitizeMarkdown(sanitizedClausulas)
      sanitizedClausulas = result.sanitized

      // ─── L11: Alert if >20% content was sanitized ───
      if (result.percentageRemoved > 20) {
        sanitizationWarning = `Atenção: ${result.percentageRemoved.toFixed(1)}% do conteúdo das cláusulas foi removido durante a sanitização por conter elementos potencialmente perigosos.`
      }
    }

    // ─── Create seguradora ───
    const seguradora = await db.seguradora.create({
      data: {
        nome: sanitizeString(nome),
        cnpj: cnpjDigits,
        codigoSeguradora,
        telefoneSinistro: telefoneDigits,
        processoSusep: processoSusep ? sanitizeString(processoSusep) : null,
        clausulasMarkdown: sanitizedClausulas,
      },
    })

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'Seguradora',
        entidadeId: seguradora.id,
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresNovos: JSON.stringify({
          nome: seguradora.nome,
          cnpj: seguradora.cnpj,
          codigoSeguradora: seguradora.codigoSeguradora,
          sanitizationWarning,
        }),
      },
    })

    const response: Record<string, unknown> = {
      success: true,
      seguradora,
    }

    if (sanitizationWarning) {
      response._warning = sanitizationWarning
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error: unknown) {
    console.error('Create seguradora error:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json({ error: 'CNPJ ou código da seguradora já cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
