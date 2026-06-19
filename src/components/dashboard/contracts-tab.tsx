'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/helpers'

interface Vinculo {
  id: string
  tipoVinculo: string
  parentesco: string
  pessoaVinculada: {
    nomeCompleto: string
    cpf: string | null
  }
}

interface Contrato {
  id: string
  status: string
  valorParcelaBase: number
  createdAt: string
  titular: {
    nomeCompleto: string
    cpf: string | null
  }
  plano: {
    nome: string
    tipo: string
  }
  vinculos?: Vinculo[]
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

export function ContractsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ['contratos', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/contratos?${params.toString()}`)
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  const filtered = contratos.filter(c =>
    !search ||
    c.titular.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
    (c.titular.cpf && c.titular.cpf.includes(search))
  )

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
          onChange={(e) => setStatusFilter(e.target.value)}
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
        <div className="space-y-2">
          {filtered.map((contrato) => (
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
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">CPF</span>
                        <p className="font-mono text-foreground">{contrato.titular.cpf || '—'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Data Criação</span>
                        <p className="text-foreground">{formatDate(contrato.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Taxa Adesão</span>
                        <p className="text-foreground">{formatCurrency(0)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Status</span>
                        <p className="text-foreground">{statusLabels[contrato.status]}</p>
                      </div>
                    </div>

                    {/* Vinculos tree */}
                    {contrato.vinculos && contrato.vinculos.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Vínculos ({contrato.vinculos.length})</p>
                        <div className="space-y-1 ml-4 border-l-2 border-primary/20 pl-3">
                          {contrato.vinculos.map((v) => (
                            <div key={v.id} className="text-xs py-1">
                              <span className="text-foreground font-medium">{v.pessoaVinculada.nomeCompleto}</span>
                              <span className="text-muted-foreground ml-2">
                                {v.tipoVinculo} • {v.parentesco}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
