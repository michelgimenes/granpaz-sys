/**
 * Centralized sanitization per SPEC-01 Section 5.4
 * Backend ALWAYS sanitizes - never trust frontend input
 */

/** CPF/CNPJ → alphanumeric only */
export function sanitizeCPF(cpf: string): string {
  return cpf.replace(/[^a-zA-Z0-9]/g, '')
}

/** Phone → digits only */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** CEP → digits only */
export function sanitizeCEP(cep: string): string {
  return cep.replace(/\D/g, '')
}

/** Strings → trim + remove multiple spaces + remove control chars */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '')
}

/** Email → lowercase + trim */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Sanitize markdown/HTML content per RN-04
 * Removes dangerous HTML tags and attributes that could lead to XSS
 * Returns the sanitized string and the percentage of content removed
 */
export function sanitizeMarkdown(content: string): { sanitized: string; percentageRemoved: number } {
  const originalLength = content.length
  if (originalLength === 0) return { sanitized: '', percentageRemoved: 0 }

  let result = content

  // Remove <script>...</script> tags and content
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  // Remove <iframe>...</iframe> tags and content
  result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')

  // Remove <object>...</object> tags and content
  result = result.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')

  // Remove <embed> tags (self-closing or not)
  result = result.replace(/<embed\b[^>]*\/?>/gi, '')

  // Remove <form>...</form> tags and content
  result = result.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')

  // Remove all on* attributes (onclick, onload, onerror, etc.)
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove javascript: URLs
  result = result.replace(/javascript\s*:/gi, '')

  const percentageRemoved = originalLength > 0
    ? ((originalLength - result.length) / originalLength) * 100
    : 0

  return { sanitized: result, percentageRemoved }
}

/** Sanitize all fields of a pessoa fisica payload */
export function sanitizePessoaFisica(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data }
  if (sanitized.nomeCompleto) sanitized.nomeCompleto = sanitizeString(sanitized.nomeCompleto)
  if (sanitized.cpf) sanitized.cpf = sanitizeCPF(sanitized.cpf)
  if (sanitized.email) sanitized.email = sanitizeEmail(sanitized.email)
  if (sanitized.telefone) sanitized.telefone = sanitizePhone(sanitized.telefone)
  if (sanitized.cep) sanitized.cep = sanitizeCEP(sanitized.cep)
  if (sanitized.profissao) sanitized.profissao = sanitizeString(sanitized.profissao)
  if (sanitized.logradouro) sanitized.logradouro = sanitizeString(sanitized.logradouro)
  if (sanitized.numero) sanitized.numero = sanitizeString(sanitized.numero)
  if (sanitized.complemento) sanitized.complemento = sanitizeString(sanitized.complemento)
  if (sanitized.bairro) sanitized.bairro = sanitizeString(sanitized.bairro)
  if (sanitized.cidade) sanitized.cidade = sanitizeString(sanitized.cidade)
  if (sanitized.estado) sanitized.estado = sanitizeString(sanitized.estado).toUpperCase()
  return sanitized
}
