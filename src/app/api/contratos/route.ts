import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sanitizePessoaFisica, sanitizeCPF } from '@/lib/sanitization'
import {
  checkContratoAtivoPorTitular,
  validateAge,
  validateSubDependenteEligibility,
  validatePlanoPermiteDependentes,
  validateParentescoPorTipo,
  validateFieldFormats,
} from '@/lib/validations'

// GET /api/contratos - List contracts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where = status ? { status } : {}

    const contratos = await db.contrato.findMany({
      where,
      include: {
        titular: { select: { id: true, nomeCompleto: true, cpf: true } },
        plano: { select: { nome: true, tipo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(contratos)
  } catch (error) {
    console.error('List contratos error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/contratos - Create contract with full validation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { planoId, titular, vinculos: vinculosInput, patrocinadorId } = body

    // ─── Basic payload validation ───
    if (!planoId) {
      return NextResponse.json({ error: 'planoId é obrigatório' }, { status: 400 })
    }
    if (!titular || !titular.nomeCompleto) {
      return NextResponse.json({ error: 'Dados do titular são obrigatórios' }, { status: 400 })
    }

    // ─── Sanitize titular data ───
    const titularSanitized = sanitizePessoaFisica(titular)

    // ─── Validate titular field formats ───
    const titularErrors = validateFieldFormats(titularSanitized)
    if (titularErrors.length > 0) {
      return NextResponse.json({ error: titularErrors.join(' ') }, { status: 400 })
    }

    // ─── Profissão required for TITULAR ───
    if (!titularSanitized.profissao || titularSanitized.profissao.trim().length === 0) {
      return NextResponse.json({ error: 'Profissão é obrigatória para o titular.' }, { status: 422 })
    }

    // ─── Validate CPF format ───
    if (titularSanitized.cpf) {
      const cpfDigits = titularSanitized.cpf.replace(/\D/g, '')
      if (cpfDigits.length !== 11 || /^(\d)\1{10}$/.test(cpfDigits)) {
        return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
      }
    }

    // ─── Get plan ───
    const plano = await db.plano.findUnique({ where: { id: planoId } })
    if (!plano) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    // ─── Find or create titular pessoa fisica ───
    let titularPessoa = null
    if (titularSanitized.cpf) {
      const cpfClean = sanitizeCPF(titularSanitized.cpf)
      titularPessoa = await db.pessoaFisica.findUnique({ where: { cpf: cpfClean } })

      if (titularPessoa) {
        // Check if data_nascimento matches (Identificação Unificada)
        if (titularSanitized.dataNascimento) {
          const existingBirth = titularPessoa.dataNascimento.toISOString().split('T')[0]
          const newBirth = new Date(titularSanitized.dataNascimento).toISOString().split('T')[0]
          if (existingBirth !== newBirth) {
            return NextResponse.json(
              { error: 'Este CPF já está cadastrado para outra pessoa. Data de nascimento divergente.' },
              { status: 409 }
            )
          }
        }
      }
    }

    if (!titularPessoa) {
      titularPessoa = await db.pessoaFisica.create({
        data: {
          nomeCompleto: titularSanitized.nomeCompleto,
          dataNascimento: titularSanitized.dataNascimento ? new Date(titularSanitized.dataNascimento) : new Date(),
          cpf: titularSanitized.cpf ? sanitizeCPF(titularSanitized.cpf) : null,
          genero: titularSanitized.genero || null,
          estadoCivil: titularSanitized.estadoCivil || 'SOLTEIRO',
          tipoRegistro: 'TITULAR',
          profissao: titularSanitized.profissao || null,
          email: titularSanitized.email || null,
          telefone: titularSanitized.telefone || null,
          cep: titularSanitized.cep || null,
          logradouro: titularSanitized.logradouro || null,
          numero: titularSanitized.numero || null,
          complemento: titularSanitized.complemento || null,
          bairro: titularSanitized.bairro || null,
          cidade: titularSanitized.cidade || null,
          estado: titularSanitized.estado || null,
        },
      })
    }

    // ─── RN-01: Check unique active contract per titular ───
    const hasActiveContract = await checkContratoAtivoPorTitular(titularPessoa.id)
    if (hasActiveContract) {
      return NextResponse.json(
        { error: 'Titular já possui contrato ativo (Aguardando Aprovação, Aprovado ou Suspenso).' },
        { status: 409 }
      )
    }

    // ─── RN-02: Validate titular age ───
    const ageCheck = await validateAge(titularPessoa.dataNascimento, 'TITULAR', '')
    if (!ageCheck.valid) {
      return NextResponse.json({ error: ageCheck.message }, { status: 400 })
    }

    // ─── Process vínculos ───
    const vinculosProcessed: Array<{
      pessoa: { id: string; nomeCompleto: string; dataNascimento: Date }
      vinculo: { tipoVinculo: string; parentesco: string; agregadoPaiId?: string }
      coverageTag: boolean
    }> = []

    const planoConfig = await validatePlanoPermiteDependentes(planoId)
    let dependentesCount = 0
    let agregadosCount = 0

    if (vinculosInput && vinculosInput.length > 0) {
      for (const vinc of vinculosInput) {
        // Sanitize vinculo data
        const vincSanitized = sanitizePessoaFisica(vinc)

        // Validate field formats
        const vincErrors = validateFieldFormats(vincSanitized)
        if (vincErrors.length > 0) {
          return NextResponse.json({ error: `Vínculo ${vincSanitized.nomeCompleto}: ${vincErrors.join(' ')}` }, { status: 400 })
        }

        const tipoVinculo = vincSanitized.tipoVinculo || 'DEPENDENTE'
        const parentesco = vincSanitized.parentesco || 'FILHO'

        // ─── Validate parentesco for tipo_vinculo ───
        const parentescoCheck = validateParentescoPorTipo(tipoVinculo, parentesco)
        if (!parentescoCheck.valid) {
          return NextResponse.json({ error: `${vincSanitized.nomeCompleto}: ${parentescoCheck.message}` }, { status: 400 })
        }

        // ─── RN-05: Block DEPENDENTE/SUB_DEPENDENTE in INDIVIDUAL plan ───
        if (!planoConfig.permite && (tipoVinculo === 'DEPENDENTE' || tipoVinculo === 'SUB_DEPENDENTE')) {
          return NextResponse.json(
            { error: `Plano Individual não permite ${tipoVinculo === 'DEPENDENTE' ? 'dependentes' : 'sub-dependentes'}.` },
            { status: 400 }
          )
        }

        // ─── Count and enforce limits ───
        if (tipoVinculo === 'DEPENDENTE') {
          dependentesCount++
          if (dependentesCount > planoConfig.maxDependentes) {
            return NextResponse.json(
              { error: `Limite de ${planoConfig.maxDependentes} dependentes por contrato excedido.` },
              { status: 400 }
            )
          }
        } else if (tipoVinculo === 'AGREGADO') {
          agregadosCount++
          if (agregadosCount > planoConfig.maxAgregados) {
            return NextResponse.json(
              { error: `Limite de ${planoConfig.maxAgregados} agregados por contrato excedido.` },
              { status: 400 }
            )
          }
          // Profissão required for AGREGADO
          if (!vincSanitized.profissao || vincSanitized.profissao.trim().length === 0) {
            return NextResponse.json(
              { error: `Profissão é obrigatória para o agregado ${vincSanitized.nomeCompleto}.` },
              { status: 422 }
            )
          }
        }

        // ─── RN-03: Sub-dependente eligibility ───
        let agregadoPaiId: string | undefined
        if (tipoVinculo === 'SUB_DEPENDENTE') {
          if (!vincSanitized.agregadoPaiId) {
            return NextResponse.json(
              { error: `Sub-dependente ${vincSanitized.nomeCompleto} deve ter um agregado pai.` },
              { status: 400 }
            )
          }
          const eligibilityCheck = await validateSubDependenteEligibility(vincSanitized.agregadoPaiId)
          if (!eligibilityCheck.valid) {
            return NextResponse.json({ error: `${vincSanitized.nomeCompleto}: ${eligibilityCheck.message}` }, { status: 400 })
          }
          agregadoPaiId = vincSanitized.agregadoPaiId
        }

        // ─── Create pessoa fisica for vinculo ───
        const tipoRegistro = tipoVinculo === 'SUB_DEPENDENTE' ? 'SUB_DEPENDENTE' : tipoVinculo
        const vincPessoa = await db.pessoaFisica.create({
          data: {
            nomeCompleto: vincSanitized.nomeCompleto,
            dataNascimento: vincSanitized.dataNascimento ? new Date(vincSanitized.dataNascimento) : new Date(),
            tipoRegistro,
            genero: vincSanitized.genero || null,
            estadoCivil: vincSanitized.estadoCivil || 'SOLTEIRO',
            titularRaizId: titularPessoa.id,
            profissao: tipoVinculo === 'AGREGADO' ? vincSanitized.profissao : null,
            // Agregados use their own or titular's address
            email: tipoVinculo === 'AGREGADO' ? (vincSanitized.email || titularSanitized.email) : (vincSanitized.email || null),
            telefone: tipoVinculo === 'AGREGADO' ? (vincSanitized.telefone || titularSanitized.telefone) : (vincSanitized.telefone || null),
            cep: tipoVinculo === 'AGREGADO' ? (vincSanitized.cep || titularSanitized.cep) : (vincSanitized.cep || null),
            logradouro: tipoVinculo === 'AGREGADO' ? (vincSanitized.logradouro || titularSanitized.logradouro) : (vincSanitized.logradouro || null),
            numero: tipoVinculo === 'AGREGADO' ? (vincSanitized.numero || titularSanitized.numero) : (vincSanitized.numero || null),
            complemento: tipoVinculo === 'AGREGADO' ? (vincSanitized.complemento || titularSanitized.complemento) : (vincSanitized.complemento || null),
            bairro: tipoVinculo === 'AGREGADO' ? (vincSanitized.bairro || titularSanitized.bairro) : (vincSanitized.bairro || null),
            cidade: tipoVinculo === 'AGREGADO' ? (vincSanitized.cidade || titularSanitized.cidade) : (vincSanitized.cidade || null),
            estado: tipoVinculo === 'AGREGADO' ? (vincSanitized.estado || titularSanitized.estado) : (vincSanitized.estado || null),
          },
        })

        // ─── RN-02/RN-06: Age validation for vinculo ───
        const vincAgeCheck = await validateAge(vincPessoa.dataNascimento, tipoRegistro, parentesco)
        if (!vincAgeCheck.valid) {
          // Rollback: delete the pessoa we just created
          await db.pessoaFisica.delete({ where: { id: vincPessoa.id } })
          return NextResponse.json({ error: `${vincSanitized.nomeCompleto}: ${vincAgeCheck.message}` }, { status: 400 })
        }

        vinculosProcessed.push({
          pessoa: { id: vincPessoa.id, nomeCompleto: vincPessoa.nomeCompleto, dataNascimento: vincPessoa.dataNascimento },
          vinculo: {
            tipoVinculo,
            parentesco,
            ...(agregadoPaiId ? { agregadoPaiId } : {}),
          },
          coverageTag: vincAgeCheck.coverageTag,
        })
      }
    }

    // ─── Create contract ───
    const contrato = await db.contrato.create({
      data: {
        titularId: titularPessoa.id,
        planoId: planoId,
        seguradoraId: null, // Air-Gap: not set until approval
        status: 'AGUARDANDO_APROVACAO',
        valorParcelaBase: plano.valorBase,
        valorTaxaAdesao: plano.valorTaxaAdesao,
        patrocinadorId: patrocinadorId || null,
      },
      include: { titular: true, plano: true },
    })

    // ─── Create vinculos ───
    for (const v of vinculosProcessed) {
      await db.vinculo.create({
        data: {
          titularRaizId: titularPessoa.id,
          pessoaVinculadaId: v.pessoa.id,
          tipoVinculo: v.vinculo.tipoVinculo,
          parentesco: v.vinculo.parentesco,
          agregadoPaiId: v.vinculo.agregadoPaiId || null,
        },
      })
    }

    // ─── Create CarteiraDigital for titular (ADR-005 harmonization) ───
    const existingCarteira = await db.carteiraDigital.findUnique({
      where: { titularId: titularPessoa.id }
    })
    if (!existingCarteira) {
      await db.carteiraDigital.create({
        data: {
          titularId: titularPessoa.id,
          saldoDisponivel: 0,
          saldoBloqueado: 0,
          saldoDevedor: 0,
        },
      })
    }

    // ─── Create ContasAPagar for taxa de adesão + first parcela ───
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Taxa de adesão
    await db.contaAPagar.create({
      data: {
        contratoId: contrato.id,
        descricao: 'Taxa de Adesão - Plano ' + plano.nome,
        valor: plano.valorTaxaAdesao,
        valorRestante: plano.valorTaxaAdesao,
        dataVencimento: today,
        status: 'PENDENTE',
      },
    })

    // Primeira mensalidade
    await db.contaAPagar.create({
      data: {
        contratoId: contrato.id,
        descricao: '1ª Mensalidade - Plano ' + plano.nome,
        valor: plano.valorBase,
        valorRestante: plano.valorBase,
        dataVencimento: nextMonth,
        status: 'PENDENTE',
      },
    })

    // ─── Create patrocínio if patrocinadorId provided ───
    if (patrocinadorId) {
      const patrocinador = await db.pessoaFisica.findUnique({ where: { id: patrocinadorId } })
      if (patrocinador) {
        // Get patrocinador's current level
        const patrocinioAtivo = await db.patrocinio.findFirst({
          where: { revendedorId: patrocinadorId, dataFimVinculo: null }
        })
        const novoNivel = patrocinioAtivo ? patrocinioAtivo.nivelProfundidade + 1 : 1

        await db.patrocinio.create({
          data: {
            revendedorId: titularPessoa.id,
            patrocinadorId: patrocinadorId,
            nivelProfundidade: novoNivel,
          },
        })
      }
    }

    // ─── Audit log ───
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: contrato.id,
        acao: 'CREATE',
        valoresNovos: JSON.stringify({
          status: 'AGUARDANDO_APROVACAO',
          planoId,
          titularId: titularPessoa.id,
          vinculosCount: vinculosProcessed.length,
          coverageTags: vinculosProcessed.filter(v => v.coverageTag).map(v => v.pessoa.nomeCompleto),
        }),
      },
    })

    // ─── Response with coverage tags info ───
    const coverageWarnings = vinculosProcessed
      .filter(v => v.coverageTag)
      .map(v => ({ nome: v.pessoa.nomeCompleto, tag: 'SEM DIREITO À PROTEÇÃO' }))

    return NextResponse.json({
      ...contrato,
      _meta: {
        coverageWarnings,
        vinculosCount: vinculosProcessed.length,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('Create contrato error:', error)
    // Handle Prisma unique constraint violation (CPF already exists race condition)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json({ error: 'CPF já cadastrado para outra pessoa.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
