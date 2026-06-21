import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkSuperAdmin, extractRequestMeta } from '@/lib/auth-helpers'
import { sanitizeString } from '@/lib/sanitization'

/**
 * POST /api/contratos/[id]/suspensao
 * RN-03: Contract suspension and reativação (Récita)
 * Body: { acao: 'SUSPENDER' | 'REATIVAR', motivo: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, ipAddress } = extractRequestMeta(request)

    // SuperAdmin role check
    const { authorized, user } = await checkSuperAdmin(userId, request)
    if (!authorized) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas SuperAdmin pode suspender/reativar contratos.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { acao, motivo } = body

    if (!acao || !['SUSPENDER', 'REATIVAR'].includes(acao)) {
      return NextResponse.json(
        { error: "Ação inválida. Use 'SUSPENDER' ou 'REATIVAR'." },
        { status: 400 }
      )
    }

    if (!motivo || motivo.trim().length === 0) {
      return NextResponse.json(
        { error: 'Motivo é obrigatório para suspensão/reativação.' },
        { status: 400 }
      )
    }

    const contrato = await db.contrato.findUnique({
      where: { id },
      include: {
        titular: { select: { id: true, nomeCompleto: true } },
      },
    })

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }

    const valoresAnteriores = JSON.stringify({
      status: contrato.status,
      dataSuspensao: contrato.dataSuspensao?.toISOString() || null,
    })

    if (acao === 'SUSPENDER') {
      // ── SUSPENDER ──
      if (contrato.status !== 'APROVADO') {
        return NextResponse.json(
          { error: `Contrato com status '${contrato.status}' não pode ser suspenso. Requer status APROVADO.` },
          { status: 400 }
        )
      }

      // Calculate days overdue for audit
      let diasAtraso = 0
      const contasVencidas = await db.contaAPagar.findMany({
        where: {
          contratoId: id,
          status: 'PENDENTE',
          dataVencimento: { lt: new Date() },
        },
        orderBy: { dataVencimento: 'asc' },
      })

      if (contasVencidas.length > 0) {
        const primeiraVencida = contasVencidas[0].dataVencimento
        diasAtraso = Math.floor((Date.now() - primeiraVencida.getTime()) / (1000 * 60 * 60 * 24))
      }

      const contratoAtualizado = await db.contrato.update({
        where: { id },
        data: {
          status: 'SUSPENSO',
          dataSuspensao: new Date(),
          updatedAt: new Date(),
        },
      })

      await db.auditLog.create({
        data: {
          entidade: 'Contrato',
          entidadeId: id,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores,
          valoresNovos: JSON.stringify({
            status: 'SUSPENSO',
            dataSuspensao: new Date().toISOString(),
          }),
          observacao: `Contrato SUSPENSO por ${user?.nome || userId}. Motivo: ${sanitizeString(motivo)}. Dias em atraso: ${diasAtraso}. Contas vencidas: ${contasVencidas.length}. Titular: ${contrato.titular.nomeCompleto}`,
        },
      })

      return NextResponse.json({
        contrato: contratoAtualizado,
        diasAtraso,
        contasVencidas: contasVencidas.length,
      })
    }

    // ── REATIVAR (Récita) ──
    if (acao === 'REATIVAR') {
      if (contrato.status !== 'SUSPENSO') {
        return NextResponse.json(
          { error: `Contrato com status '${contrato.status}' não pode ser reativado. Requer status SUSPENSO.` },
          { status: 400 }
        )
      }

      const contratoAtualizado = await db.contrato.update({
        where: { id },
        data: {
          status: 'APROVADO',
          dataSuspensao: null,
          updatedAt: new Date(),
        },
      })

      await db.auditLog.create({
        data: {
          entidade: 'Contrato',
          entidadeId: id,
          acao: 'UPDATE',
          atorId: userId,
          ipAddress,
          valoresAnteriores,
          valoresNovos: JSON.stringify({
            status: 'APROVADO',
            dataSuspensao: null,
          }),
          observacao: `Contrato REATIVADO (Récita) por ${user?.nome || userId}. Motivo: ${sanitizeString(motivo)}. EC-08: Carência pode necessitar recálculo. Titular: ${contrato.titular.nomeCompleto}`,
        },
      })

      return NextResponse.json({
        contrato: contratoAtualizado,
        alerta: 'EC-08: Carência pode necessitar recálculo após reativação.',
      })
    }

    return NextResponse.json({ error: 'Ação não tratada.' }, { status: 400 })
  } catch (error) {
    console.error('Suspensão/Reativação error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
