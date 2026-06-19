/**
 * Rate Limiting para APIs públicas (SPEC-07 EC-02 / §5.2)
 * Limite: 10 req/min por IP para escrita, 100 req/s por IP para leitura
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// Limpeza de entradas expiradas a cada 60 segundos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key)
    }
  }
}, 60_000)

export interface RateLimitOptions {
  /** Número máximo de requisições por janela */
  maxRequests: number
  /** Duração da janela em milissegundos */
  windowMs: number
}

/**
 * Verifica se a requisição deve ser limitada por rate limiting.
 * Retorna { allowed, remaining, resetTime }
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || now > entry.resetTime) {
    // Nova janela de tempo
    const resetTime = now + options.windowMs
    store.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: options.maxRequests - 1, resetTime }
  }

  if (entry.count >= options.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count++
  return { allowed: true, remaining: options.maxRequests - entry.count, resetTime: entry.resetTime }
}

/**
 * Obtém o IP do cliente a partir dos headers da requisição
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
