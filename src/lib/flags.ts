/**
 * Feature flags (SPEC-06 §3.5).
 * 
 * Flags are stored in ConfiguracaoRegraNegocio and follow the
 * FEATURE_FLAG_<NOME> pattern with value 'true'/'false'.
 * 
 * To add a new flag:
 * 1. Add a constant below
 * 2. Create a ConfiguracaoRegraNegocio row with chave = FEATURE_FLAG_<NOME>
 *    via the API or seed
 */

import { getConfigBool } from './validations'

// ─── Available feature flags ───
export const FEATURE_FLAGS = {
  EXPORTAR_CSV: 'FEATURE_FLAG_EXPORTAR_CSV',
  BONIFICACAO_AUTO: 'FEATURE_FLAG_BONIFICACAO_AUTO',
  NOTIFICACAO_WEBHOOK: 'FEATURE_FLAG_NOTIFICACAO_WEBHOOK',
  REDE_COMPLETA: 'FEATURE_FLAG_REDE_COMPLETA',
  AUDITORIA_CONTINUA: 'FEATURE_FLAG_AUDITORIA_CONTINUA',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature flag is enabled.
 * Returns true by default (fail-open) or false if explicitly disabled.
 */
export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const chave = FEATURE_FLAGS[flag]
  if (!chave) return false
  try {
    return await getConfigBool(chave)
  } catch {
    return false
  }
}

/**
 * Check multiple flags at once.
 */
export async function getFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  const entries = await Promise.all(
    (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map(async (flag) => [
      flag,
      await isFeatureEnabled(flag),
    ])
  )
  return Object.fromEntries(entries) as Record<FeatureFlag, boolean>
}
