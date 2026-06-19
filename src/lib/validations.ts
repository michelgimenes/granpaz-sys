/**
 * Business rule validations per SPEC-01 RN-01 through RN-06
 * These run on the backend as the source of truth
 */
import { db } from '@/lib/db'

// Age limit config keys per tipo_registro and parentesco
const AGE_CONFIG_KEYS: Record<string, string> = {
  TITULAR: 'IDADE_LIMITE_TITULAR',
  DEPENDENTE_CONJUGE: 'IDADE_LIMITE_CONJUGE',
  DEPENDENTE_FILHO: 'IDADE_COBERTURA_FILHO',  // coverage age for FILHO
  DEPENDENTE_FILHO_LIMITE: 'IDADE_LIMITE_DEPENDENTE',
  AGREGADO: 'IDADE_LIMITE_AGREGADO',
  SUB_DEPENDENTE_CONJUGE: 'IDADE_LIMITE_SUB_DEPENDENTE',
  SUB_DEPENDENTE_FILHO: 'IDADE_COBERTURA_SUB_FILHO',
  SUB_DEPENDENTE_FILHO_LIMITE: 'IDADE_LIMITE_SUB_DEPENDENTE',
}

export async function getConfigValue(chave: string): Promise<string | null> {
  const config = await db.configuracaoRegraNegocio.findUnique({ where: { chave } })
  return config?.valor ?? null
}

export async function getConfigInt(chave: string): Promise<number> {
  const val = await getConfigValue(chave)
  return val ? parseInt(val, 10) : 0
}

export async function getConfigBool(chave: string): Promise<boolean> {
  const val = await getConfigValue(chave)
  return val === 'true'
}

/**
 * RN-01: Check if titular already has an active contract
 * Returns true if an active contract exists (blocking condition)
 */
export async function checkContratoAtivoPorTitular(titularId: string): Promise<boolean> {
  const existing = await db.contrato.findFirst({
    where: {
      titularId,
      status: { in: ['AGUARDANDO_APROVACAO', 'APROVADO', 'SUSPENSO'] }
    }
  })
  return !!existing
}

/**
 * RN-02: Validate age against configuracoes_regras_negocio
 * Returns { valid: boolean, coverageTag: boolean, message: string }
 * coverageTag = true means "SEM DIREITO À PROTEÇÃO" (RN-06)
 */
export async function validateAge(
  dataNascimento: Date,
  tipoRegistro: string,
  parentesco: string
): Promise<{ valid: boolean; coverageTag: boolean; message: string }> {
  const hoje = new Date()
  const idade = Math.floor(
    (hoje.getTime() - dataNascimento.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )

  // Determine which config key to use
  let configKey = ''
  let coverageKey = ''
  let limitKey = ''

  if (tipoRegistro === 'TITULAR') {
    configKey = AGE_CONFIG_KEYS.TITULAR
  } else if (tipoRegistro === 'DEPENDENTE') {
    if (parentesco === 'CONJUGE') {
      configKey = AGE_CONFIG_KEYS.DEPENDENTE_CONJUGE
    } else if (parentesco === 'FILHO') {
      coverageKey = AGE_CONFIG_KEYS.DEPENDENTE_FILHO
      limitKey = AGE_CONFIG_KEYS.DEPENDENTE_FILHO_LIMITE
    } else {
      configKey = AGE_CONFIG_KEYS.DEPENDENTE_FILHO_LIMITE
    }
  } else if (tipoRegistro === 'AGREGADO') {
    configKey = AGE_CONFIG_KEYS.AGREGADO
  } else if (tipoRegistro === 'SUB_DEPENDENTE') {
    if (parentesco === 'FILHO') {
      coverageKey = AGE_CONFIG_KEYS.SUB_DEPENDENTE_FILHO
      limitKey = AGE_CONFIG_KEYS.SUB_DEPENDENTE_FILHO_LIMITE
    } else {
      configKey = AGE_CONFIG_KEYS.SUB_DEPENDENTE_CONJUGE
    }
  }

  // For FILHO: check coverage vs limit (RN-06)
  if (coverageKey && limitKey) {
    const coverageAge = await getConfigInt(coverageKey)
    const limitAge = await getConfigInt(limitKey)

    if (idade > limitAge) {
      return { valid: false, coverageTag: false, message: `Idade ${idade} excede o limite de ${limitAge} anos para ${tipoRegistro} ${parentesco}.` }
    }
    if (idade > coverageAge) {
      return { valid: true, coverageTag: true, message: `SEM DIREITO À PROTEÇÃO: Idade ${idade} excede cobertura de ${coverageAge} anos, mas dentro do limite de cadastro (${limitAge} anos).` }
    }
    return { valid: true, coverageTag: false, message: '' }
  }

  // Standard limit check
  if (configKey) {
    const limite = await getConfigInt(configKey)
    if (idade > limite) {
      return { valid: false, coverageTag: false, message: `Idade ${idade} excede o limite de ${limite} anos para ${tipoRegistro}.` }
    }
  }

  return { valid: true, coverageTag: false, message: '' }
}

/**
 * RN-03: Validate sub-dependente eligibility
 * agregadoPai must be AGREGADO with estado_civil IN ('CASADO', 'UNIAO_ESTAVEL')
 */
export async function validateSubDependenteEligibility(agregadoPaiId: string): Promise<{ valid: boolean; message: string }> {
  const agregado = await db.pessoaFisica.findUnique({ where: { id: agregadoPaiId } })
  if (!agregado) {
    return { valid: false, message: 'Agregado pai não encontrado.' }
  }
  if (agregado.tipoRegistro !== 'AGREGADO') {
    return { valid: false, message: 'O vínculo pai deve ser um Agregado.' }
  }
  if (!['CASADO', 'UNIAO_ESTAVEL'].includes(agregado.estadoCivil)) {
    return { valid: false, message: 'Agregados individuais não podem possuir sub-dependentes. O agregado deve ser casado ou em união estável.' }
  }
  return { valid: true, message: '' }
}

/**
 * RN-05: Check if plan allows dependents
 */
export async function validatePlanoPermiteDependentes(planoId: string): Promise<{ permite: boolean; maxDependentes: number; maxAgregados: number }> {
  const plano = await db.plano.findUnique({ where: { id: planoId } })
  if (!plano) return { permite: false, maxDependentes: 0, maxAgregados: 0 }
  return {
    permite: plano.tipo === 'FAMILIAR',
    maxDependentes: plano.maxDependentes,
    maxAgregados: plano.maxAgregados,
  }
}

/**
 * Validate parentesco is allowed for tipo_vinculo
 */
export function validateParentescoPorTipo(tipoVinculo: string, parentesco: string): { valid: boolean; message: string } {
  const DEPENDENTE_ALLOWED = ['CONJUGE', 'FILHO']
  const SUB_DEPENDENTE_ALLOWED = ['CONJUGE', 'FILHO']
  const AGREGADO_ALLOWED = ['CONJUGE', 'FILHO', 'PAI_MAE', 'SOGRO', 'ENTREADO', 'NETO', 'AVO', 'IRMAO', 'TIO']

  let allowed: string[] = []
  if (tipoVinculo === 'DEPENDENTE') allowed = DEPENDENTE_ALLOWED
  else if (tipoVinculo === 'SUB_DEPENDENTE') allowed = SUB_DEPENDENTE_ALLOWED
  else if (tipoVinculo === 'AGREGADO') allowed = AGREGADO_ALLOWED

  if (!allowed.includes(parentesco)) {
    return { valid: false, message: `Parentesco '${parentesco}' inválido para tipo de vínculo '${tipoVinculo}'. Permitidos: ${allowed.join(', ')}` }
  }
  return { valid: true, message: '' }
}

/**
 * Validate field formats per SPEC-01 Section 4.5
 */
export function validateFieldFormats(data: Record<string, any>): string[] {
  const errors: string[] = []

  if (data.cpf) {
    const cpfDigits = data.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) errors.push('CPF deve ter 11 dígitos.')
    if (/^(\d)\1{10}$/.test(cpfDigits)) errors.push('CPF inválido.')
  }

  if (data.email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(data.email)) errors.push('Formato de e-mail inválido.')
  }

  if (data.telefone) {
    const phoneDigits = data.telefone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.push('Telefone deve conter DDD + Número (10 ou 11 dígitos).')
  }

  if (data.cep) {
    const cepDigits = data.cep.replace(/\D/g, '')
    if (cepDigits.length !== 8) errors.push('CEP inválido.')
  }

  return errors
}
