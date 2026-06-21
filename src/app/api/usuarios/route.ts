import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

const VALID_ROLES = ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE', 'CLIENTE']

/**
 * GET /api/usuarios - List users with optional filters
 */
export async function GET(request: Request) {
  const { userId } = extractRequestMeta(request)
  const { authorized } = await checkSuperAdmin(userId, request)
  if (!authorized) {
    return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const role = searchParams.get('role')
    const ativo = searchParams.get('ativo')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { email: { contains: search } },
      ]
    }

    if (role && VALID_ROLES.includes(role)) {
      where.role = role
    }

    if (ativo === 'true') {
      where.ativo = true
    } else if (ativo === 'false') {
      where.ativo = false
    }

    const users = await db.user.findMany({
      where,
      orderBy: { nome: 'asc' },
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

    return NextResponse.json(users)
  } catch (error) {
    console.error('List usuarios error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/usuarios - Create new user
 */
export async function POST(request: Request) {
  const { userId } = extractRequestMeta(request)
  const { authorized } = await checkSuperAdmin(userId, request)
  if (!authorized) {
    return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { nome, email, role, senha } = body

    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres.' }, { status: 422 })
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 422 })
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido.' }, { status: 422 })
    }

    if (!senha || typeof senha !== 'string' || senha.length < 4) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 4 caracteres.' }, { status: 422 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado.' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        nome: sanitizeString(nome),
        email: sanitizeString(email),
        senhaHash: senha,
        role,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        createdAt: true,
      },
    })

    await db.auditLog.create({
      data: {
        entidade: 'User',
        entidadeId: user.id,
        acao: 'CREATE',
        atorId: userId,
        valoresNovos: JSON.stringify({ nome: user.nome, email: user.email, role: user.role }),
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error: unknown) {
    console.error('Create usuario error:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json({ error: 'Email já cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
