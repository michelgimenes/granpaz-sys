'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/helpers'

interface Sinistro {
  id: string
  tipoSinistro: string
  dataOcorrencia: string
  status: string
  observacoes: string | null
  contrato: {
    id: string
    titular: { nomeCompleto: string }
  }
  pessoaVinculada: {
    nomeCompleto: string
  }
}

const statusLabels: Record<string, string> = {
  EM_ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  NEGADO_CARENCIA: 'Negado - Carência',
  NEGADO_FRAUDE: 'Negado - Fraude',
  NEGADO_EXCLUSAO: 'Negado - Exclusão',
}

const statusIcons: Record<string, React.ElementType> = {
  EM_ANALISE: Clock,
  APROVADO: CheckCircle2,
  NEGADO_CARENCIA: XCircle,
  NEGADO_FRAUDE: XCircle,
  NEGADO_EXCLUSAO: XCircle,
}

const statusColors: Record<string, string> = {
  EM_ANALISE: 'bg-state-warning/10 text-state-warning',
  APROVADO: 'bg-state-success/10 text-state-success',
  NEGADO_CARENCIA: 'bg-state-error/10 text-state-error',
  NEGADO_FRAUDE: 'bg-state-error/10 text-state-error',
  NEGADO_EXCLUSAO: 'bg-state-error/10 text-state-error',
}

export function ClaimsTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    contratoId: '',
    pessoaVinculadaId: '',
    tipoSinistro: 'OBITO_NATURAL',
    dataOcorrencia: '',
    observacoes: '',
  })

  const { data: sinistros = [], isLoading } = useQuery<Sinistro[]>({
    queryKey: ['sinistros'],
    queryFn: async () => {
      const res = await fetch('/api/sinistros')
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-all'],
    queryFn: async () => {
      const res = await fetch('/api/contratos')
      if (!res.ok) return []
      return res.json()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/sinistros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['sinistros'] })
        setShowForm(false)
        setForm({ contratoId: '', pessoaVinculadaId: '', tipoSinistro: 'OBITO_NATURAL', dataOcorrencia: '', observacoes: '' })
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Sinistros</h1>
          <p className="text-muted-foreground mt-1">Gestão de sinistros e ocorrências</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Novo Sinistro
        </Button>
      </div>

      {/* New claim form */}
      {showForm && (
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-base">Registrar Novo Sinistro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Contrato *</label>
                  <select value={form.contratoId}
                    onChange={(e) => setForm(f => ({ ...f, contratoId: e.target.value }))}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecione...</option>
                    {contratos.map((c: { id: string; titular: { nomeCompleto: string } }) => (
                      <option key={c.id} value={c.id}>{c.titular.nomeCompleto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tipo de Sinistro *</label>
                  <select value={form.tipoSinistro}
                    onChange={(e) => setForm(f => ({ ...f, tipoSinistro: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="OBITO_NATURAL">Óbito Natural</option>
                    <option value="OBITO_ACIDENTAL">Óbito Acidental</option>
                    <option value="SUICIDIO">Suicídio</option>
                    <option value="INVALIDEZ_TOTAL">Invalidez Total</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data da Ocorrência *</label>
                <input type="date" required value={form.dataOcorrencia}
                  onChange={(e) => setForm(f => ({ ...f, dataOcorrencia: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                <textarea value={form.observacoes}
                  onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
                  placeholder="Detalhes do sinistro..." />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Registrar Sinistro
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Carência info */}
      <Card className="border-border/50 mb-6">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-state-warning" aria-hidden="true" />
            <span className="text-muted-foreground">
              Carência: <strong className="text-foreground">3 dias</strong> (acidental) • <strong className="text-foreground">6 meses</strong> (natural) • <strong className="text-foreground">24 meses</strong> (suicídio)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Claims list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : sinistros.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhum sinistro registrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sinistros.map((sinistro) => {
            const StatusIcon = statusIcons[sinistro.status] || AlertTriangle
            return (
              <Card key={sinistro.id} className="border-border/50">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${statusColors[sinistro.status]?.includes('success') ? 'text-state-success' : statusColors[sinistro.status]?.includes('warning') ? 'text-state-warning' : 'text-state-error'}`} aria-hidden="true" />
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {sinistro.pessoaVinculada.nomeCompleto}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sinistro.tipoSinistro.replace(/_/g, ' ')} • {formatDate(sinistro.dataOcorrencia)}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[sinistro.status] || 'bg-muted text-muted-foreground'}>
                    {statusLabels[sinistro.status] || sinistro.status}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
