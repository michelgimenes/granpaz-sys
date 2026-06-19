import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where = status ? { status } : {}

    const contratos = await db.contrato.findMany({
      where,
      include: {
        titular: {
          select: { nomeCompleto: true, cpf: true },
        },
        plano: {
          select: { nome: true, tipo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(contratos)
  } catch (error) {
    console.error('List contratos error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { planoId, titular, vinculos } = body

    if (!planoId || !titular || !titular.nomeCompleto) {
      return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 })
    }

    // Get plan details
    const plano = await db.plano.findUnique({ where: { id: planoId } })
    if (!plano) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    // Create or find pessoa fisica
    const pessoaData = {
      nomeCompleto: titular.nomeCompleto,
      dataNascimento: titular.dataNascimento ? new Date(titular.dataNascimento) : new Date(),
      cpf: titular.cpf || null,
      genero: titular.genero || null,
      estadoCivil: titular.estadoCivil || 'SOLTEIRO',
      tipoRegistro: 'TITULAR' as const,
      profissao: titular.profissao || null,
      email: titular.email || null,
      telefone: titular.telefone || null,
      cep: titular.cep || null,
      logradouro: titular.logradouro || null,
      numero: titular.numero || null,
      complemento: titular.complemento || null,
      bairro: titular.bairro || null,
      cidade: titular.cidade || null,
      estado: titular.estado || null,
    }

    let titularPessoa = null
    if (titular.cpf) {
      titularPessoa = await db.pessoaFisica.findUnique({ where: { cpf: titular.cpf } })
    }

    if (!titularPessoa) {
      titularPessoa = await db.pessoaFisica.create({ data: pessoaData })
    }

    // Create contract
    const contrato = await db.contrato.create({
      data: {
        titularId: titularPessoa.id,
        planoId: planoId,
        status: 'AGUARDANDO_APROVACAO',
        valorParcelaBase: plano.valorBase,
        valorTaxaAdesao: plano.valorTaxaAdesao,
      },
      include: {
        titular: true,
        plano: true,
      },
    })

    // Create vinculos if provided
    if (vinculos && vinculos.length > 0) {
      for (const vinc of vinculos) {
        if (!vinc.nomeCompleto) continue

        const vincPessoa = await db.pessoaFisica.create({
          data: {
            nomeCompleto: vinc.nomeCompleto,
            dataNascimento: vinc.dataNascimento ? new Date(vinc.dataNascimento) : new Date(),
            tipoRegistro: vinc.tipoVinculo === 'DEPENDENTE' ? 'DEPENDENTE' : 'AGREGADO',
            genero: vinc.genero || null,
            estadoCivil: 'SOLTEIRO',
            titularRaizId: titularPessoa.id,
          },
        })

        await db.vinculo.create({
          data: {
            titularRaizId: titularPessoa.id,
            pessoaVinculadaId: vincPessoa.id,
            tipoVinculo: vinc.tipoVinculo,
            parentesco: vinc.parentesco,
          },
        })
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        entidade: 'Contrato',
        entidadeId: contrato.id,
        acao: 'CREATE',
        valoresNovos: JSON.stringify({ status: 'AGUARDANDO_APROVACAO', planoId }),
      },
    })

    return NextResponse.json(contrato, { status: 201 })
  } catch (error) {
    console.error('Create contrato error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
