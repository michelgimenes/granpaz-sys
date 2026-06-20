'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp, Loader2, AlertTriangle, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, formatCPF } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'

interface Vinculo {
  id: string
  tipoVinculo: string
  parentesco: string
  dataFimVinculo?: string | null
  pessoaVinculada: {
    id: string
    nomeCompleto: string
    cpf: string | null
  }
}

interface DadosAprovacao {
  capitalSeguradoInformado: number | null
  codigoSeguradoraInformado: string | null
  dataAprovacao: string | null
  observacoesGestor: string | null
  adminAprovadorId?: string | null
  adminAprovadorNome?: string | null
}

interface Contrato {
  id: string
  status: string
  valorParcelaBase: number
  valorTaxaAdesao: number
  createdAt: string
  titular: {
    id: string
    nomeCompleto: string
    cpf: string | null
  }
  plano: {
    nome: string
    tipo: string
  }
  vinculos?: Vinculo[]
  dadosAprovacao?: DadosAprovacao | null
}

interface PaginatedResponse {
  data: Contrato[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const statusLabels: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
  CANCELADO_CDC: 'Cancelado CDC',
}

const statusColors: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'bg-state-warning/10 text-state-warning',
  APROVADO: 'bg-state-success/10 text-state-success',
  REJEITADO: 'bg-state-error/10 text-state-error',
  CANCELADO: 'bg-muted text-muted-foreground',
  SUSPENSO: 'bg-state-warning/10 text-state-warning',
  CANCELADO_CDC: 'bg-state-error/10 text-state-error',
}

const tipoVinculoLabels: Record<string, string> = {
  DEPENDENTE: 'Dependente',
  AGREGADO: 'Agregado',
  SUB_DEPENDENTE: 'Sub-dependente',
}

export function ContractsTab() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 10

  // L28: Endosso states
  const [alterarCapitalOpen, setAlterarCapitalOpen] = useState(false)
  const [novoCapital, setNovoCapital] = useState('')
  const [capitalError, setCapitalError] = useState('')
  const [excluirVinculoOpen, setExcluirVinculoOpen] = useState(false)
  const [vinculoParaExcluir, setVinculoParaExcluir] = useState<Vinculo | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // L28: Paginated query
  const { data: paginatedData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['contratos', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const res = await fetch(`/api/contratos?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      // Handle both paginated and non-paginated responses
      const json = await res.json()
      if (json.data && json.pagination) {
        return json as PaginatedResponse
      }
      // Fallback: treat as array
      return {
        data: Array.isArray(json) ? json : [],
        pagination: { page: 1, limit, total: Array.isArray(json) ? json.length : 0, totalPages: 1 },
      }
    },
  })

  const contratos = paginatedData?.data || []
  const pagination = paginatedData?.pagination || { page: 1, limit, total: 0, totalPages: 0 }

  // L27+L28: Fetch full contract details when expanded
  const { data: expandedContratoDetail } = useQuery<Contrato>({
    queryKey: ['contrato-detail-contracts', expandedId],
    queryFn: async () => {
      if (!expandedId) return null
      const res = await fetch(`/api/contratos/${expandedId}`)
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
    enabled: !!expandedId,
  })

  const filtered = contratos.filter(c =>
    !search ||
    c.titular.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
    (c.titular.cpf && c.titular.cpf.includes(search))
  )

  // L28: Alterar Capital handler
  const handleAlterarCapital = useCallback(async () => {
    if (!expandedId) return
    const value = parseFloat(novoCapital)
    if (!value || value <= 0 || value > 10000000) {
      setCapitalError('Capital deve ser maior que 0 e menor ou igual a R$ 10.000.000,00')
      return
    }
    setCapitalError('')
    setIsSubmitting(true)
    try {
      const user = useAppStore.getState().user
      const res = await fetch(`/api/contratos/${expandedId}/endosso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ALTERACAO_CAPITAL',
          dados: { capitalSegurado: value },
          solicitadoPorId: user?.id || null,
        }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['contratos'] })
        queryClient.invalidateQueries({ queryKey: ['contrato-detail-contracts', expandedId] })
        setAlterarCapitalOpen(false)
        setNovoCapital('')
        setToast({ message: 'Capital alterado com sucesso!', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao alterar capital' }))
        setToast({ message: errData.error || 'Erro ao alterar capital', type: 'error' })
      }
    } catch {
      setToast({ message: 'Erro de conexão', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }, [expandedId, novoCapital, queryClient])

  // L28: Excluir Vínculo handler
  const handleExcluirVinculo = useCallback(async () => {
    if (!expandedId || !vinculoParaExcluir) return
    setIsSubmitting(true)
    try {
      const user = useAppStore.getState().user
      const res = await fetch(`/api/contratos/${expandedId}/endosso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'EXCLUSAO_VINCULO',
          dados: { vinculoId: vinculoParaExcluir.id },
          solicitadoPorId: user?.id || null,
        }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['contratos'] })
        queryClient.invalidateQueries({ queryKey: ['contrato-detail-contracts', expandedId] })
        setExcluirVinculoOpen(false)
        setVinculoParaExcluir(null)
        setToast({ message: 'Vínculo excluído com sucesso!', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao excluir vínculo' }))
        setToast({ message: errData.error || 'Erro ao excluir vínculo', type: 'error' })
      }
    } catch {
      setToast({ message: 'Erro de conexão', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }, [expandedId, vinculoParaExcluir, queryClient])

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Contratos</h1>
        <p className="text-muted-foreground mt-1">Gerenciamento de contratos</p>
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
            placeholder="Buscar por nome ou CPF..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os Status</option>
          <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
          <option value="APROVADO">Aprovado</option>
          <option value="REJEITADO">Rejeitado</option>
          <option value="CANCELADO">Cancelado</option>
          <option value="SUSPENSO">Suspenso</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum contrato encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map((contrato) => {
              const detail = expandedId === contrato.id ? expandedContratoDetail : null
              const displayVinculos = detail?.vinculos || contrato.vinculos || []
              const displayDadosAprovacao = detail?.dadosAprovacao || contrato.dadosAprovacao

              return (
                <Card key={contrato.id} className="border-border/50">
                  <CardContent className="py-3">
                    <button
                      className="w-full flex items-center justify-between"
                      onClick={() => setExpandedId(expandedId === contrato.id ? null : contrato.id)}
                      aria-expanded={expandedId === contrato.id}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-foreground text-sm">{contrato.titular.nomeCompleto}</p>
                          <p className="text-xs text-muted-foreground">
                            {contrato.plano.nome} • {formatCurrency(contrato.valorParcelaBase)}/mês
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusColors[contrato.status] || 'bg-muted text-muted-foreground'}>
                          {statusLabels[contrato.status] || contrato.status}
                        </Badge>
                        {expandedId === contrato.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {expandedId === contrato.id && (
                      <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                        {/* Basic info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">CPF</span>
                            <p className="font-mono text-foreground">
                              {contrato.titular.cpf ? formatCPF(contrato.titular.cpf) : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Data Criação</span>
                            <p className="text-foreground">{formatDate(contrato.createdAt)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Taxa Adesão</span>
                            {/* L26: Fix — use contrato.valorTaxaAdesao */}
                            <p className="text-foreground">{formatCurrency(contrato.valorTaxaAdesao)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Status</span>
                            <p className="text-foreground">{statusLabels[contrato.status]}</p>
                          </div>
                        </div>

                        {/* Vinculos tree */}
                        {displayVinculos.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Vínculos ({displayVinculos.length})</p>
                            <div className="space-y-1 ml-4 border-l-2 border-primary/20 pl-3">
                              {displayVinculos.map((v) => (
                                <div key={v.id} className="text-xs py-1 flex items-center justify-between">
                                  <div>
                                    <span className="text-foreground font-medium">{v.pessoaVinculada.nomeCompleto}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {tipoVinculoLabels[v.tipoVinculo] || v.tipoVinculo} • {v.parentesco}
                                    </span>
                                    {v.pessoaVinculada.cpf && (
                                      <span className="text-muted-foreground ml-2 font-mono">
                                        ({formatCPF(v.pessoaVinculada.cpf)})
                                      </span>
                                    )}
                                    {v.dataFimVinculo && (
                                      <span className="text-state-error ml-2">
                                        (Excluído em {formatDate(v.dataFimVinculo)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* L27: dados_aprovacao for approved contracts */}
                        {contrato.status === 'APROVADO' && displayDadosAprovacao && (
                          <div className="bg-state-success/5 border border-state-success/20 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="h-4 w-4 text-state-success" aria-hidden="true" />
                              <h4 className="text-sm font-semibold text-state-success">Dados de Aprovação</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {displayDadosAprovacao.capitalSeguradoInformado != null && (
                                <div>
                                  <span className="text-muted-foreground">Capital Segurado:</span>
                                  <p className="font-mono font-medium text-foreground">
                                    {formatCurrency(displayDadosAprovacao.capitalSeguradoInformado)}
                                  </p>
                                </div>
                              )}
                              {displayDadosAprovacao.codigoSeguradoraInformado && (
                                <div>
                                  <span className="text-muted-foreground">Código Seguradora:</span>
                                  <p className="font-mono text-foreground">
                                    {displayDadosAprovacao.codigoSeguradoraInformado}
                                  </p>
                                </div>
                              )}
                              {displayDadosAprovacao.dataAprovacao && (
                                <div>
                                  <span className="text-muted-foreground">Data Aprovação:</span>
                                  <p className="text-foreground">
                                    {formatDate(displayDadosAprovacao.dataAprovacao)}
                                  </p>
                                </div>
                              )}
                              {displayDadosAprovacao.adminAprovadorNome && (
                                <div>
                                  <span className="text-muted-foreground">Admin Aprovador:</span>
                                  <p className="text-foreground">
                                    {displayDadosAprovacao.adminAprovadorNome}
                                  </p>
                                </div>
                              )}
                              {displayDadosAprovacao.observacoesGestor && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Observações:</span>
                                  <p className="text-foreground">{displayDadosAprovacao.observacoesGestor}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* L28: Endosso actions for approved contracts */}
                        {contrato.status === 'APROVADO' && (
                          <div className="border-t border-border/50 pt-3">
                            <h4 className="text-xs text-muted-foreground mb-2">Ações de Endosso</h4>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setNovoCapital(
                                    displayDadosAprovacao?.capitalSeguradoInformado?.toString() || ''
                                  )
                                  setCapitalError('')
                                  setAlterarCapitalOpen(true)
                                }}
                              >
                                <Pencil className="h-3 w-3 mr-1" aria-hidden="true" />
                                Alterar Capital
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-state-error hover:text-state-error"
                                onClick={() => {
                                  setVinculoParaExcluir(null)
                                  setExcluirVinculoOpen(true)
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                                Excluir Vínculo
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-muted-foreground">
                {pagination.total} contrato(s) • Página {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* L28: Alterar Capital Dialog */}
      <Dialog open={alterarCapitalOpen} onOpenChange={setAlterarCapitalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Capital Segurado</DialogTitle>
            <DialogDescription>
              Altere o capital segurado do contrato. O valor deve ser maior que 0 e menor ou igual a R$ 10.000.000,00.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Capital Atual</label>
              <p className="text-sm font-mono font-medium text-foreground">
                {expandedContratoDetail?.dadosAprovacao?.capitalSeguradoInformado != null
                  ? formatCurrency(expandedContratoDetail.dadosAprovacao.capitalSeguradoInformado)
                  : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Novo Capital Segurado</label>
              <input
                type="number"
                value={novoCapital}
                onChange={(e) => {
                  setNovoCapital(e.target.value)
                  setCapitalError('')
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0,00"
                min="0"
                max="10000000"
                step="0.01"
              />
            </div>
            {capitalError && (
              <p className="text-sm text-state-error flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {capitalError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlterarCapitalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleAlterarCapital}
              disabled={isSubmitting || !novoCapital}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <Pencil className="h-4 w-4 mr-1" aria-hidden="true" />
              )}
              Alterar Capital
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* L28: Excluir Vínculo Dialog */}
      <Dialog open={excluirVinculoOpen} onOpenChange={setExcluirVinculoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Vínculo</DialogTitle>
            <DialogDescription>
              Selecione o vínculo que deseja excluir do contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {(!expandedContratoDetail?.vinculos || expandedContratoDetail.vinculos.length === 0) && (
              <p className="text-sm text-muted-foreground">Nenhum vínculo encontrado.</p>
            )}
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
              {(expandedContratoDetail?.vinculos || []).map((v) => {
                const isExcluido = !!v.dataFimVinculo
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
                  >
                    <div>
                      <span className="font-medium text-foreground">{v.pessoaVinculada.nomeCompleto}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {tipoVinculoLabels[v.tipoVinculo] || v.tipoVinculo} • {v.parentesco}
                      </span>
                      {isExcluido && (
                        <span className="text-state-error ml-2 text-xs">(Já excluído)</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={isExcluido}
                      onClick={() => {
                        setVinculoParaExcluir(v)
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Confirmation for selected vinculo */}
            {vinculoParaExcluir && (
              <div className="mt-3 p-3 bg-state-error/5 border border-state-error/20 rounded-lg">
                <p className="text-sm text-foreground">
                  Confirmar exclusão de <span className="font-semibold">{vinculoParaExcluir.pessoaVinculada.nomeCompleto}</span>?
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleExcluirVinculo}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                    )}
                    Confirmar Exclusão
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVinculoParaExcluir(null)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-state-success text-primary-foreground' : 'bg-state-error text-primary-foreground'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
