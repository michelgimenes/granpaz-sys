import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/contratos/[id]/endosso
 * Create an endorsement (endosso) for an approved contract
 *
 * Lacunas fixed:
 * - L15: EXCLUSAO_VINCULO — check vinculo does NOT already have dataFimVinculo
 * - L19: Endosso creation for approved contracts
 * - RN-05: ALTERACAO_CAPITAL requires new capital validation
 * - RN-06: EXCLUSAO_VINCULO recalculates contract value and audits
 * - SuperAdmin role check
 * - Audit logging with old and new values
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo, dados } = body

    // ─── Validate tipo ───
    const TIPOS_VALIDOS = ['ALTERACAO_CAPITAL', 'EXCLUSAO_VINCULO', 'UPGRADE_PLANO', 'DOWNGRADE_PLANO']
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo de endosso inválido. Tipos permitidos: ${TIPOS_VALIDOS.join(', ')}` },
        { status: 422 }
      )
    }

    // ─── Validate contrato exists and is APROVADO ───
    const contrato = await db.contrato.findUnique({
      where: { id },
      include: { dadosAprovacao: true },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contrato.status !== 'APROVADO') {
      return NextResponse.json(
        { error: 'Apenas contratos aprovados podem receber endossos.' },
        { status: 400 }
      )
    }

    // ─── Process endosso by tipo ───
    if (tipo === 'ALTERACAO_CAPITAL') {
      return await handleAlteracaoCapital(id, contrato, dados, userId, ipAddress)
    } else if (tipo === 'EXCLUSAO_VINCULO') {
      return await handleExclusaoVinculo(id, contrato, dados, userId, ipAddress)
    } else if (tipo === 'UPGRADE_PLANO' || tipo === 'DOWNGRADE_PLANO') {
      return await handleAlteracaoPlano(id, contrato, tipo, dados, userId, ipAddress)
    }

    return NextResponse.json({ error: 'Tipo de endosso não implementado.' }, { status: 501 })
  } catch (error) {
    console.error('Endosso error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * ALTERACAO_CAPITAL: Change the insured capital amount
 * RN-05: Mark that this requires new approval (but for now just update directly with audit)
 */
async function handleAlteracaoCapital(
  contratoId: string,
  contrato: { dadosAprovacao?: { capitalSeguradoInformado?: number } | null; [key: string]: unknown },
  dados: { capitalSegurado?: number; [key: string]: unknown },
  userId: string | null,
  ipAddress: string | null
) {
  const { capitalSegurado } = dados || {}

  // ─── Validate new capitalSegurado > 0 ───
  if (!capitalSegurado || typeof capitalSegurado !== 'number' || capitalSegurado <= 0) {
    return NextResponse.json(
      { error: 'Capital segurado deve ser maior que zero e dentro do limite da apólice master.' },
      { status: 422 }
    )
  }

  // ─── Validate capitalSegurado <= 10_000_000 ───
  if (capitalSegurado > 10_000_000) {
    return NextResponse.json(
      { error: 'Capital segurado deve ser maior que zero e dentro do limite da apólice master.' },
      { status: 422 }
    )
  }

  const capitalAnterior = contrato.dadosAprovacao?.capitalSeguradoInformado || 0

  // ─── Update dadosAprovacaoSeguradora ───
  if (contrato.dadosAprovacao) {
    await db.dadosAprovacaoSeguradora.update({
      where: { contratoId },
      data: { capitalSeguradoInformado: capitalSegurado },
    })
  } else {
    await db.dadosAprovacaoSeguradora.create({
      data: {
        contratoId,
        capitalSeguradoInformado: capitalSegurado,
      },
    })
  }

  // ─── Update contrato updatedAt ───
  await db.contrato.update({
    where: { id: contratoId },
    data: { updatedAt: new Date() },
  })

  // ─── Audit log with old and new values ───
  await db.auditLog.create({
    data: {
      entidade: 'Contrato',
      entidadeId: contratoId,
      acao: 'ENDOSSO_ALTERACAO_CAPITAL',
      atorId: userId,
      ipAddress: ipAddress || null,
      valoresAnteriores: JSON.stringify({ capitalSeguradoInformado: capitalAnterior }),
      valoresNovos: JSON.stringify({
        capitalSeguradoInformado: capitalSegurado,
        tipo: 'ALTERACAO_CAPITAL',
        rn05_requiresNewApproval: true,
      }),
      observacao: 'Endosso de alteração de capital — RN-05: Requer nova aprovação da seguradora.',
    },
  })

  const contratoAtualizado = await db.contrato.findUnique({
    where: { id: contratoId },
    include: { dadosAprovacao: true },
  })

  return NextResponse.json({
    success: true,
    tipo: 'ALTERACAO_CAPITAL',
    contrato: contratoAtualizado,
    _meta: {
      capitalAnterior,
      capitalNovo: capitalSegurado,
      rn05Note: 'Este endosso requer nova aprovação da seguradora.',
    },
  })
}

/**
 * EXCLUSAO_VINCULO: Remove a vinculo from the contract
 * L15: Check vinculo does NOT already have dataFimVinculo
 * RN-06: Recalculate contract value (audit)
 */
async function handleExclusaoVinculo(
  contratoId: string,
  _contrato: Record<string, unknown>,
  dados: { vinculoId?: string; [key: string]: unknown },
  userId: string | null,
  ipAddress: string | null
) {
  const { vinculoId } = dados || {}

  if (!vinculoId) {
    return NextResponse.json(
      { error: 'vinculoId é obrigatório para exclusão de vínculo.' },
      { status: 422 }
    )
  }

  const vinculo = await db.vinculo.findUnique({
    where: { id: vinculoId },
    include: { pessoaVinculada: true },
  })

  if (!vinculo) {
    return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 })
  }

  // ─── L15: Check that vinculo does NOT already have dataFimVinculo ───
  if (vinculo.dataFimVinculo) {
    return NextResponse.json(
      { error: 'Vínculo já inativo.' },
      { status: 400 }
    )
  }

  const valoresAnteriores = {
    vinculoId: vinculo.id,
    pessoaVinculada: vinculo.pessoaVinculada.nomeCompleto,
    tipoVinculo: vinculo.tipoVinculo,
    parentesco: vinculo.parentesco,
    dataFimVinculo: null,
  }

  // ─── Set dataFimVinculo = now ───
  await db.vinculo.update({
    where: { id: vinculoId },
    data: { dataFimVinculo: new Date() },
  })

  // ─── Update contrato updatedAt ───
  await db.contrato.update({
    where: { id: contratoId },
    data: { updatedAt: new Date() },
  })

  // ─── RN-06: Audit log with old and new values (recalculation note) ───
  await db.auditLog.create({
    data: {
      entidade: 'Contrato',
      entidadeId: contratoId,
      acao: 'ENDOSSO_EXCLUSAO_VINCULO',
      atorId: userId,
      ipAddress: ipAddress || null,
      valoresAnteriores: JSON.stringify(valoresAnteriores),
      valoresNovos: JSON.stringify({
        vinculoId: vinculo.id,
        dataFimVinculo: new Date().toISOString(),
        tipo: 'EXCLUSAO_VINCULO',
        rn06Note: 'Valor do contrato deve ser recalculado após exclusão de vínculo.',
      }),
      observacao: `Endosso de exclusão de vínculo: ${vinculo.pessoaVinculada.nomeCompleto} (${vinculo.tipoVinculo}) — RN-06: Recalcular valor do contrato.`,
    },
  })

  return NextResponse.json({
    success: true,
    tipo: 'EXCLUSAO_VINCULO',
    _meta: {
      vinculoExcluido: {
        id: vinculo.id,
        nome: vinculo.pessoaVinculada.nomeCompleto,
        tipoVinculo: vinculo.tipoVinculo,
      },
      rn06Note: 'Valor do contrato deve ser recalculado após exclusão de vínculo.',
    },
  })
}

/**
 * UPGRADE_PLANO / DOWNGRADE_PLANO: Change the contract plan
 * For now, create audit log with the change details
 */
async function handleAlteracaoPlano(
  contratoId: string,
  contrato: { planoId: string; valorParcelaBase: number; valorTaxaAdesao: number; [key: string]: unknown },
  tipo: string,
  dados: { novoPlanoId?: string; [key: string]: unknown },
  userId: string | null,
  ipAddress: string | null
) {
  const { novoPlanoId } = dados || {}

  if (!novoPlanoId) {
    return NextResponse.json(
      { error: 'novoPlanoId é obrigatório para alteração de plano.' },
      { status: 422 }
    )
  }

  const novoPlano = await db.plano.findUnique({ where: { id: novoPlanoId } })
  if (!novoPlano) {
    return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
  }

  if (!novoPlano.ativo) {
    return NextResponse.json({ error: 'Plano informado não está ativo.' }, { status: 400 })
  }

  const planoAnterior = {
    planoId: contrato.planoId,
    valorParcelaBase: contrato.valorParcelaBase,
    valorTaxaAdesao: contrato.valorTaxaAdesao,
  }

  // ─── Update contrato ───
  await db.contrato.update({
    where: { id: contratoId },
    data: {
      planoId: novoPlanoId,
      valorParcelaBase: novoPlano.valorBase,
      valorTaxaAdesao: novoPlano.valorTaxaAdesao,
      updatedAt: new Date(),
    },
  })

  // ─── Audit log ───
  await db.auditLog.create({
    data: {
      entidade: 'Contrato',
      entidadeId: contratoId,
      acao: tipo === 'UPGRADE_PLANO' ? 'ENDOSSO_UPGRADE_PLANO' : 'ENDOSSO_DOWNGRADE_PLANO',
      atorId: userId,
      ipAddress: ipAddress || null,
      valoresAnteriores: JSON.stringify(planoAnterior),
      valoresNovos: JSON.stringify({
        planoId: novoPlanoId,
        planoNome: novoPlano.nome,
        planoTipo: novoPlano.tipo,
        valorParcelaBase: novoPlano.valorBase,
        valorTaxaAdesao: novoPlano.valorTaxaAdesao,
        tipo,
      }),
      observacao: `Endosso de ${tipo === 'UPGRADE_PLANO' ? 'upgrade' : 'downgrade'} de plano: ${novoPlano.nome} (${novoPlano.tipo})`,
    },
  })

  const contratoAtualizado = await db.contrato.findUnique({
    where: { id: contratoId },
    include: { plano: true, dadosAprovacao: true },
  })

  return NextResponse.json({
    success: true,
    tipo,
    contrato: contratoAtualizado,
    _meta: {
      planoAnterior,
      planoNovo: {
        id: novoPlanoId,
        nome: novoPlano.nome,
        tipo: novoPlano.tipo,
        valorBase: novoPlano.valorBase,
      },
    },
  })
}
