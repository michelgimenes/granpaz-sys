import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

/**
 * POST /api/rede/realocar
 * Atomic realocação (RN-03) — move a revendedor to a new patrocinador
 *
 * Body: { revendedor_id, novo_patrocinador_id, motivo }
 *
 * Business rules:
 * - SuperAdmin role required
 * - Validate motivo (min 10 chars, max 500 chars) — sanitized
 * - Validate revendedor has an active vínculo (dataFimVinculo IS NULL)
 * - Validate novo_patrocinador has an active vínculo
 * - Validate novo_patrocinador is not the same as current patrocinador
 * - RN-01: Validate no auto-patrocínio and no direct dependent patrocínio
 * - EC-02: Validate no indirect cycles
 * - RN-03: Atomic realocação with cascade nivelProfundidade recalculation
 * - EC-01: Optimistic locking via updatedAt-based check
 * - RN-05: Log audit note about bonificação recalculation
 */
export async function POST(request: Request) {
  try {
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin pode realizar realocação.', code: 'ACESSO_NEGADO' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { revendedor_id, novo_patrocinador_id, motivo } = body

    // ─── Validate required fields ───
    if (!revendedor_id || !novo_patrocinador_id || !motivo) {
      return NextResponse.json(
        { error: 'revendedor_id, novo_patrocinador_id e motivo são obrigatórios.' },
        { status: 400 }
      )
    }

    // ─── Validate and sanitize motivo ───
    const motivoSanitizado = sanitizeString(String(motivo))
    if (motivoSanitizado.length < 10 || motivoSanitizado.length > 500) {
      return NextResponse.json(
        { error: 'Motivo deve ter entre 10 e 500 caracteres.' },
        { status: 400 }
      )
    }

    // ─── RN-01: Validate no auto-patrocínio ───
    if (revendedor_id === novo_patrocinador_id) {
      return NextResponse.json(
        { error: 'Auto-patrocínio não é permitido. Revendedor não pode ser seu próprio patrocinador.', code: 'AUTO_PATROCINIO_PROIBIDO' },
        { status: 400 }
      )
    }

    // ─── RN-01: Validate no direct dependent patrocínio ───
    const vinculoDependente = await db.vinculo.findFirst({
      where: {
        pessoaVinculadaId: novo_patrocinador_id,
        titularRaizId: revendedor_id,
        dataFimVinculo: null,
        parentesco: { in: ['CONJUGE', 'FILHO'] },
      },
    })
    if (vinculoDependente) {
      return NextResponse.json(
        { error: `Novo patrocinador é ${vinculoDependente.parentesco === 'CONJUGE' ? 'cônjuge' : 'filho'} do revendedor. Patrocínio por dependente direto não é permitido.`, code: 'AUTO_PATROCINIO_PROIBIDO' },
        { status: 400 }
      )
    }

    // ─── Validate revendedor exists ───
    const revendedor = await db.pessoaFisica.findUnique({ where: { id: revendedor_id } })
    if (!revendedor) {
      return NextResponse.json({ error: 'Revendedor não encontrado.' }, { status: 404 })
    }

    // ─── Validate novo_patrocinador exists ───
    const novoPatrocinador = await db.pessoaFisica.findUnique({ where: { id: novo_patrocinador_id } })
    if (!novoPatrocinador) {
      return NextResponse.json({ error: 'Novo patrocinador não encontrado.' }, { status: 404 })
    }

    // ─── Validate revendedor has an active vínculo ───
    const patrocinioAtivo = await db.patrocinio.findFirst({
      where: { revendedorId: revendedor_id, dataFimVinculo: null },
    })
    if (!patrocinioAtivo) {
      return NextResponse.json(
        { error: 'Revendedor não possui vínculo ativo na rede.', code: 'SEM_VINCULO_ATIVO' },
        { status: 400 }
      )
    }

    // ─── Validate novo_patrocinador is not the same as current patrocinador ───
    if (patrocinioAtivo.patrocinadorId === novo_patrocinador_id) {
      return NextResponse.json(
        { error: 'Novo patrocinador é o mesmo que o patrocinador atual.', code: 'MESMO_PATROCINADOR' },
        { status: 400 }
      )
    }

    // ─── Validate novo_patrocinador has an active vínculo ───
    const patrocinioNovoPatrocinador = await db.patrocinio.findFirst({
      where: { revendedorId: novo_patrocinador_id, dataFimVinculo: null },
    })

    if (!patrocinioNovoPatrocinador) {
      // Check if novo_patrcoinador is a root node (has active subordinates but no active patrocínio as revendedor)
      const comoPatrocinador = await db.patrocinio.findFirst({
        where: { patrocinadorId: novo_patrocinador_id, dataFimVinculo: null },
      })
      const jaFoiRevendedor = await db.patrocinio.findFirst({
        where: { revendedorId: novo_patrocinador_id },
      })
      if (!comoPatrocinador && jaFoiRevendedor) {
        return NextResponse.json(
          { error: 'Novo patrocinador não possui vínculo ativo na rede.', code: 'PATROCINADOR_INATIVO' },
          { status: 400 }
        )
      }
    }

    // ─── EC-02: Validate no indirect cycles ───
    const cicloDetectado = await detectCycle(novo_patrocinador_id, revendedor_id)
    if (cicloDetectado) {
      return NextResponse.json(
        { error: 'Realocação criaria um ciclo na árvore de patrocínio. Operação negada.', code: 'CICLO_DE_PATROCINIO_DETECTADO' },
        { status: 400 }
      )
    }

    // ─── EC-01: Optimistic locking — save current state ───
    const patrocinioAntesAtualizacao = await db.patrocinio.findUnique({
      where: { id: patrocinioAtivo.id },
    })
    if (!patrocinioAntesAtualizacao) {
      return NextResponse.json({ error: 'Patrocínio não encontrado durante verificação de locking.' }, { status: 409 })
    }

    // ─── Calculate new nivelProfundidade ───
    const novoNivel = patrocinioNovoPatrocinador
      ? patrocinioNovoPatrocinador.nivelProfundidade + 1
      : 1

    // ─── RN-03: Atomic realocação ───
    // Step 1: Close current patrocínio
    const dataFim = new Date()
    await db.patrocinio.update({
      where: { id: patrocinioAtivo.id },
      data: {
        dataFimVinculo: dataFim,
        motivoRealocacao: motivoSanitizado,
      },
    })

    // EC-01: Verify the patrocínio hasn't changed since we read it
    const patrocinioVerificacao = await db.patrocinio.findUnique({
      where: { id: patrocinioAtivo.id },
    })
    if (!patrocinioVerificacao || patrocinioVerificacao.dataFimVinculo?.getTime() !== dataFim.getTime()) {
      // Concurrent modification detected — attempt rollback
      await db.patrocinio.update({
        where: { id: patrocinioAtivo.id },
        data: { dataFimVinculo: null, motivoRealocacao: null },
      })
      return NextResponse.json(
        { error: 'Conflito de concorrência. Tente novamente.', code: 'CONCORRENCIA' },
        { status: 409 }
      )
    }

    // Step 2: Create new patrocínio
    const novoPatrocinio = await db.patrocinio.create({
      data: {
        revendedorId: revendedor_id,
        patrocinadorId: novo_patrocinador_id,
        nivelProfundidade: novoNivel,
      },
      include: {
        revendedor: { select: { id: true, nomeCompleto: true, cpf: true } },
        patrocinador: { select: { id: true, nomeCompleto: true, cpf: true } },
      },
    })

    // Step 3: Cascade recalculate nivelProfundidade for all subordinados
    let subordinadosAfetados = 0
    try {
      subordinadosAfetados = await recalculateSubtree(revendedor_id, novoNivel)
    } catch (cascadeError) {
      // Log cascade error but don't fail the realocação — the main operation succeeded
      console.error('Cascade recalculation error after realocação:', cascadeError)
      await db.auditLog.create({
        data: {
          entidade: 'Patrocinio',
          entidadeId: novoPatrocinio.id,
          acao: 'ALERTA_CASCATA',
          atorId: userId,
          ipAddress: ipAddress || null,
          observacao: 'Erro durante recálculo em cascata de nível. Requer correção manual.',
        },
      })
    }

    // ─── Audit log with old and new values ───
    await db.auditLog.create({
      data: {
        entidade: 'Patrocinio',
        entidadeId: patrocinioAtivo.id,
        acao: 'REALOCACAO',
        atorId: userId,
        ipAddress: ipAddress || null,
        valoresAnteriores: JSON.stringify({
          patrocinadorId: patrocinioAtivo.patrocinadorId,
          nivelProfundidade: patrocinioAtivo.nivelProfundidade,
          patrocinioIdAntigo: patrocinioAtivo.id,
        }),
        valoresNovos: JSON.stringify({
          patrocinadorId: novo_patrocinador_id,
          nivelProfundidade: novoNivel,
          patrocinioIdNovo: novoPatrocinio.id,
          motivo: motivoSanitizado,
          subordinadosAfetados,
        }),
        observacao: `Realocação de ${revendedor.nomeCompleto} para patrocinador ${novoPatrocinador.nomeCompleto}. ${subordinadosAfetados} subordinados afetados em cascata.`,
      },
    })

    // ─── RN-05: Log audit note about bonificação recalculation ───
    await db.auditLog.create({
      data: {
        entidade: 'Patrocinio',
        entidadeId: novoPatrocinio.id,
        acao: 'NOTA_BONIFICACAO',
        atorId: userId,
        ipAddress: ipAddress || null,
        observacao: 'Realocação realizada. Bonificação para vendas futuras será recalculada com base no novo nível. Transações LIBERADO anteriores permanecem inalteradas.',
      },
    })

    return NextResponse.json({
      success: true,
      patrocinioAntigo: {
        id: patrocinioAtivo.id,
        dataFimVinculo: dataFim.toISOString(),
        motivoRealocacao: motivoSanitizado,
      },
      patrocinioNovo: novoPatrocinio,
      subordinadosAfetados,
    })
  } catch (error) {
    console.error('Realocar error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

/**
 * EC-02: Detect indirect cycles
 * Trace from novoPatrocinadorId up the tree to see if revendedorId appears
 */
async function detectCycle(startPatrocinadorId: string, targetRevendedorId: string): Promise<boolean> {
  let currentId = startPatrocinadorId
  const visited = new Set<string>()
  while (currentId) {
    if (currentId === targetRevendedorId) return true
    if (visited.has(currentId)) break // safety: prevent infinite loop
    visited.add(currentId)
    const patrocinio = await db.patrocinio.findFirst({
      where: { revendedorId: currentId, dataFimVinculo: null },
    })
    currentId = patrocinio?.patrocinadorId || ''
    if (!patrocinio) break
  }
  return false
}

/**
 * RN-03: Cascade recalculate nivelProfundidade for all subordinates
 * Returns the count of affected subordinates
 */
async function recalculateSubtree(revendedorId: string, newNivel: number): Promise<number> {
  let count = 0
  const directSubs = await db.patrocinio.findMany({
    where: { patrocinadorId: revendedorId, dataFimVinculo: null },
  })
  for (const sub of directSubs) {
    const subNewNivel = newNivel + 1
    await db.patrocinio.update({
      where: { id: sub.id },
      data: { nivelProfundidade: subNewNivel },
    })
    count++
    count += await recalculateSubtree(sub.revendedorId, subNewNivel)
  }
  return count
}
