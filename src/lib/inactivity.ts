/**
 * Utilitário de timeout por inatividade no checkout (§4.3)
 * - 15 min: Toast de aviso
 * - 20 min: Limpa sessionStorage por LGPD
 */

let inactivityTimer: ReturnType<typeof setTimeout> | null = null
let warningTimer: ReturnType<typeof setTimeout> | null = null
let onWarning: (() => void) | null = null
let onTimeout: (() => void) | null = null

// Tempos em milissegundos
const WARNING_MS = 15 * 60 * 1000  // 15 minutos
const TIMEOUT_MS = 20 * 60 * 1000   // 20 minutos

/** Inicia o monitoramento de inatividade */
export function startInactivityTimer(warningCb: () => void, timeoutCb: () => void) {
  onWarning = warningCb
  onTimeout = timeoutCb
  resetInactivityTimer()

  // Escuta atividade do usuário para resetar o timer
  if (typeof window !== 'undefined') {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true })
    })
  }
}

/** Reseta os timers de inatividade (chamado a cada interação) */
export function resetInactivityTimer() {
  if (warningTimer) clearTimeout(warningTimer)
  if (inactivityTimer) clearTimeout(inactivityTimer)

  warningTimer = setTimeout(() => {
    onWarning?.()
  }, WARNING_MS)

  inactivityTimer = setTimeout(() => {
    onTimeout?.()
  }, TIMEOUT_MS)
}

/** Para o monitoramento de inatividade e limpa listeners */
export function stopInactivityTimer() {
  if (warningTimer) clearTimeout(warningTimer)
  if (inactivityTimer) clearTimeout(inactivityTimer)
  onWarning = null
  onTimeout = null

  if (typeof window !== 'undefined') {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => {
      window.removeEventListener(event, resetInactivityTimer)
    })
  }
}
