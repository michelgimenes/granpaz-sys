'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { ScrollText, Search } from 'lucide-react'
import { formatDate } from '@/lib/helpers'

interface AuditLog {
  id: string
  entidade: string
  entidadeId: string
  acao: string
  atorId: string | null
  valoresAnteriores: string | null
  valoresNovos: string | null
  ipAddress: string | null
  observacao: string | null
  createdAt: string
}

const acaoColors: Record<string, string> = {
  CREATE: 'bg-state-success/10 text-state-success',
  UPDATE: 'bg-state-warning/10 text-state-warning',
  DELETE: 'bg-state-error/10 text-state-error',
  ESTORNO: 'bg-primary/10 text-primary',
  APROVACAO: 'bg-brand-accent/10 text-brand-accent',
}

function JsonDiffViewer({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) {
  const parseSafe = (val: string | null) => {
    if (!val) return null
    try { return JSON.parse(val) } catch { return val }
  }

  const oldObj = parseSafe(oldVal)
  const newObj = parseSafe(newVal)

  if (typeof oldObj === 'string' || typeof newObj === 'string') {
    return (
      <div className="flex gap-4 text-xs font-mono">
        {oldVal && <div className="text-state-error line-through">{oldVal}</div>}
        {newVal && <div className="text-state-success">{newVal}</div>}
      </div>
    )
  }

  const allKeys = new Set([
    ...(oldObj && typeof oldObj === 'object' ? Object.keys(oldObj) : []),
    ...(newObj && typeof newObj === 'object' ? Object.keys(newObj) : []),
  ])

  return (
    <div className="space-y-1 text-xs font-mono">
      {Array.from(allKeys).map(key => {
        const oldV = oldObj?.[key]
        const newV = newObj?.[key]
        const changed = JSON.stringify(oldV) !== JSON.stringify(newV)

        if (!changed) return null

        return (
          <div key={key} className="flex gap-2">
            <span className="text-muted-foreground w-24 shrink-0">{key}:</span>
            {oldV !== undefined && (
              <span className="text-state-error line-through">{JSON.stringify(oldV)}</span>
            )}
            {newV !== undefined && (
              <span className="text-state-success">{JSON.stringify(newV)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AuditTab() {
  const [entidadeFilter, setEntidadeFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', entidadeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (entidadeFilter) params.set('entidade', entidadeFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  const filtered = logs.filter(l =>
    !search ||
    l.entidadeId.includes(search) ||
    l.acao.includes(search) ||
    (l.observacao && l.observacao.includes(search))
  )

  const entidades = [...new Set(logs.map(l => l.entidade))]

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Auditoria</h1>
        <p className="text-muted-foreground mt-1">Log de ações realizadas na plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Buscar por ID ou ação..."
          />
        </div>
        <select
          value={entidadeFilter}
          onChange={(e) => setEntidadeFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todas as Entidades</option>
          {entidades.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhum log de auditoria encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filtered.map((log) => (
            <Card key={log.id} className="border-border/50">
              <CardContent className="py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${acaoColors[log.acao] || 'bg-muted text-muted-foreground'}`}>
                      {log.acao}
                    </span>
                    <span className="text-xs text-muted-foreground">{log.entidade}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mb-2">
                  ID: {log.entidadeId}
                </p>
                {(log.valoresAnteriores || log.valoresNovos) && (
                  <JsonDiffViewer oldVal={log.valoresAnteriores} newVal={log.valoresNovos} />
                )}
                {log.observacao && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{log.observacao}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
