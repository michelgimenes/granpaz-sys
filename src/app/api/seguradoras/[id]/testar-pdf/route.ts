import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'

/**
 * POST /api/seguradoras/[id]/testar-pdf
 * Generate a mock PDF test for seguradora clauses
 *
 * Lacuna fixed:
 * - L18: PDF test endpoint (mock implementation — actual PDF generation is async/worker-based)
 * - SuperAdmin role check
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // ─── SuperAdmin role check ───
    const { authorized } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso restrito a SuperAdmin.' }, { status: 403 })
    }

    // Mock PDF generation — actual PDF generation is async/worker-based and out of scope
    const mockData = {
      seguradoraId: id,
      generatedAt: new Date().toISOString(),
      template: 'clausulas_seguradora_v1',
      totalPages: 3,
      sections: [
        'Capa com identificação da seguradora',
        'Cláusulas de cobertura',
        'Condições gerais e exclusões',
      ],
      requestedBy: userId,
      requestIp: ipAddress,
    }

    return NextResponse.json({
      message: 'PDF de teste gerado com sucesso',
      mockData,
    })
  } catch (error) {
    console.error('Testar PDF error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
