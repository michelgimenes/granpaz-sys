import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

const VALID_ROLES = ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE', 'CLIENTE']

/**
 * GET /api/usuarios/[id] - Get user details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = extractRequestMeta(request)
  const { authorized } = await checkSuperAdmin(userId, request)
  if (!authorized) {
    return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
  }

  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        pessoaFisicaId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Get usuario error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/usuarios/[id] - Update user
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = extractRequestMeta(request)
  const { authorized } = await checkSuperAdmin(userId, request)
  if (!authorized) {
    return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { nome, email, role, ativo } = body

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    // EC-01: Auto-desativação bloqueada
    if (id === userId && ativo === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar seu próprio usuário.' },
        { status: 422 }
      )
    }

    if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2)) {
      return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres.' }, { status: 422 })
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'Email inválido.' }, { status: 422 })
      }
      const emailConflict = await db.user.findFirst({
        where: { email, id: { not: id } },
      })
      if (emailConflict) {
        return NextResponse.json({ error: 'Email já cadastrado por outro usuário.' }, { status: 409 })
      }
    }

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido.' }, { status: 422 })
    }

    const data: Record<string, unknown> = {}
    if (nome !== undefined) data.nome = sanitizeString(nome)
    if (email !== undefined) data.email = sanitizeString(email)
    if (role !== undefined) data.role = role
    if (ativo !== undefined) data.ativo = ativo

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        pessoaFisicaId: true,
        createdAt: true,
      },
    })

    await db.auditLog.create({
      data: {
        entidade: 'User',
        entidadeId: id,
        acao: 'UPDATE',
        atorId: userId,
        valoresAnteriores: JSON.stringify({
          nome: existing.nome,
          email: existing.email,
          role: existing.role,
          ativo: existing.ativo,
        }),
        valoresNovos: JSON.stringify(updated),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update usuario error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
