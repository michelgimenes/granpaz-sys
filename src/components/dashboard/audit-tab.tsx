'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import {
  ScrollText,
  Search,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from 'lucide-react'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const ENTITY_OPTIONS = [
  { value: '', label: 'Todas as Entidades' },
  { value: 'Contrato', label: 'Contrato' },
  { value: 'PessoaFisica', label: 'Pessoa Física' },
  { value: 'Patrocinio', label: 'Patrocínio' },
  { value: 'ConfiguracaoRegraNegocio', label: 'Configuração' },
  { value: 'Sinistro', label: 'Sinistro' },
  { value: 'TransacaoPagamento', label: 'Transação Pagamento' },
  { value: 'TransacaoBonificacao', label: 'Transação Bonificação' },
  { value: 'CarteiraDigital', label: 'Carteira Digital' },
  { value: 'ContaAPagar', label: 'Conta a Pagar' },
  { value: 'WebhookRecebido', label: 'Webhook' },
  { value: 'LogAnonimizacaoLGPD', label: 'Log Anonimização LGPD' },
]

const ACTION_OPTIONS = [
  { value: '', label: 'Todas as Ações' },
  { value: 'CREATE', label: 'CREATE — Criação' },
  { value: 'UPDATE', label: 'UPDATE — Atualização' },
  { value: 'DELETE', label: 'DELETE — Exclusão' },
  { value: 'ESTORNO', label: 'ESTORNO — Estorno' },
  { value: 'APROVACAO', label: 'APROVAÇÃO — Aprovação' },
  { value: 'REJEICAO', label: 'REJEIÇÃO — Rejeição' },
  { value: 'CANCELAMENTO', label: 'CANCELAMENTO — Cancelamento' },
  { value: 'SUSPENSAO', label: 'SUSPENSÃO — Suspensão' },
]

const acaoColors: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ESTORNO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  APROVACAO: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  REJEICAO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  CANCELAMENTO: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  SUSPENSAO: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
}

const ITEMS_PER_PAGE = 20

// ─────────────────────────────────────────────────────────
// JSON Diff Viewer
// ─────────────────────────────────────────────────────────

function JsonDiffViewer({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) {
  const parseSafe = (val: string | null) => {
    if (!val) return null
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }

  const oldObj = parseSafe(oldVal)
  const newObj = parseSafe(newVal)

  if (typeof oldObj === 'string' || typeof newObj === 'string') {
    return (
      <div className="flex flex-col sm:flex-row gap-2 text-xs font-mono">
        {oldVal && (
          <div className="bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded text-red-700 dark:text-red-300 line-through">
            {oldVal}
          </div>
        )}
        {newVal && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded text-emerald-700 dark:text-emerald-300">
            {newVal}
          </div>
        )}
      </div>
    )
  }

  const allKeys = new Set([
    ...(oldObj && typeof oldObj === 'object' ? Object.keys(oldObj as Record<string, unknown>) : []),
    ...(newObj && typeof newObj === 'object' ? Object.keys(newObj as Record<string, unknown>) : []),
  ])

  return (
    <div className="space-y-1 text-xs font-mono">
      {Array.from(allKeys).map((key) => {
        const oldV = (oldObj as Record<string, unknown>)?.[key]
        const newV = (newObj as Record<string, unknown>)?.[key]
        const changed = JSON.stringify(oldV) !== JSON.stringify(newV)
        if (!changed) return null

        return (
          <div key={key} className="flex flex-col sm:flex-row gap-1 sm:gap-2">
            <span className="text-muted-foreground w-28 shrink-0 text-xs">{key}:</span>
            {oldV !== undefined && (
              <span className="bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded text-red-700 dark:text-red-300 line-through">
                {JSON.stringify(oldV)}
              </span>
            )}
            {newV !== undefined && (
              <span className="bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                {JSON.stringify(newV)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Copy Button
// ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado para a área de transferência')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-5 w-5 p-0 ml-1"
      aria-label="Copiar ID"
    >
      <Copy className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
    </Button>
  )
}

// ─────────────────────────────────────────────────────────
// Truncate ID
// ─────────────────────────────────────────────────────────

function TruncatedId({ id }: { id: string }) {
  if (id.length <= 12) {
    return <span className="font-mono text-xs">{id}</span>
  }
  return (
    <span className="font-mono text-xs inline-flex items-center">
      {id.slice(0, 8)}…{id.slice(-4)}
      <CopyButton text={id} />
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Audit Log Item
// ─────────────────────────────────────────────────────────

function AuditLogItem({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = log.valoresAnteriores || log.valoresNovos

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <button
        type="button"
        className="w-full p-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => hasDiff && setExpanded(!expanded)}
        aria-expanded={expanded}
        disabled={!hasDiff}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${acaoColors[log.acao] || 'bg-muted text-muted-foreground'}`}>
              {log.acao}
            </Badge>
            <span className="text-xs font-medium text-foreground">{log.entidade}</span>
            <TruncatedId id={log.entidadeId} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            {log.atorId && (
              <span title={`Ator: ${log.atorId}`}>
                👤 {log.atorId.length > 8 ? `${log.atorId.slice(0, 8)}…` : log.atorId}
              </span>
            )}
            {log.ipAddress && (
              <span title={`IP: ${log.ipAddress}`}>
                🌐 {log.ipAddress}
              </span>
            )}
            <span className="whitespace-nowrap">{formatDate(log.createdAt)}</span>
            {hasDiff && (
              expanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )
            )}
          </div>
        </div>
      </button>

      {expanded && hasDiff && (
        <div className="px-3 pb-3 pt-0 border-t border-border/30 mt-0 pt-3">
          <JsonDiffViewer oldVal={log.valoresAnteriores} newVal={log.valoresNovos} />
        </div>
      )}

      {log.observacao && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-muted-foreground italic mt-1">
            💬 {log.observacao}
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Export CSV
// ─────────────────────────────────────────────────────────

function exportToCSV(logs: AuditLog[]) {
  const headers = [
    'Data/Hora',
    'Ação',
    'Entidade',
    'ID',
    'Ator',
    'IP',
    'Valores Anteriores',
    'Valores Novos',
    'Observação',
  ]

  const rows = logs.map((log) => [
    new Date(log.createdAt).toLocaleString('pt-BR'),
    log.acao,
    log.entidade,
    log.entidadeId,
    log.atorId || '',
    log.ipAddress || '',
    log.valoresAnteriores ? `"${log.valoresAnteriores.replace(/"/g, '""')}"` : '',
    log.valoresNovos ? `"${log.valoresNovos.replace(/"/g, '""')}"` : '',
    log.observacao ? `"${log.observacao.replace(/"/g, '""')}"` : '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)

  toast.success(`${logs.length} registro(s) exportado(s) com sucesso`)
}

// ─────────────────────────────────────────────────────────
// Main AuditTab Component
// ─────────────────────────────────────────────────────────

export function AuditTab() {
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [atorIdSearch, setAtorIdSearch] = useState('')
  const [entidadeIdSearch, setEntidadeIdSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', entityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (entityFilter) params.set('entidade', entityFilter)
      params.set('limit', '500')
      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar logs')
      return res.json()
    },
  })

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    let result = logs

    if (actionFilter) {
      result = result.filter((l) => l.acao === actionFilter)
    }

    if (dataInicio) {
      const start = new Date(dataInicio)
      result = result.filter((l) => new Date(l.createdAt) >= start)
    }

    if (dataFim) {
      const end = new Date(dataFim)
      end.setHours(23, 59, 59, 999)
      result = result.filter((l) => new Date(l.createdAt) <= end)
    }

    if (atorIdSearch) {
      result = result.filter((l) => l.atorId && l.atorId.toLowerCase().includes(atorIdSearch.toLowerCase()))
    }

    if (entidadeIdSearch) {
      result = result.filter((l) => l.entidadeId.toLowerCase().includes(entidadeIdSearch.toLowerCase()))
    }

    return result
  }, [logs, actionFilter, dataInicio, dataFim, atorIdSearch, entidadeIdSearch])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE))
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  const handleClearFilters = useCallback(() => {
    setEntityFilter('')
    setActionFilter('')
    setDataInicio('')
    setDataFim('')
    setAtorIdSearch('')
    setEntidadeIdSearch('')
    setPage(1)
  }, [])

  const hasActiveFilters = entityFilter || actionFilter || dataInicio || dataFim || atorIdSearch || entidadeIdSearch

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Auditoria</h1>
          <p className="text-muted-foreground mt-1">Log de ações realizadas na plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            Filtros
            {hasActiveFilters && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Filtros de Auditoria
              </h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" aria-hidden="true" />
                  Limpar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Entity Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Entidade</Label>
                <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as Entidades" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value || '__all__'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ação</Label>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as Ações" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value || '__all__'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Start */}
              <div className="space-y-1.5">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => { setDataInicio(e.target.value); setPage(1) }}
                  className="h-9"
                />
              </div>

              {/* Date End */}
              <div className="space-y-1.5">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => { setDataFim(e.target.value); setPage(1) }}
                  className="h-9"
                />
              </div>

              {/* Ator ID */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ator ID</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    value={atorIdSearch}
                    onChange={(e) => { setAtorIdSearch(e.target.value); setPage(1) }}
                    className="h-9 pl-8 text-xs font-mono"
                    placeholder="Buscar por ID do ator..."
                  />
                </div>
              </div>

              {/* Entity ID */}
              <div className="space-y-1.5">
                <Label className="text-xs">ID da Entidade</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    value={entidadeIdSearch}
                    onChange={(e) => { setEntidadeIdSearch(e.target.value); setPage(1) }}
                    className="h-9 pl-8 text-xs font-mono"
                    placeholder="Buscar por ID da entidade..."
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results summary */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            {filteredLogs.length} registro(s) encontrado(s)
            {filteredLogs.length !== logs.length && ` (filtrados de ${logs.length} total)`}
          </p>
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhum log de auditoria encontrado</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-3">
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Log list */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {paginatedLogs.map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próximo
              </Button>
            </div>
          )}
        </>
      )}

      {/* LGPD Compliance Note */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground px-4">
          📋 Logs de auditoria são imutáveis e retidos conforme LGPD Art. 37 e SUSEP Circular 666/2022.
        </p>
      </div>
    </div>
  )
}
