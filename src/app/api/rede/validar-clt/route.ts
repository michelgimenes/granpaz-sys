import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/rede/validar-clt
 * Air-Gap Funcional validation (RN-04)
 *
 * Validates a given request body/object for CLT-related terms.
 * This is a utility endpoint that the frontend and other APIs can use.
 *
 * Prohibited terms (case-insensitive):
 * meta, horario, ponto, chefe, salario, salário, subordinação, subordinacao,
 * supervisor_funcional, desempenho, avaliacao, avaliação, ferias, férias,
 * contrato_trabalho, clt, empregado, empregador, jornada, carga_horaria
 *
 * Returns: { valid: boolean, violations: string[] }
 */

const CLT_PROHIBITED_TERMS = [
  'meta',
  'horario',
  'ponto',
  'chefe',
  'salario',
  'salário',
  'subordinação',
  'subordinacao',
  'supervisor_funcional',
  'desempenho',
  'avaliacao',
  'avaliação',
  'ferias',
  'férias',
  'contrato_trabalho',
  'clt',
  'empregado',
  'empregador',
  'jornada',
  'carga_horaria',
]

/**
 * Recursively check an object's keys and string values for prohibited terms
 */
function findViolations(obj: unknown, path: string = ''): string[] {
  const violations: string[] = []

  if (obj === null || obj === undefined) return violations

  if (typeof obj === 'string') {
    const lowerVal = obj.toLowerCase()
    for (const term of CLT_PROHIBITED_TERMS) {
      if (lowerVal.includes(term.toLowerCase())) {
        violations.push(`${path ? path + ': ' : ''}valor contém termo proibido "${term}"`)
      }
    }
    return violations
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') return violations

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      violations.push(...findViolations(obj[i], `${path}[${i}]`))
    }
    return violations
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    for (const [key, value] of entries) {
      // Check key itself for prohibited terms
      const lowerKey = key.toLowerCase()
      for (const term of CLT_PROHIBITED_TERMS) {
        if (lowerKey.includes(term.toLowerCase())) {
          violations.push(`campo "${key}" contém termo proibido "${term}"`)
        }
      }
      // Recursively check value
      violations.push(...findViolations(value, path ? `${path}.${key}` : key))
    }
  }

  return violations
}

export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. JSON esperado.' },
        { status: 400 }
      )
    }

    const violations = findViolations(body)
    const valid = violations.length === 0

    // Log audit if violations found (potential injection attempt)
    if (!valid) {
      await db.auditLog.create({
        data: {
          entidade: 'ValidacaoCLT',
          entidadeId: 'CLT_CHECK',
          acao: 'VIOLACAO_CLT',
          atorId: userId,
          ipAddress: ipAddress || null,
          observacao: `Validação CLT detectou ${violations.length} violação(ões): ${violations.slice(0, 5).join('; ')}${violations.length > 5 ? '...' : ''}`,
          valoresNovos: JSON.stringify({ violations }),
        },
      })
    }

    return NextResponse.json({
      valid,
      violations,
    })
  } catch (error) {
    console.error('Validar CLT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
