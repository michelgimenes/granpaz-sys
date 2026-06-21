import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

function gerarSenha(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < length; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return senha
}

/**
 * POST /api/usuarios/[id]/reset-senha - Reset user password
 */
export async function POST(
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

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const novaSenha = gerarSenha(10)

    await db.user.update({
      where: { id },
      data: { senhaHash: novaSenha },
    })

    await db.auditLog.create({
      data: {
        entidade: 'User',
        entidadeId: id,
        acao: 'UPDATE',
        atorId: userId,
        valoresAnteriores: JSON.stringify({ senhaHash: '(oculto)' }),
        valoresNovos: JSON.stringify({ senhaHash: '(resetado)' }),
      },
    })

    return NextResponse.json({ novaSenha })
  } catch (error) {
    console.error('Reset senha error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
