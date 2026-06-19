import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Air-Gap response guard: campos que NUNCA devem ser expostos publicamente
const FORBIDDEN_FIELDS = ['seguradoraId', 'capitalSegurado', 'seguradora_id', 'capital_segurado']

// GET /api/planos - Planos públicos SEM dados de seguradora (Air-Gap!)
export async function GET(request: Request) {
  // Rate limiting: 100 req/s por IP para endpoints de leitura (SPEC-07 §5.2)
  const clientIp = getClientIp(request)
  const rateCheck = checkRateLimit(`planos:${clientIp}`, { maxRequests: 100, windowMs: 1000 })
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns segundos.' },
      { status: 429, headers: { 'Retry-After': '1' } }
    )
  }

  try {
    const planos = await db.plano.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        valorBase: true,
        valorTaxaAdesao: true,
        valorPorAgregado: true,
        maxDependentes: true,
        maxAgregados: true,
        descricao: true,
      },
      orderBy: { valorBase: 'asc' },
    })

    // Air-Gap Security Guard (RN-03): Verifica se nenhum campo proibido vazou na resposta
    const sanitized = planos.map(plano => {
      const keys = Object.keys(plano)
      const violation = keys.find(key => FORBIDDEN_FIELDS.includes(key))
      if (violation) {
        console.error(`SUSEP_AIR_GAP_VIOLATION: Campo proibido "${violation}" detectado na resposta de planos!`)
        throw new Error('AIR_GAP_VIOLATION')
      }
      return plano
    })

    return NextResponse.json(sanitized)
  } catch (error: unknown) {
    // Se violação do Air-Gap, retorna erro genérico sem expor detalhes
    if (error instanceof Error && error.message === 'AIR_GAP_VIOLATION') {
      return NextResponse.json(
        { error: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      )
    }
    console.error('List planos error:', error)
    // EC-01: Retorna 503 em vez de 500 para indisponibilidade de API pública
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.' },
      { status: 503 }
    )
  }
}
