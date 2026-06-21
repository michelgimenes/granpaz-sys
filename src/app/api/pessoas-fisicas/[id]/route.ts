import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sanitizePessoaFisica, sanitizePhone, sanitizeCEP, sanitizeEmail } from '@/lib/sanitization'
import { checkOwnership } from '@/lib/auth-helpers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const pessoa = await db.pessoaFisica.findUnique({
      where: { id },
      select: {
        id: true,
        nomeCompleto: true,
        dataNascimento: true,
        cpf: true,
        genero: true,
        estadoCivil: true,
        tipoRegistro: true,
        email: true,
        telefone: true,
        profissao: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        titularRaizId: true,
        titularRaiz: {
          select: { id: true, nomeCompleto: true, cpf: true },
        },
      },
    })

    if (!pessoa) {
      return NextResponse.json({ error: 'Pessoa não encontrada.' }, { status: 404 })
    }

    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('Get pessoa fisica error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const ownership = await checkOwnership(request, id)
    if (!ownership.authorized) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }

    const pessoa = await db.pessoaFisica.findUnique({ where: { id } })
    if (!pessoa) {
      return NextResponse.json({ error: 'Pessoa não encontrada.' }, { status: 404 })
    }

    const body = await request.json()
    const sanitized = sanitizePessoaFisica(body)

    const allowedFields = ['email', 'telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'profissao', 'genero']
    const data: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (sanitized[field] !== undefined) {
        data[field] = sanitized[field] === '' ? null : sanitized[field]
      }
    }

    if (data.email !== undefined && data.email !== null) {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!EMAIL_REGEX.test(data.email as string)) {
        return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
      }
    }

    if (data.telefone !== undefined && data.telefone !== null) {
      const digits = (data.telefone as string).replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 11) {
        return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 })
      }
      data.telefone = digits
    }

    if (data.cep !== undefined && data.cep !== null) {
      const digits = (data.cep as string).replace(/\D/g, '')
      if (digits.length !== 8) {
        return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
      }
      data.cep = digits
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
    }

    data.updatedAt = new Date()

    const updated = await db.pessoaFisica.update({
      where: { id },
      data,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        telefone: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        profissao: true,
        genero: true,
        updatedAt: true,
      },
    })

    await db.auditLog.create({
      data: {
        entidade: 'PessoaFisica',
        entidadeId: id,
        acao: 'UPDATE_DADOS_CADASTRAIS',
        atorId: request.headers.get('x-user-id'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        valoresNovos: JSON.stringify(data),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update pessoa fisica error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
