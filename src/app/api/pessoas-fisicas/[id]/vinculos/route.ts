import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sanitizePessoaFisica, sanitizeCPF } from '@/lib/sanitization'
import { checkOwnership } from '@/lib/auth-helpers'
import {
  validateAge,
  validateSubDependenteEligibility,
  validateParentescoPorTipo,
  validateFieldFormats,
  validateEmail,
  getConfigInt,
} from '@/lib/validations'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const ownership = await checkOwnership(request, id)
    if (!ownership.authorized) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }

    const titular = await db.pessoaFisica.findUnique({ where: { id } })
    if (!titular || titular.tipoRegistro !== 'TITULAR') {
      return NextResponse.json({ error: 'Titular não encontrado.' }, { status: 404 })
    }

    const contratoAtivo = await db.contrato.findFirst({
      where: { titularId: id, status: { in: ['AGUARDANDO_APROVACAO', 'APROVADO', 'SUSPENSO'] } },
      include: { plano: true },
    })
    if (!contratoAtivo) {
      return NextResponse.json({ error: 'Nenhum contrato ativo encontrado.' }, { status: 400 })
    }

    const body = await request.json()
    const sanitized = sanitizePessoaFisica(body)

    const tipoVinculo = sanitized.tipoVinculo || 'DEPENDENTE'
    const parentesco = sanitized.parentesco || 'FILHO'

    const VALID_TYPES = ['DEPENDENTE', 'AGREGADO', 'SUB_DEPENDENTE']
    if (!VALID_TYPES.includes(tipoVinculo)) {
      return NextResponse.json({ error: 'Tipo de vínculo inválido.' }, { status: 400 })
    }

    const parentescoCheck = validateParentescoPorTipo(tipoVinculo, parentesco)
    if (!parentescoCheck.valid) {
      return NextResponse.json({ error: parentescoCheck.message }, { status: 400 })
    }

    const fieldErrors = validateFieldFormats(sanitized)
    if (fieldErrors.length > 0) {
      return NextResponse.json({ error: fieldErrors.join(' ') }, { status: 400 })
    }

    if (sanitized.email && !validateEmail(sanitized.email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    if (contratoAtivo.plano.tipo !== 'FAMILIAR' && (tipoVinculo === 'DEPENDENTE' || tipoVinculo === 'SUB_DEPENDENTE')) {
      return NextResponse.json({ error: 'Plano Individual não permite dependentes.' }, { status: 400 })
    }

    const vinculosAtivos = await db.vinculo.findMany({
      where: { titularRaizId: id, dataFimVinculo: null },
    })
    const dependentesCount = vinculosAtivos.filter(v => v.tipoVinculo === 'DEPENDENTE').length
    const agregadosCount = vinculosAtivos.filter(v => v.tipoVinculo === 'AGREGADO').length

    if (tipoVinculo === 'DEPENDENTE' && dependentesCount >= (contratoAtivo.plano.maxDependentes ?? 8)) {
      return NextResponse.json({ error: `Limite de ${contratoAtivo.plano.maxDependentes} dependentes excedido.` }, { status: 400 })
    }
    if (tipoVinculo === 'AGREGADO' && agregadosCount >= (contratoAtivo.plano.maxAgregados ?? 4)) {
      return NextResponse.json({ error: `Limite de ${contratoAtivo.plano.maxAgregados} agregados excedido.` }, { status: 400 })
    }

    let agregadoPaiId: string | undefined
    if (tipoVinculo === 'SUB_DEPENDENTE') {
      if (!sanitized.agregadoPaiId) {
        return NextResponse.json({ error: 'Sub-dependente deve ter um agregado pai.' }, { status: 400 })
      }
      const eligibility = await validateSubDependenteEligibility(sanitized.agregadoPaiId)
      if (!eligibility.valid) {
        return NextResponse.json({ error: eligibility.message }, { status: 400 })
      }
      agregadoPaiId = sanitized.agregadoPaiId
    }

    if (tipoVinculo === 'AGREGADO') {
      if (!sanitized.cep || !sanitized.logradouro || !sanitized.bairro || !sanitized.cidade || !sanitized.estado) {
        return NextResponse.json({ error: 'Agregado: endereço completo é obrigatório.' }, { status: 400 })
      }
      if (!sanitized.telefone) {
        return NextResponse.json({ error: 'Agregado: telefone é obrigatório.' }, { status: 400 })
      }
      if (!sanitized.email) {
        return NextResponse.json({ error: 'Agregado: e-mail é obrigatório.' }, { status: 400 })
      }
      if (!sanitized.profissao) {
        return NextResponse.json({ error: 'Agregado: profissão é obrigatória.' }, { status: 400 })
      }
    }

    let pessoaVinculada = null
    if (sanitized.cpf) {
      const cpfClean = sanitizeCPF(sanitized.cpf)
      pessoaVinculada = await db.pessoaFisica.findUnique({ where: { cpf: cpfClean } })
      if (pessoaVinculada) {
        const existingBirth = pessoaVinculada.dataNascimento.toISOString().split('T')[0]
        const newBirth = new Date(sanitized.dataNascimento).toISOString().split('T')[0]
        if (existingBirth !== newBirth) {
          return NextResponse.json({ error: 'CPF já cadastrado para outra pessoa com data de nascimento divergente.' }, { status: 409 })
        }
      }
    }

    const tipoRegistro = tipoVinculo === 'SUB_DEPENDENTE' ? 'SUB_DEPENDENTE' : tipoVinculo

    if (!pessoaVinculada) {
      pessoaVinculada = await db.pessoaFisica.create({
        data: {
          nomeCompleto: sanitized.nomeCompleto,
          dataNascimento: sanitized.dataNascimento ? new Date(sanitized.dataNascimento) : new Date(),
          cpf: sanitized.cpf ? sanitizeCPF(sanitized.cpf) : null,
          tipoRegistro,
          genero: sanitized.genero || null,
          estadoCivil: sanitized.estadoCivil || 'SOLTEIRO',
          titularRaizId: id,
          profissao: tipoVinculo === 'AGREGADO' ? sanitized.profissao : null,
          email: sanitized.email || null,
          telefone: sanitized.telefone || null,
          cep: sanitized.cep || null,
          logradouro: sanitized.logradouro || null,
          numero: sanitized.numero || null,
          complemento: sanitized.complemento || null,
          bairro: sanitized.bairro || null,
          cidade: sanitized.cidade || null,
          estado: sanitized.estado || null,
        },
      })
    }

    const ageCheck = await validateAge(pessoaVinculada.dataNascimento, tipoRegistro, parentesco)
    if (!ageCheck.valid) {
      if (!sanitized.cpf) {
        await db.pessoaFisica.delete({ where: { id: pessoaVinculada.id } })
      }
      return NextResponse.json({ error: ageCheck.message }, { status: 400 })
    }

    const vinculo = await db.vinculo.create({
      data: {
        titularRaizId: id,
        pessoaVinculadaId: pessoaVinculada.id,
        tipoVinculo,
        parentesco,
        agregadoPaiId: agregadoPaiId || null,
      },
      include: {
        pessoaVinculada: {
          select: { id: true, nomeCompleto: true, tipoRegistro: true, dataNascimento: true, cpf: true },
        },
      },
    })

    if (contratoAtivo.plano.valorPorAgregado > 0 && tipoVinculo === 'AGREGADO') {
      const novosAgregados = agregadosCount + 1
      const novoValorTotal = contratoAtivo.plano.valorPorAgregado * novosAgregados
      await db.contrato.update({
        where: { id: contratoAtivo.id },
        data: { valorTotalAgregados: novoValorTotal },
      })
    }

    await db.auditLog.create({
      data: {
        entidade: 'Vinculo',
        entidadeId: vinculo.id,
        acao: 'CREATE',
        atorId: request.headers.get('x-user-id'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresNovos: JSON.stringify({
          tipoVinculo,
          parentesco,
          pessoaVinculadaId: pessoaVinculada.id,
          agregadoPaiId: agregadoPaiId || null,
          coverageTag: ageCheck.coverageTag,
        }),
      },
    })

    return NextResponse.json({
      ...vinculo,
      coverageTag: ageCheck.coverageTag,
      coverageMessage: ageCheck.message || null,
    }, { status: 201 })
  } catch (error) {
    console.error('Create vinculo error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
