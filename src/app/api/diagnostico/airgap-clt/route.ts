import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

// ─────────────────────────────────────────────────────────
// POST /api/diagnostico/airgap-clt
// CLT Air-Gap scan (RN-04)
//
// Scans recent audit_logs (last 30 days) and text fields
// in the database for CLT prohibited terms.
//
// Returns: { violations: [...], totalViolations }
// ─────────────────────────────────────────────────────────

// CLT prohibited terms regex (RN-04)
const CLT_TERMS_REGEX =
  /\b(meta|horario|horário|ponto|chefe|salario|salário|clt|empregado|empregador|jornada|carga_horaria|desempenho|avaliação|avaliacao|ferias|férias|contrato_trabalho|subordinação|subordinacao|supervisor_funcional)\b/gi

interface CLTViolation {
  entidade: string
  entidadeId: string
  campo: string
  termoDetectado: string
  conteudo: string
}

/**
 * Scan a text string for CLT terms, return array of matched terms
 */
function findCLTTerms(text: string): string[] {
  if (!text) return []
  const matches = text.match(CLT_TERMS_REGEX)
  if (!matches) return []
  // Deduplicate (case-insensitive)
  const unique = new Set(matches.map(m => m.toLowerCase()))
  return Array.from(unique)
}

/**
 * Create a violation entry with truncated content for safety
 */
function createViolation(
  entidade: string,
  entidadeId: string,
  campo: string,
  termoDetectado: string,
  conteudo: string
): CLTViolation {
  return {
    entidade,
    entidadeId,
    campo,
    termoDetectado,
    conteudo: conteudo.length > 200 ? conteudo.substring(0, 200) + '...' : conteudo,
  }
}

export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Apenas SUPERADMIN pode executar scan CLT Air-Gap' },
        { status: 403 }
      )
    }

    const violations: CLTViolation[] = []
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // ─────────────────────────────────────────────────────
    // 1. Scan recent audit_logs (last 30 days)
    // ─────────────────────────────────────────────────────
    const recentAuditLogs = await db.auditLog.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        entidade: true,
        entidadeId: true,
        valoresAnteriores: true,
        valoresNovos: true,
        observacao: true,
      },
    })

    for (const log of recentAuditLogs) {
      // Scan observacao
      if (log.observacao) {
        const terms = findCLTTerms(log.observacao)
        for (const term of terms) {
          violations.push(
            createViolation(
              `AuditLog:${log.entidade}`,
              log.entidadeId,
              'observacao',
              term,
              log.observacao
            )
          )
        }
      }

      // Scan valoresAnteriores
      if (log.valoresAnteriores) {
        const terms = findCLTTerms(log.valoresAnteriores)
        for (const term of terms) {
          violations.push(
            createViolation(
              `AuditLog:${log.entidade}`,
              log.entidadeId,
              'valoresAnteriores',
              term,
              log.valoresAnteriores
            )
          )
        }
      }

      // Scan valoresNovos
      if (log.valoresNovos) {
        const terms = findCLTTerms(log.valoresNovos)
        for (const term of terms) {
          violations.push(
            createViolation(
              `AuditLog:${log.entidade}`,
              log.entidadeId,
              'valoresNovos',
              term,
              log.valoresNovos
            )
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 2. Scan pessoas_fisicas text fields
    // ─────────────────────────────────────────────────────
    const pessoas = await db.pessoaFisica.findMany({
      where: {
        OR: [
          { observacoes: { not: null } },
          { profissao: { not: null } },
        ],
      },
      select: {
        id: true,
        observacoes: true,
        profissao: true,
      },
    })

    for (const p of pessoas) {
      if (p.observacoes) {
        const terms = findCLTTerms(p.observacoes)
        for (const term of terms) {
          violations.push(
            createViolation('PessoaFisica', p.id, 'observacoes', term, p.observacoes)
          )
        }
      }
      if (p.profissao) {
        const terms = findCLTTerms(p.profissao)
        for (const term of terms) {
          violations.push(
            createViolation('PessoaFisica', p.id, 'profissao', term, p.profissao)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 3. Scan contratos text fields
    // ─────────────────────────────────────────────────────
    const contratos = await db.contrato.findMany({
      where: {
        motivoCancelamento: { not: null },
      },
      select: {
        id: true,
        motivoCancelamento: true,
      },
    })

    for (const c of contratos) {
      if (c.motivoCancelamento) {
        const terms = findCLTTerms(c.motivoCancelamento)
        for (const term of terms) {
          violations.push(
            createViolation('Contrato', c.id, 'motivoCancelamento', term, c.motivoCancelamento)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 4. Scan sinistros text fields
    // ─────────────────────────────────────────────────────
    const sinistros = await db.sinistro.findMany({
      where: {
        OR: [
          { observacoes: { not: null } },
          { motivoNegacao: { not: null } },
        ],
      },
      select: {
        id: true,
        observacoes: true,
        motivoNegacao: true,
      },
    })

    for (const s of sinistros) {
      if (s.observacoes) {
        const terms = findCLTTerms(s.observacoes)
        for (const term of terms) {
          violations.push(
            createViolation('Sinistro', s.id, 'observacoes', term, s.observacoes)
          )
        }
      }
      if (s.motivoNegacao) {
        const terms = findCLTTerms(s.motivoNegacao)
        for (const term of terms) {
          violations.push(
            createViolation('Sinistro', s.id, 'motivoNegacao', term, s.motivoNegacao)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 5. Scan patrocinios text fields
    // ─────────────────────────────────────────────────────
    const patrocinios = await db.patrocinio.findMany({
      where: {
        motivoRealocacao: { not: null },
      },
      select: {
        id: true,
        motivoRealocacao: true,
      },
    })

    for (const p of patrocinios) {
      if (p.motivoRealocacao) {
        const terms = findCLTTerms(p.motivoRealocacao)
        for (const term of terms) {
          violations.push(
            createViolation('Patrocinio', p.id, 'motivoRealocacao', term, p.motivoRealocacao)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 6. Scan transacoes_pagamento text fields
    // ─────────────────────────────────────────────────────
    const transacoesPagamento = await db.transacaoPagamento.findMany({
      where: {
        OR: [
          { observacoes: { not: null } },
          { motivoRejeicao: { not: null } },
        ],
      },
      select: {
        id: true,
        observacoes: true,
        motivoRejeicao: true,
      },
    })

    for (const t of transacoesPagamento) {
      if (t.observacoes) {
        const terms = findCLTTerms(t.observacoes)
        for (const term of terms) {
          violations.push(
            createViolation('TransacaoPagamento', t.id, 'observacoes', term, t.observacoes)
          )
        }
      }
      if (t.motivoRejeicao) {
        const terms = findCLTTerms(t.motivoRejeicao)
        for (const term of terms) {
          violations.push(
            createViolation('TransacaoPagamento', t.id, 'motivoRejeicao', term, t.motivoRejeicao)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 7. Scan configuracoes_regras_negocio
    // ─────────────────────────────────────────────────────
    const configuracoes = await db.configuracaoRegraNegocio.findMany({
      select: {
        id: true,
        chave: true,
        valor: true,
        descricao: true,
      },
    })

    for (const c of configuracoes) {
      if (c.valor) {
        const terms = findCLTTerms(c.valor)
        for (const term of terms) {
          violations.push(
            createViolation('ConfiguracaoRegraNegocio', c.id, 'valor', term, c.valor)
          )
        }
      }
      if (c.descricao) {
        const terms = findCLTTerms(c.descricao)
        for (const term of terms) {
          violations.push(
            createViolation('ConfiguracaoRegraNegocio', c.id, 'descricao', term, c.descricao)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 8. Scan seguradoras clausulasMarkdown
    // ─────────────────────────────────────────────────────
    const seguradoras = await db.seguradora.findMany({
      where: {
        clausulasMarkdown: { not: null },
      },
      select: {
        id: true,
        clausulasMarkdown: true,
      },
    })

    for (const s of seguradoras) {
      if (s.clausulasMarkdown) {
        const terms = findCLTTerms(s.clausulasMarkdown)
        for (const term of terms) {
          violations.push(
            createViolation('Seguradora', s.id, 'clausulasMarkdown', term, s.clausulasMarkdown)
          )
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // Audit log the scan results
    // ─────────────────────────────────────────────────────
    await db.auditLog.create({
      data: {
        entidade: 'DiagnosticoAirGapCLT',
        entidadeId: 'AIRGAP_CLT_SCAN',
        acao: 'CREATE',
        atorId: userId,
        ipAddress: ipAddress || null,
        observacao: `Scan CLT Air-Gap executado: ${violations.length} violação(ões) detectada(s) em ${thirtyDaysAgo.toISOString().split('T')[0]} a hoje`,
        valoresNovos: JSON.stringify({
          totalViolations: violations.length,
          entitiesScanned: [
            'AuditLog',
            'PessoaFisica',
            'Contrato',
            'Sinistro',
            'Patrocinio',
            'TransacaoPagamento',
            'ConfiguracaoRegraNegocio',
            'Seguradora',
          ],
        }),
      },
    })

    return NextResponse.json({
      violations,
      totalViolations: violations.length,
    })
  } catch (error) {
    console.error('Air-Gap CLT scan error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
