import { NextResponse } from 'next/server'

// GET /api/viacep?cep=00000000 — Proxy to ViaCEP with timeout and fallback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cep = searchParams.get('cep')?.replace(/\D/g, '')

  if (!cep || cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000) // 2s timeout per SPEC

    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })
    }

    const data = await res.json()
    if (data.erro) {
      return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })
    }

    // Return only the fields we need (Air-Gap: don't expose everything)
    return NextResponse.json({
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
      complemento: data.complemento || '',
    })
  } catch (error) {
    // Timeout or network error - return empty so frontend enables manual input
    return NextResponse.json({ error: 'Serviço indisponível', fallback: true }, { status: 503 })
  }
}
