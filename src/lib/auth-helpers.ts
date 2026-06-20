/**
 * Authentication and authorization helpers
 * Centralizes role-based access control checks
 */
import { db } from '@/lib/db'

/**
 * Check if a user is an active SuperAdmin
 * Used for protecting administrative endpoints
 */
export async function checkSuperAdmin(userId: string | null): Promise<{ authorized: boolean; user: any }> {
  if (!userId) return { authorized: false, user: null }
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== 'SUPERADMIN' || !user.ativo) return { authorized: false, user: null }
  return { authorized: true, user }
}

/**
 * Check if a user is an active SuperAdmin OR FINANCEIRO
 * Used for financial operations that require Maker/Checker approval
 */
export async function checkFinanceiroOrAdmin(userId: string | null): Promise<{ authorized: boolean; user: any }> {
  if (!userId) return { authorized: false, user: null }
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.ativo) return { authorized: false, user: null }
  if (user.role !== 'SUPERADMIN' && user.role !== 'FINANCEIRO') return { authorized: false, user: null }
  return { authorized: true, user }
}

/**
 * Extract user ID and IP address from request headers
 */
export function extractRequestMeta(request: Request): { userId: string | null; ipAddress: string | null } {
  const userId = request.headers.get('x-user-id')
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  return { userId, ipAddress }
}
