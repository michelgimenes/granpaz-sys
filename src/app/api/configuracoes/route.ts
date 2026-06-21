import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

// ─────────────────────────────────────────────────────────
// CLT Air-Gap prohibited terms (RN-04)
// ─────────────────────────────────────────────────────────
const CLT_PROHIBITED_TERMS_REGEX =
  /\b(meta|horario|horário|ponto|chefe|salario|salário|clt|empregado|empregador|jornada|carga_horaria|desempenho|avaliação|avaliacao|ferias|férias|contrato_trabalho|subordinação|subordinacao|supervisor_funcional)\b/i

// ─────────────────────────────────────────────────────────
// Critical keys requiring Maker/Checker confirmation (EC-06)
// ─────────────────────────────────────────────────────────
const CRITICAL_KEYS = new Set([
  'PREVALENCIA_APIOLICE_SOBRE_CONFIG',
  'HASH_ASSINATURA_PDF_SALT',
])

// ─────────────────────────────────────────────────────────
// Range validation helpers
// ─────────────────────────────────────────────────────────
function validateRange(chave: string, tipoParse: string, valor: string): string | null {
  if (tipoParse === 'INT') {
    const num = parseInt(valor, 10)
    if (isNaN(num)) return 'Valor deve ser um número inteiro válido'

    if (chave.includes('IDADE')) {
      if (num < 0 || num > 120) return 'Valor para chaves de IDADE deve estar entre 0 e 120'
    }
    if (chave.includes('DIAS')) {
      if (num < 0 || num > 365) return 'Valor para chaves de DIAS deve estar entre 0 e 365'
    }
    if (chave.includes('MESES')) {
      if (num < 0 || num > 120) return 'Valor para chaves de MESES deve estar entre 0 e 120'
    }
  }

  if (tipoParse === 'DECIMAL') {
    const num = parseFloat(valor)
    if (isNaN(num)) return 'Valor deve ser um número decimal válido'

    if (chave.includes('LIMITE')) {
      if (num < 0 || num > 1000000) return 'Valor para chaves de LIMITE deve estar entre 0 e 1.000.000'
    }
  }

  if (tipoParse === 'BOOLEAN') {
    if (!['true', 'false'].includes(valor.toLowerCase())) {
      return 'Valor deve ser "true" ou "false"'
    }
  }

  if (tipoParse === 'VARCHAR') {
    if (chave === 'HASH_ASSINATURA_PDF_SALT') {
      if (valor.length < 10) return 'HASH_ASSINATURA_PDF_SALT deve ter no mínimo 10 caracteres'
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────
// Type validation (RN-01)
// ─────────────────────────────────────────────────────────
function validateType(tipoParse: string, valor: string): string | null {
  switch (tipoParse) {
    case 'INT':
      if (!/^-?\d+$/.test(valor.trim())) return 'Valor deve ser um número inteiro'
      break
    case 'DECIMAL':
      if (!/^-?\d+(\.\d+)?$/.test(valor.trim())) return 'Valor deve ser um número decimal'
      break
    case 'BOOLEAN':
      if (!['true', 'false'].includes(valor.toLowerCase())) return 'Valor deve ser "true" ou "false"'
      break
    case 'VARCHAR':
      // Any string is valid for VARCHAR
      break
    default:
      return `Tipo de parse desconhecido: ${tipoParse}`
  }
  return null
}

// ─────────────────────────────────────────────────────────
// GET /api/configuracoes
// List all configs or get single config by ?chave=KEY
// ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chave = searchParams.get('chave')

    if (chave) {
      // Single key lookup
      const config = await db.configuracaoRegraNegocio.findUnique({
        where: { chave },
      })
      if (!config) {
        return NextResponse.json(
          { error: `Configuração com chave "${chave}" não encontrada` },
          { status: 404 }
        )
      }
      return NextResponse.json(config)
    }

    // List all configs
    const configs = await db.configuracaoRegraNegocio.findMany({
      orderBy: { chave: 'asc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('List configuracoes error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────
// PUT /api/configuracoes
// Body: { chave, valor, motivo_alteracao, confirmado?, updatedAt? }
// ─────────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized, user } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Apenas SUPERADMIN pode alterar configurações' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { chave, valor, motivo_alteracao, confirmado, updatedAt } = body

    // ── Required fields ──
    if (!chave || valor === undefined || valor === null) {
      return NextResponse.json(
        { error: 'chave e valor são obrigatórios' },
        { status: 400 }
      )
    }

    // ── motivo_alteracao validation (RN-01): min 20 chars, max 500 chars ──
    if (!motivo_alteracao || typeof motivo_alteracao !== 'string') {
      return NextResponse.json(
        { error: 'motivo_alteracao é obrigatório (mínimo 20 caracteres)' },
        { status: 400 }
      )
    }

    const motivoSanitized = sanitizeString(motivo_alteracao)

    if (motivoSanitized.length < 20) {
      return NextResponse.json(
        { error: 'motivo_alteracao deve ter no mínimo 20 caracteres' },
        { status: 400 }
      )
    }

    if (motivoSanitized.length > 500) {
      return NextResponse.json(
        { error: 'motivo_alteracao deve ter no máximo 500 caracteres' },
        { status: 400 }
      )
    }

    // ── Find current config ──
    const current = await db.configuracaoRegraNegocio.findUnique({
      where: { chave },
    })
    if (!current) {
      return NextResponse.json(
        { error: `Configuração com chave "${chave}" não encontrada` },
        { status: 404 }
      )
    }

    // ── Type validation (RN-01) ──
    const valorSanitized = sanitizeString(String(valor))
    const typeError = validateType(current.tipoParse, valorSanitized)
    if (typeError) {
      return NextResponse.json({ error: typeError }, { status: 400 })
    }

    // ── Range validation ──
    const rangeError = validateRange(chave, current.tipoParse, valorSanitized)
    if (rangeError) {
      return NextResponse.json({ error: rangeError }, { status: 400 })
    }

    // ── RN-04 / Air-Gap: CLT prohibited terms in motivo_alteracao ──
    if (CLT_PROHIBITED_TERMS_REGEX.test(motivoSanitized)) {
      return NextResponse.json(
        { error: 'motivo_alteracao contém termos proibidos pela CLT (RN-04 Air-Gap)' },
        { status: 400 }
      )
    }

    // ── RN-04 / Air-Gap: CLT prohibited terms in valor ──
    if (CLT_PROHIBITED_TERMS_REGEX.test(valorSanitized)) {
      return NextResponse.json(
        { error: 'valor contém termos proibidos pela CLT (RN-04 Air-Gap)' },
        { status: 400 }
      )
    }

    // ── EC-01: Optimistic locking ──
    if (updatedAt) {
      const clientUpdatedAt = new Date(updatedAt)
      const serverUpdatedAt = new Date(current.updatedAt)
      if (Math.abs(clientUpdatedAt.getTime() - serverUpdatedAt.getTime()) > 1000) {
        return NextResponse.json(
          {
            error: 'Conflito: configuração foi modificada por outro usuário. Recarregue e tente novamente.',
            currentUpdatedAt: current.updatedAt,
          },
          { status: 409 }
        )
      }
    }

    // ── EC-06: Maker/Checker for critical keys ──
    if (CRITICAL_KEYS.has(chave) && !confirmado) {
      return NextResponse.json(
        {
          error: `A chave "${chave}" é crítica e requer confirmação dupla. Envie confirmado: true para prosseguir.`,
          requiresConfirmation: true,
          chave,
        },
        { status: 400 }
      )
    }

    // ── Perform update ──
    const updated = await db.configuracaoRegraNegocio.update({
      where: { chave },
      data: {
        valor: valorSanitized,
        updatedAt: new Date(),
      },
    })

    // ── Full audit log ──
    await db.auditLog.create({
      data: {
        entidade: 'ConfiguracaoRegraNegocio',
        entidadeId: current.id,
        acao: 'UPDATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({ valor: current.valor }),
        valoresNovos: JSON.stringify({ valor: valorSanitized }),
        observacao: `Configuração "${chave}" alterada. Motivo: ${motivoSanitized}${CRITICAL_KEYS.has(chave) ? ' [CHAVE CRÍTICA - CONFIRMADA]' : ''}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update configuracao error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
