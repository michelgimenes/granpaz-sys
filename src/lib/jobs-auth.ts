/**
 * Job authorization utility.
 * 
 * Cron-triggered jobs can authenticate via:
 * 1. x-api-key header matching JOB_API_KEY env (system level)
 * 2. x-user-id + SuperAdmin role (manual trigger by admin)
 */
import { checkSuperAdmin } from './auth-helpers'

export interface JobAuthResult {
  authorized: boolean
  isSystem: boolean
  userId: string | null
}

/**
 * Check if a request is authorized to run system jobs.
 * Returns { authorized, isSystem, userId }.
 */
export async function canRunJob(request: Request): Promise<JobAuthResult> {
  const apiKey = request.headers.get('x-api-key')
  const systemKey = process.env.JOB_API_KEY

  // System-level auth via API key
  if (apiKey && systemKey && apiKey === systemKey) {
    return { authorized: true, isSystem: true, userId: 'system' }
  }

  // User-level auth via SuperAdmin
  const userId = request.headers.get('x-user-id')
  if (userId) {
    const { authorized } = await checkSuperAdmin(userId, request)
    if (authorized) {
      return { authorized: true, isSystem: false, userId }
    }
  }

  return { authorized: false, isSystem: false, userId: null }
}
