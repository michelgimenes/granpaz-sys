import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { pessoaFisica: true },
    })

    if (!user || !user.ativo) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Dev: simple hash comparison
    // In production, use bcrypt/argon2 via NextAuth
    const expectedHash = user.role === 'SUPERADMIN'
      ? 'dev_hash_granpaz_admin_2024'
      : 'dev_hash_granpaz_cliente_2024'

    if (password !== 'granpaz2024' && user.senhaHash !== password) {
      // Allow dev password or direct hash match
      if (user.senhaHash !== expectedHash && password !== user.senhaHash) {
        return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
      }
    }

    // Return user without sensitive data
    const { senhaHash: _, ...safeUser } = user
    return NextResponse.json({ user: safeUser })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
