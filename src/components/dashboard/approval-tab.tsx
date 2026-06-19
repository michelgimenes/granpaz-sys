'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, Eye, ArrowRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/helpers'

interface Contrato {
  id: string
  status: string
  valorParcelaBase: number
  valorTaxaAdesao: number
  createdAt: string
  titular: {
    nomeCompleto: string
    cpf: string | null
  }
  plano: {
    nome: string
    tipo: string
  }
}

export function ApprovalTab() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [approveForm, setApproveForm] = useState({
    capitalSegurado: '',
    codigoSeguradora: '',
    seguradoraId: '',
    observacoes: '',
  })

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ['approval-contratos'],
    queryFn: async () => {
      const res = await fetch('/api/contratos?status=AGUARDANDO_APROVACAO')
      if (!res.ok) throw new Error('Erro ao carregar contratos')
      return res.json()
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

  const selectedContrato = contratos.find(c => c.id === selectedId)

  const handleApprove = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/contratos/${selectedId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capitalSegurado: parseFloat(approveForm.capitalSegurado) || 0,
          codigoSeguradora: approveForm.codigoSeguradora,
          seguradoraId: approveForm.seguradoraId,
          observacoes: approveForm.observacoes,
        }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['approval-contratos'] })
        setSelectedId(null)
        setApproveForm({ capitalSegurado: '', codigoSeguradora: '', seguradoraId: '', observacoes: '' })
      }
    } catch { /* ignore */ }
  }

  const handleReject = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/contratos/${selectedId}/rejeitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Rejeitado pelo gestor' }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['approval-contratos'] })
        setSelectedId(null)
      }
    } catch { /* ignore */ }
  }

  const statusColors: Record<string, string> = {
    AGUARDANDO_APROVACAO: 'bg-state-warning/10 text-state-warning',
    APROVADO: 'bg-state-success/10 text-state-success',
    REJEITADO: 'bg-state-error/10 text-state-error',
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
            {selectedContrato ? (
              <Card className="border-border/50 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-base">Detalhes do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Titular:</span>
                      <span className="font-medium text-foreground">{selectedContrato.titular.nomeCompleto}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPF:</span>
                      <span className="font-mono text-foreground">{selectedContrato.titular.cpf || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plano:</span>
                      <span className="text-foreground">{selectedContrato.plano.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcela:</span>
                      <span className="text-foreground">{formatCurrency(selectedContrato.valorParcelaBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa Adesão:</span>
                      <span className="text-foreground">{formatCurrency(selectedContrato.valorTaxaAdesao)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="text-foreground">{formatDate(selectedContrato.createdAt)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Dados de Aprovação</h4>
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
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleApprove} className="flex-1 bg-state-success text-white hover:bg-state-success/90" size="sm">
                        <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Aprovar
                      </Button>
                      <Button onClick={handleReject} variant="destructive" className="flex-1" size="sm">
                        <X className="h-4 w-4 mr-1" aria-hidden="true" /> Rejeitar
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
    </div>
  )
}
