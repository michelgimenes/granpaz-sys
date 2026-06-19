import { db } from '@/lib/db'
import { sanitizeCPF } from '@/lib/sanitization'
import { NextResponse } from 'next/server'

// GET /api/pessoas-fisicas/buscar-por-cpf?cpf=00000000000
// Identificação Unificada: returns minimal data for CPF lookup
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cpfRaw = searchParams.get('cpf')

    if (!cpfRaw) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })
    }

    // Sanitize CPF — strip formatting dots/dashes
    const cpf = sanitizeCPF(cpfRaw)

    const pessoa = await db.pessoaFisica.findUnique({
      where: { cpf },
      select: {
        id: true,
        nomeCompleto: true,
        dataNascimento: true,
        genero: true,
        estadoCivil: true,
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
        tipoRegistro: true,
      },
    })

    if (!pessoa) {
      return NextResponse.json({ found: false }, { status: 404 })
    }

    // Return data for Identificação Unificada flow
    // Frontend will compare dataNascimento and show modal or block
    return NextResponse.json({ found: true, ...pessoa })
  } catch (error) {
    console.error('Buscar CPF error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
