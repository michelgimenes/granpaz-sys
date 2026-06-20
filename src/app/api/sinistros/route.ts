import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkFinanceiroOrAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { validateTipoSinistro, validateS3Hash, validateCarencia } from '@/lib/validations'
import { sanitizeString } from '@/lib/sanitization'

/**
 * GET /api/sinistros
 * List sinistros with pagination and filters
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status')
    const contratoId = searchParams.get('contratoId')
    const tipoSinistro = searchParams.get('tipoSinistro')

    const where: Record<string, any> = {}
    if (status) where.status = status
    if (contratoId) where.contratoId = contratoId
    if (tipoSinistro) where.tipoSinistro = tipoSinistro

    const [sinistros, total] = await Promise.all([
      db.sinistro.findMany({
        where,
        include: {
          contrato: {
            include: {
              titular: { select: { id: true, nomeCompleto: true, cpf: true } },
              plano: { select: { nome: true } },
            },
          },
          pessoaVinculada: {
            select: { id: true, nomeCompleto: true, tipoRegistro: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.sinistro.count({ where }),
    ])

    return NextResponse.json({
      data: sinistros,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List sinistros error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/sinistros
 * Create a new sinistro with full business rule validation
 * - RN-01: Air-Gap (SHA-256 hash only, no clinical data)
 * - RN-02: Carência validation per tipo_sinistro
 * - SPEC-04 Section 4.5: data_ocorrencia validation
 * - EC-04: Active vínculo validation
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // Auth check: financeiro or admin required
    const { authorized } = await checkFinanceiroOrAdmin(userId)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado. Requer perfil Financeiro ou SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      contratoId,
      pessoaVinculadaId,
      tipoSinistro,
      dataOcorrencia,
      documentoS3Hash,
      observacoes,
    } = body

    // ── Required fields ──
    if (!contratoId || !tipoSinistro || !dataOcorrencia) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando: contratoId, tipoSinistro, dataOcorrencia' }, { status: 400 })
    }

    // ── RN-01: Validate tipo_sinistro enum ──
    const tipoValidation = validateTipoSinistro(tipoSinistro)
    if (!tipoValidation.valid) {
      return NextResponse.json({ error: tipoValidation.message }, { status: 400 })
    }

    // ── RN-01: Validate SHA-256 hash format (Air-Gap) ──
    if (documentoS3Hash) {
      const hashValidation = validateS3Hash(documentoS3Hash)
      if (!hashValidation.valid) {
        return NextResponse.json({ error: hashValidation.message }, { status: 400 })
      }
    }

    // ── SPEC-04 Section 4.5: Validate data_ocorrencia ──
    const dataOcorrenciaDate = new Date(dataOcorrencia)
    const now = new Date()

    if (dataOcorrenciaDate > now) {
      return NextResponse.json({ error: 'Data da ocorrência não pode ser futura.' }, { status: 400 })
    }

    // ── Validate contrato exists and is approved ──
    const contrato = await db.contrato.findUnique({
      where: { id: contratoId },
      include: {
        dadosAprovacao: true,
        titular: true,
      },
    })
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }
    if (!['APROVADO', 'SUSPENSO'].includes(contrato.status)) {
      return NextResponse.json({ error: `Contrato com status '${contrato.status}' não permite abertura de sinistro.` }, { status: 400 })
    }

    // ── Validate data_aprovacao exists (carência base) ──
    if (!contrato.dadosAprovacao?.dataAprovacao) {
      return NextResponse.json({ error: 'Contrato não possui data de aprovação. Impossível calcular carência.' }, { status: 400 })
    }

    const dataAprovacao = contrato.dadosAprovacao.dataAprovacao
    if (dataOcorrenciaDate < dataAprovacao) {
      return NextResponse.json({ error: 'Data da ocorrência anterior à data de aprovação do contrato.' }, { status: 400 })
    }

    // ── EC-04: Validate pessoa_vinculada_id belongs to contrato and was active ──
    const pessoaId = pessoaVinculadaId || contrato.titularId

    // Check if person is the titular
    if (pessoaId !== contrato.titularId) {
      // Must be a vinculo on this contract's titular
      const vinculo = await db.vinculo.findFirst({
        where: {
          titularRaizId: contrato.titularId,
          pessoaVinculadaId: pessoaId,
        },
      })
      if (!vinculo) {
        return NextResponse.json({ error: 'Pessoa vinculada não pertence a este contrato.' }, { status: 400 })
      }
      // Check vínculo was active at data_ocorrencia
      if (vinculo.dataFimVinculo && vinculo.dataFimVinculo < dataOcorrenciaDate) {
        return NextResponse.json({ error: 'Vínculo inativo na data do evento.' }, { status: 403 })
      }
    }

    // ── RN-02: Carência validation ──
    const carenciaResult = await validateCarencia(tipoSinistro, dataOcorrenciaDate, dataAprovacao)

    // Determine final status
    const status = carenciaResult.negado ? 'NEGADO_CARENCIA' : 'EM_ANALISE'

    // ── Create sinistro ──
    const sinistro = await db.sinistro.create({
      data: {
        contratoId,
        pessoaVinculadaId: pessoaId,
        tipoSinistro,
        dataOcorrencia: dataOcorrenciaDate,
        status,
        documentoS3Hash: documentoS3Hash || null,
        motivoNegacao: carenciaResult.motivoNegacao || null,
        carenciaDias: carenciaResult.carenciaDias,
        carenciaMeses: carenciaResult.carenciaMeses,
        observacoes: observacoes ? sanitizeString(observacoes) : null,
      },
      include: {
        contrato: {
          include: {
            titular: { select: { id: true, nomeCompleto: true } },
            plano: { select: { nome: true } },
          },
        },
        pessoaVinculada: { select: { id: true, nomeCompleto: true, tipoRegistro: true } },
      },
    })

    // ── Audit log with full details ──
    await db.auditLog.create({
      data: {
        entidade: 'Sinistro',
        entidadeId: sinistro.id,
        acao: 'CREATE',
        atorId: userId,
        ipAddress,
        valoresNovos: JSON.stringify({
          contratoId,
          pessoaVinculadaId: pessoaId,
          tipoSinistro,
          dataOcorrencia,
          status,
          motivoNegacao: carenciaResult.motivoNegacao,
          carenciaDias: carenciaResult.carenciaDias,
          carenciaMeses: carenciaResult.carenciaMeses,
          documentoS3Hash: documentoS3Hash ? 'SHA-256_PROVIDED' : null,
        }),
        observacao: carenciaResult.negado
          ? `Sinistro automaticamente negado por carência: ${carenciaResult.motivoNegacao}`
          : `Sinistro aberto para análise. Tipo: ${tipoSinistro}`,
      },
    })

    const responseStatus = carenciaResult.negado ? 201 : 201 // always 201 — negação is a valid business outcome
    return NextResponse.json(sinistro, { status: responseStatus })
  } catch (error) {
    console.error('Create sinistro error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
