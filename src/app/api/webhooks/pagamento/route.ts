import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * POST /api/webhooks/pagamento
 * Payment gateway webhook handler
 *
 * Features:
 * - EC-003: Idempotency check — look up webhooks_recebidos by transactionId+source
 * - Save webhook to webhooks_recebidos
 * - Find conta_a_pagar by gatewayTransactionId
 * - Update conta_a_pagar status to PAGO, valorRestante to 0
 * - Audit log
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transactionId, source, event, data } = body

    // ─── Validate required fields ───
    if (!transactionId || !source) {
      return NextResponse.json(
        { error: 'transactionId e source são obrigatórios.' },
        { status: 400 }
      )
    }

    // ─── EC-003: Idempotency check ───
    const existingWebhook = await db.webhookRecebido.findUnique({
      where: {
        transactionId_source: {
          transactionId: String(transactionId),
          source: String(source),
        },
      },
    })

    if (existingWebhook) {
      // Already processed — return 200 (idempotent)
      return NextResponse.json({
        success: true,
        message: 'Webhook já processado anteriormente.',
        idempotent: true,
      })
    }

    // ─── Save webhook to webhooks_recebidos ───
    await db.webhookRecebido.create({
      data: {
        transactionId: String(transactionId),
        source: String(source),
        payload: JSON.stringify(body),
      },
    })

    // ─── Process the webhook ───
    // Try to find conta_a_pagar by gatewayTransactionId
    const gatewayTransactionId = data?.gatewayTransactionId || data?.referenceId || transactionId

    if (gatewayTransactionId) {
      const contaAPagar = await db.contaAPagar.findFirst({
        where: { gatewayTransactionId: String(gatewayTransactionId) },
      })

      if (contaAPagar) {
        // ─── Update conta_a_pagar status to PAGO ───
        await db.contaAPagar.update({
          where: { id: contaAPagar.id },
          data: {
            status: 'PAGO',
            valorRestante: 0,
            updatedAt: new Date(),
          },
        })

        // ─── Audit log ───
        await db.auditLog.create({
          data: {
            entidade: 'ContaAPagar',
            entidadeId: contaAPagar.id,
            acao: 'UPDATE',
            valoresAnteriores: JSON.stringify({
              status: contaAPagar.status,
              valorRestante: contaAPagar.valorRestante,
            }),
            valoresNovos: JSON.stringify({
              status: 'PAGO',
              valorRestante: 0,
              webhookTransactionId: transactionId,
              webhookSource: source,
            }),
            observacao: `Pagamento confirmado via webhook (${source}). Evento: ${event || 'N/A'}`,
          },
        })

        return NextResponse.json({
          success: true,
          processed: true,
          contaAPagarId: contaAPagar.id,
        })
      }
    }

    // Webhook saved but no matching conta_a_pagar found
    return NextResponse.json({
      success: true,
      processed: false,
      message: 'Webhook recebido e salvo, mas nenhuma conta a pagar correspondente encontrada.',
    })
  } catch (error) {
    console.error('Webhook pagamento error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
