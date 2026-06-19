'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, Eye, ArrowRight, Loader2, AlertTriangle, Users } from 'lucide-react'
import { formatCurrency, formatDate, formatCPF } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'

interface Vinculo {
  id: string
  tipoVinculo: string
  parentesco: string
  pessoaVinculada: {
    id: string
    nomeCompleto: string
    cpf: string | null
  }
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
  dadosAprovacao?: {
    capitalSeguradoInformado: number | null
    codigoSeguradoraInformado: string | null
    dataAprovacao: string | null
    observacoesGestor: string | null
  }
}

function getTodayString() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export function ApprovalTab() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [approveForm, setApproveForm] = useState({
    capitalSegurado: '',
    codigoSeguradora: '',
    seguradoraId: '',
    observacoes: '',
    dataInicio: getTodayString(),
  })

  // L22: CPF confirmation dialog
  const [cpfConfirmOpen, setCpfConfirmOpen] = useState(false)
  const [cpfInput, setCpfInput] = useState('')
  const [cpfError, setCpfError] = useState('')

  // L23: Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [rejectError, setRejectError] = useState('')

  // L24: Submitting & toast states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ['approval-contratos'],
    queryFn: async () => {
      const res = await fetch('/api/contratos?status=AGUARDANDO_APROVACAO')
      if (!res.ok) throw new Error('Erro ao carregar contratos')
      const json = await res.json()
      // Handle paginated response format
      if (json.data && Array.isArray(json.data)) return json.data
      if (Array.isArray(json)) return json
      return []
    },
  })

  const { data: seguradoras = [] } = useQuery({
    queryKey: ['seguradoras'],
    queryFn: async () => {
      const res = await fetch('/api/seguradoras')
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  // L25: Fetch full contract details (with vínculos) when selected
  const { data: selectedContratoDetail } = useQuery<Contrato>({
    queryKey: ['contrato-detail', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const res = await fetch(`/api/contratos/${selectedId}`)
      if (!res.ok) throw new Error('Erro ao carregar detalhes')
      return res.json()
    },
    enabled: !!selectedId,
  })

  const selectedContrato = contratos.find(c => c.id === selectedId)
  const displayContrato = selectedContratoDetail || selectedContrato

  // L22: Open CPF confirmation dialog
  const openCpfConfirm = useCallback(() => {
    setCpfInput('')
    setCpfError('')
    setCpfConfirmOpen(true)
  }, [])

  // L22: Handle CPF confirmation
  const handleCpfConfirm = useCallback(() => {
    if (!selectedContrato?.titular?.cpf) {
      setCpfError('Titular não possui CPF cadastrado.')
      return
    }
    const cleanInput = cpfInput.replace(/\D/g, '')
    const cleanOriginal = selectedContrato.titular.cpf.replace(/\D/g, '')
    if (cleanInput !== cleanOriginal) {
      setCpfError('CPF não confere. Digite o CPF do titular para confirmar.')
      return
    }
    setCpfConfirmOpen(false)
    handleApprove()
  }, [cpfInput, selectedContrato])

  // L21+L22: Approve with dataInicio and adminAprovadorId
  const handleApprove = useCallback(async () => {
    if (!selectedId) return
    const user = useAppStore.getState().user
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/contratos/${selectedId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capitalSegurado: parseFloat(approveForm.capitalSegurado) || 0,
          codigoSeguradora: approveForm.codigoSeguradora,
          seguradoraId: approveForm.seguradoraId,
          observacoes: approveForm.observacoes,
          dataInicio: approveForm.dataInicio,
          adminAprovadorId: user?.id || null,
        }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['approval-contratos'] })
        setSelectedId(null)
        setApproveForm({
          capitalSegurado: '',
          codigoSeguradora: '',
          seguradoraId: '',
          observacoes: '',
          dataInicio: getTodayString(),
        })
        setToast({ message: 'Contrato aprovado com sucesso!', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao aprovar contrato' }))
        setSubmitError(errData.error || 'Erro ao aprovar contrato')
        setToast({ message: errData.error || 'Erro ao aprovar contrato', type: 'error' })
      }
    } catch {
      setSubmitError('Erro de conexão ao aprovar contrato')
      setToast({ message: 'Erro de conexão ao aprovar contrato', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedId, approveForm, queryClient])

  // L23: Open rejection dialog
  const openRejectDialog = useCallback(() => {
    setRejectMotivo('')
    setRejectError('')
    setRejectDialogOpen(true)
  }, [])

  // L23: Handle rejection with motivo
  const handleReject = useCallback(async () => {
    if (!selectedId) return
    if (rejectMotivo.trim().length < 10) {
      setRejectError('Motivo deve ter pelo menos 10 caracteres.')
      return
    }
    if (rejectMotivo.trim().length > 1000) {
      setRejectError('Motivo deve ter no máximo 1000 caracteres.')
      return
    }
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/contratos/${selectedId}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: rejectMotivo.trim() }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['approval-contratos'] })
        setSelectedId(null)
        setRejectDialogOpen(false)
        setToast({ message: 'Contrato rejeitado.', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao rejeitar contrato' }))
        setSubmitError(errData.error || 'Erro ao rejeitar contrato')
        setToast({ message: errData.error || 'Erro ao rejeitar contrato', type: 'error' })
      }
    } catch {
      setSubmitError('Erro de conexão ao rejeitar contrato')
      setToast({ message: 'Erro de conexão ao rejeitar contrato', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedId, rejectMotivo, queryClient])

  const statusColors: Record<string, string> = {
    AGUARDANDO_APROVACAO: 'bg-state-warning/10 text-state-warning',
    APROVADO: 'bg-state-success/10 text-state-success',
    REJEITADO: 'bg-state-error/10 text-state-error',
  }

  const tipoVinculoLabels: Record<string, string> = {
    DEPENDENTE: 'Dependente',
    AGREGADO: 'Agregado',
    SUB_DEPENDENTE: 'Sub-dependente',
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Fila de Aprovação</h1>
        <p className="text-muted-foreground mt-1">Contratos aguardando aprovação</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : contratos.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum contrato aguardando aprovação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {contratos.map((contrato) => (
              <Card
                key={contrato.id}
                className={`cursor-pointer transition-all hover:shadow-md border-border/50 ${
                  selectedId === contrato.id ? 'border-primary border-2' : ''
                }`}
                onClick={() => setSelectedId(contrato.id)}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{contrato.titular.nomeCompleto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {contrato.plano.nome} • {formatCurrency(contrato.valorParcelaBase)}/mês
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[contrato.status] || 'bg-muted text-muted-foreground'}>
                      Pendente
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail panel */}
          <div>
            {displayContrato ? (
              <Card className="border-border/50 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-base">Detalhes do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Titular:</span>
                      <span className="font-medium text-foreground">{displayContrato.titular.nomeCompleto}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPF:</span>
                      <span className="font-mono text-foreground">
                        {displayContrato.titular.cpf ? formatCPF(displayContrato.titular.cpf) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plano:</span>
                      <span className="text-foreground">{displayContrato.plano.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcela:</span>
                      <span className="text-foreground">{formatCurrency(displayContrato.valorParcelaBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa Adesão:</span>
                      <span className="text-foreground">{formatCurrency(displayContrato.valorTaxaAdesao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="text-foreground">{formatDate(displayContrato.createdAt)}</span>
                    </div>
                  </div>

                  {/* L25: Vínculos tree display */}
                  {displayContrato.vinculos && displayContrato.vinculos.length > 0 && (
                    <div className="border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <p className="text-xs font-semibold text-muted-foreground">
                          Vínculos ({displayContrato.vinculos.length})
                        </p>
                      </div>
                      <div className="space-y-1 ml-4 border-l-2 border-primary/20 pl-3 max-h-48 overflow-y-auto custom-scrollbar">
                        {displayContrato.vinculos.map((v) => (
                          <div key={v.id} className="text-xs py-1">
                            <span className="text-foreground font-medium">{v.pessoaVinculada.nomeCompleto}</span>
                            <span className="text-muted-foreground ml-2">
                              {tipoVinculoLabels[v.tipoVinculo] || v.tipoVinculo} • {v.parentesco}
                            </span>
                            {v.pessoaVinculada.cpf && (
                              <span className="text-muted-foreground ml-2 font-mono">
                                ({formatCPF(v.pessoaVinculada.cpf)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approval form */}
                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Dados de Aprovação</h4>

                    {/* L21: Data de Início field */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Data de Início</label>
                      <input
                        type="date"
                        value={approveForm.dataInicio}
                        onChange={(e) => setApproveForm(f => ({ ...f, dataInicio: e.target.value }))}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Capital Segurado</label>
                      <input
                        type="number"
                        value={approveForm.capitalSegurado}
                        onChange={(e) => setApproveForm(f => ({ ...f, capitalSegurado: e.target.value }))}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Código Seguradora</label>
                      <input
                        type="text"
                        value={approveForm.codigoSeguradora}
                        onChange={(e) => setApproveForm(f => ({ ...f, codigoSeguradora: e.target.value }))}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                        placeholder="COD-001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Seguradora</label>
                      <select
                        value={approveForm.seguradoraId}
                        onChange={(e) => setApproveForm(f => ({ ...f, seguradoraId: e.target.value }))}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        {seguradoras.map((s: { id: string; nome: string }) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                      <textarea
                        value={approveForm.observacoes}
                        onChange={(e) => setApproveForm(f => ({ ...f, observacoes: e.target.value }))}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
                        placeholder="Observações do gestor..."
                      />
                    </div>

                    {/* L24: Error display */}
                    {submitError && (
                      <div className="flex items-center gap-2 text-sm text-state-error bg-state-error/10 p-2 rounded">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    {/* L24: Buttons with loading states */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={openCpfConfirm}
                        className="flex-1 bg-state-success text-white hover:bg-state-success/90"
                        size="sm"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" aria-hidden="true" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        onClick={openRejectDialog}
                        variant="destructive"
                        className="flex-1"
                        size="sm"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                        ) : (
                          <X className="h-4 w-4 mr-1" aria-hidden="true" />
                        )}
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Selecione um contrato para ver detalhes</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* L22: CPF Confirmation Dialog */}
      <Dialog open={cpfConfirmOpen} onOpenChange={setCpfConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Confirme a aprovação digitando o CPF do titular
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Titular: <span className="font-medium text-foreground">{selectedContrato?.titular?.nomeCompleto}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              CPF (referência): <span className="font-mono text-foreground">
                {selectedContrato?.titular?.cpf
                  ? formatCPF(selectedContrato.titular.cpf).replace(/\d(?=.*-)/g, '*')
                  : '—'}
              </span>
            </p>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Digite o CPF do titular</label>
              <input
                type="text"
                value={cpfInput}
                onChange={(e) => {
                  setCpfInput(e.target.value)
                  setCpfError('')
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="000.000.000-00"
                autoFocus
              />
            </div>
            {cpfError && (
              <p className="text-sm text-state-error flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {cpfError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCpfConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCpfConfirm}
              className="bg-state-success text-white hover:bg-state-success/90"
              disabled={isSubmitting || !cpfInput.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4 mr-1" aria-hidden="true" />
              )}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* L23: Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Contrato</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição do contrato de {selectedContrato?.titular?.nomeCompleto || '...'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Motivo da Rejeição</label>
              <Textarea
                value={rejectMotivo}
                onChange={(e) => {
                  setRejectMotivo(e.target.value)
                  setRejectError('')
                }}
                placeholder="Descreva o motivo da rejeição..."
                className="min-h-[100px]"
                maxLength={1000}
              />
              <div className="flex justify-between mt-1">
                <span className={`text-xs ${
                  rejectMotivo.trim().length > 0 && rejectMotivo.trim().length < 10
                    ? 'text-state-error'
                    : 'text-muted-foreground'
                }`}>
                  Mínimo 10 caracteres
                </span>
                <span className={`text-xs ${
                  rejectMotivo.length > 1000 ? 'text-state-error' : 'text-muted-foreground'
                }`}>
                  {rejectMotivo.length}/1000
                </span>
              </div>
            </div>
            {rejectError && (
              <p className="text-sm text-state-error flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {rejectError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={
                isSubmitting ||
                rejectMotivo.trim().length < 10 ||
                rejectMotivo.trim().length > 1000
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
              )}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* L24: Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-state-success text-white' : 'bg-state-error text-white'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
