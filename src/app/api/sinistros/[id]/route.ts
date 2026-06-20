import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { calculateRemissionMonths } from '@/lib/validations'
import { sanitizeString } from '@/lib/sanitization'

/**
 * GET /api/sinistros/[id]
 * Get a single sinistro with full related data
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sinistro = await db.sinistro.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            titular: { select: { id: true, nomeCompleto: true, cpf: true, tipoRegistro: true } },
            plano: { select: { nome: true, tipo: true } },
            seguradora: { select: { id: true, nome: true, clausulasMarkdown: true } },
            dadosAprovacao: true,
            remissao: true,
          },
        },
        pessoaVinculada: {
          select: { id: true, nomeCompleto: true, tipoRegistro: true, dataNascimento: true },
        },
      },
    })

    if (!sinistro) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(sinistro)
  } catch (error) {
    console.error('Get sinistro error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/sinistros/[id]
 * Update sinistro status (APROVADO, NEGADO_FRAUDE, NEGADO_EXCLUSAO)
 * SuperAdmin role required for status changes
 * RN-07: When APROVADO for titular OBITO, create RemissaoContrato and cascade estorno
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin check for status changes
    const { authorized, user } = await checkSuperAdmin(userId)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado. Apenas SuperAdmin pode alterar status de sinistro.' }, { status: 403 })
    }

    const body = await request.json()
    const { status, motivoNegacao, observacoes } = body

    // Validate status transition
    const ALLOWED_STATUSES = ['APROVADO', 'NEGADO_FRAUDE', 'NEGADO_EXCLUSAO']
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Permitidos: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch current sinistro
    const sinistro = await db.sinistro.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            titular: true,
            seguradora: true,
            dadosAprovacao: true,
            remissao: true,
          },
        },
        pessoaVinculada: true,
      },
    })

    if (!sinistro) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }

    // Only EM_ANALISE can transition
    if (sinistro.status !== 'EM_ANALISE') {
      return NextResponse.json(
        { error: `Sinistro com status '${sinistro.status}' não pode ser alterado. Apenas sinistros EM_ANALISE podem ter status modificado.` },
        { status: 400 }
      )
    }

    const valoresAnteriores = JSON.stringify({ status: sinistro.status, motivoNegacao: sinistro.motivoNegacao })

    // ── NEGADO paths ──
    if (status === 'NEGADO_FRAUDE' || status === 'NEGADO_EXCLUSAO') {
      const motivo = status === 'NEGADO_FRAUDE'
        ? (motivoNegacao || 'Sinistro negado por fraude comprovada.')
        : (motivoNegacao || 'Sinistro negado por exclusão contratual.')

      const updated = await db.sinistro.update({
        where: { id },
        data: {
          status,
          motivoNegacao: sanitizeString(motivo),
          observacoes: observacoes ? sanitizeString(observacoes) : sinistro.observacoes,
          updatedAt: new Date(),
        },
      })

      await db.auditLog.create({
        data: {
          entidade: 'Sinistro',
          entidadeId: id,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores,
          valoresNovos: JSON.stringify({ status, motivoNegacao: motivo }),
          observacao: `Sinistro ${id} alterado para ${status}. Motivo: ${motivo}`,
        },
      })

      return NextResponse.json(updated)
    }

    // ── APROVADO path ──
    if (status === 'APROVADO') {
      const isTitular = sinistro.pessoaVinculadaId === sinistro.contrato.titularId
      const isObito = ['OBITO_NATURAL', 'OBITO_ACIDENTAL', 'SUICIDIO'].includes(sinistro.tipoSinistro)

      // Update sinistro status first
      const updated = await db.sinistro.update({
        where: { id },
        data: {
          status: 'APROVADO',
          observacoes: observacoes ? sanitizeString(observacoes) : sinistro.observacoes,
          updatedAt: new Date(),
        },
      })

      // ── RN-07: Remissão for titular OBITO ──
      if (isTitular && isObito) {
        // Check if remissão already exists
        if (!sinistro.contrato.remissao) {
          const { meses, origemPrazo } = await calculateRemissionMonths(sinistro.contrato.seguradoraId)

          const dataInicioRemissao = new Date()
          const dataFimRemissao = new Date()
          dataFimRemissao.setMonth(dataFimRemissao.getMonth() + meses)

          await db.remissaoContrato.create({
            data: {
              contratoId: sinistro.contratoId,
              dataInicioRemissao,
              dataFimRemissao,
              mesesAplicados: meses,
              origemPrazo,
            },
          })

          // Cancel all PENDENTE contas_a_pagar for this contract during remission
          await db.contaAPagar.updateMany({
            where: {
              contratoId: sinistro.contratoId,
              status: 'PENDENTE',
            },
            data: { status: 'CANCELADO' },
          })

          await db.auditLog.create({
            data: {
              entidade: 'RemissaoContrato',
              entidadeId: sinistro.contratoId,
              acao: 'CREATE',
              atorId: userId,
              ipAddress,
              valoresNovos: JSON.stringify({
                contratoId: sinistro.contratoId,
                mesesAplicados: meses,
                origemPrazo,
                dataInicioRemissao: dataInicioRemissao.toISOString(),
                dataFimRemissao: dataFimRemissao.toISOString(),
              }),
              observacao: `Remissão criada por óbito do titular. Origem: ${origemPrazo}. Meses: ${meses}. Contas PENDENTE canceladas.`,
            },
          })
        }

        // Remissão automática por óbito do Titular (§4.5)
        // Verificar configuração de meses de remissão alternativa
        const configRemissao = await db.configuracaoRegraNegocio.findUnique({
          where: { chave: 'MESES_REMISSAO_OBITO_PADRAO' }
        })
        const mesesRemissao = configRemissao ? parseInt(configRemissao.valor) : 0

        if (mesesRemissao > 0 && !sinistro.contrato.remissao) {
          const dataInicioRemissao = new Date(sinistro.dataOcorrencia)
          const dataFimRemissao = new Date(dataInicioRemissao)
          dataFimRemissao.setMonth(dataFimRemissao.getMonth() + mesesRemissao)

          await db.remissaoContrato.create({
            data: {
              contratoId: sinistro.contratoId,
              dataInicioRemissao,
              dataFimRemissao,
              mesesAplicados: mesesRemissao,
              origemPrazo: 'CONFIGURACAO_PADRAO',
            },
          })

          await db.auditLog.create({
            data: {
              entidade: 'RemissaoContrato',
              entidadeId: sinistro.contratoId,
              acao: 'CREATE',
              atorId: userId,
              ipAddress,
              valoresNovos: JSON.stringify({
                contratoId: sinistro.contratoId,
                mesesAplicados: mesesRemissao,
                origemPrazo: 'CONFIGURACAO_PADRAO',
                dataInicioRemissao: dataInicioRemissao.toISOString(),
                dataFimRemissao: dataFimRemissao.toISOString(),
                motivo: 'Remissão automática por configuração padrão (§4.5)',
              }),
              observacao: `Remissão automática (CONFIGURACAO_PADRAO) criada: ${mesesRemissao} meses a partir da data do óbito.`,
            },
          })
        }

        // ── Cascade estorno of bonificações for titular death ──
        // Find all LIBERADO bonificações for this contract's tree
        const bonificacoesLiberadas = await db.transacaoBonificacao.findMany({
          where: {
            origemContratoId: sinistro.contratoId,
            status: 'LIBERADO',
          },
        })

        for (const bonif of bonificacoesLiberadas) {
          // Mark as ESTORNADO
          await db.transacaoBonificacao.update({
            where: { id: bonif.id },
            data: {
              status: 'ESTORNADO',
              dataEstorno: new Date(),
            },
          })

          // Update carteira: saldoDisponivel -= valor, saldoDevedor += valor if needed
          const carteira = await db.carteiraDigital.findUnique({
            where: { id: bonif.carteiraId },
          })

          if (carteira) {
            const novoSaldoDisponivel = Math.max(0, carteira.saldoDisponivel - bonif.valor)
            const deficit = carteira.saldoDisponivel - bonif.valor < 0
              ? Math.abs(carteira.saldoDisponivel - bonif.valor)
              : 0

            await db.carteiraDigital.update({
              where: { id: bonif.carteiraId },
              data: {
                saldoDisponivel: novoSaldoDisponivel,
                saldoDevedor: carteira.saldoDevedor + deficit,
                updatedAt: new Date(),
              },
            })
          }
        }

        if (bonificacoesLiberadas.length > 0) {
          await db.auditLog.create({
            data: {
              entidade: 'TransacaoBonificacao',
              entidadeId: sinistro.contratoId,
              acao: 'ESTORNO',
              atorId: userId,
              ipAddress,
              valoresNovos: JSON.stringify({
                quantidadeEstornada: bonificacoesLiberadas.length,
                valorTotalEstornado: bonificacoesLiberadas.reduce((sum, b) => sum + b.valor, 0),
                motivo: 'Estorno por óbito do titular — sinistro aprovado',
              }),
              observacao: `${bonificacoesLiberadas.length} bonificações LIBERADO → ESTORNADO por óbito do titular.`,
            },
          })
        }
      }

      // Audit log for the sinistro status change
      await db.auditLog.create({
        data: {
          entidade: 'Sinistro',
          entidadeId: id,
          acao: 'APROVACAO',
          atorId: userId,
          ipAddress,
          valoresAnteriores,
          valoresNovos: JSON.stringify({
            status: 'APROVADO',
            isTitular,
            isObito,
            remissaoCreated: isTitular && isObito && !sinistro.contrato.remissao,
            bonificacoesEstornadas: isTitular && isObito ? (await db.transacaoBonificacao.count({
              where: { origemContratoId: sinistro.contratoId, status: 'ESTORNADO' },
            })) : 0,
          }),
          observacao: `Sinistro aprovado por ${user?.nome || userId}. Titular: ${isTitular}, Óbito: ${isObito}`,
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Status não tratado.' }, { status: 400 })
  } catch (error) {
    console.error('Update sinistro error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
