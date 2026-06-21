import { NextResponse } from 'next/server'
import { canRunJob } from '@/lib/jobs-auth'

/**
 * POST /api/jobs/run-all
 * Orchestrator: triggers all scheduled jobs sequentially.
 * Accepts JOB_API_KEY (cron) or SuperAdmin (manual).
 *
 * Cron schedule (vercel.json):
 * - 06:00 daily:    recorrência (gerar boletos)
 * - 07:00 daily:    suspensão automática por inadimplência
 * - 08:00 weekly:   maioridade (expirar dependentes 21+ anos)
 * - 09:00 weekly:   LGPD (anonimização 5+ anos)
 */
export async function POST(request: Request) {
  try {
    const jobAuth = await canRunJob(request)
    if (!jobAuth.authorized) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.JOB_API_KEY || '',
    }

    const jobs = [
      { name: 'recorrencia', path: '/api/jobs/recorrencia' },
      { name: 'suspensao-auto', path: '/api/compliance/suspensao-auto' },
      { name: 'maioridade', path: '/api/compliance/maioridade' },
      { name: 'lgpd', path: '/api/compliance/lgpd' },
    ]

    const results: Array<{ job: string; status: string; data?: unknown; error?: string }> = []

    for (const job of jobs) {
      try {
        const res = await fetch(`${baseUrl}${job.path}`, {
          method: 'POST',
          headers,
        })
        const data = await res.json()
        results.push({
          job: job.name,
          status: res.ok ? 'OK' : 'FAIL',
          ...(res.ok ? { data } : { error: data.error || 'Erro desconhecido' }),
        })
      } catch (err) {
        results.push({
          job: job.name,
          status: 'ERROR',
          error: err instanceof Error ? err.message : 'Erro de conexão',
        })
      }
    }

    const allOk = results.every(r => r.status === 'OK')

    return NextResponse.json({
      message: allOk ? 'Todos os jobs executados com sucesso.' : 'Alguns jobs falharam.',
      results,
    }, { status: allOk ? 200 : 500 })
  } catch (error) {
    console.error('Run-all jobs error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
