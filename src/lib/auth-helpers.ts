/**
 * Authentication and authorization helpers
 * Centralizes role-based access control checks
 */
import { db } from '@/lib/db'

/**
 * Check if a user is an active SuperAdmin
 * Used for protecting administrative endpoints
 * Supports role override via x-user-role header (for dev profile switching)
 */
export async function checkSuperAdmin(userId: string | null, request?: Request): Promise<{ authorized: boolean; user: any }> {
  if (!userId) return { authorized: false, user: null }

  // Se recebeu request, verifica header x-user-role primeiro
  if (request) {
    const headerRole = request.headers.get('x-user-role')
    const dbUser = await db.user.findUnique({ where: { id: userId } })
    if (!dbUser || !dbUser.ativo) return { authorized: false, user: null }
    if (headerRole === 'SUPERADMIN') return { authorized: true, user: dbUser }
    if (headerRole && headerRole !== 'SUPERADMIN') return { authorized: false, user: null }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== 'SUPERADMIN' || !user.ativo) return { authorized: false, user: null }
  return { authorized: true, user }
}

/**
 * Check if a user is an active SuperAdmin OR FINANCEIRO
 * Used for financial operations that require Maker/Checker approval
 * Supports role override via x-user-role header (for dev profile switching)
 */
export async function checkFinanceiroOrAdmin(userId: string | null, request?: Request): Promise<{ authorized: boolean; user: any }> {
  if (!userId) return { authorized: false, user: null }

  // Se recebeu request, verifica header x-user-role primeiro
  if (request) {
    const headerRole = request.headers.get('x-user-role')
    const dbUser = await db.user.findUnique({ where: { id: userId } })
    if (!dbUser || !dbUser.ativo) return { authorized: false, user: null }
    if (headerRole === 'SUPERADMIN' || headerRole === 'FINANCEIRO') return { authorized: true, user: dbUser }
    if (headerRole) return { authorized: false, user: null }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.ativo) return { authorized: false, user: null }
  if (user.role !== 'SUPERADMIN' && user.role !== 'FINANCEIRO') return { authorized: false, user: null }
  return { authorized: true, user }
}

/**
 * Check if authenticated user is the owner of a resource or has admin role
 * Used for client-scoped data access (CLIENTE can only see own data)
 * Supports role override via x-user-role header (for dev profile switching)
 */
export async function checkOwnership(
  request: Request,
  resourcePessoaFisicaId: string
): Promise<{ authorized: boolean; user: any }> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return { authorized: false, user: null }

  const headerRole = request.headers.get('x-user-role')
  const dbUser = await db.user.findUnique({ where: { id: userId } })
  if (!dbUser || !dbUser.ativo) return { authorized: false, user: null }

  // SuperAdmin/Supervisor/Financeiro/Suporte podem acessar qualquer recurso
  const adminRoles = ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE']
  if (headerRole && adminRoles.includes(headerRole)) return { authorized: true, user: dbUser }
  if (!headerRole && adminRoles.includes(dbUser.role)) return { authorized: true, user: dbUser }

  // CLIENTE só pode acessar seus próprios dados
  if (dbUser.pessoaFisicaId === resourcePessoaFisicaId) return { authorized: true, user: dbUser }

  // CLIENTE pode editar dados de seus vinculados (dependentes/agregados/sub-dependentes)
  const resource = await db.pessoaFisica.findUnique({
    where: { id: resourcePessoaFisicaId },
    select: { titularRaizId: true },
  })
  if (resource?.titularRaizId === dbUser.pessoaFisicaId) return { authorized: true, user: dbUser }

  return { authorized: false, user: null }
}

/**
 * Extract user ID and IP address from request headers
 */
export function extractRequestMeta(request: Request): { userId: string | null; ipAddress: string | null } {
  const userId = request.headers.get('x-user-id')
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  return { userId, ipAddress }
}
