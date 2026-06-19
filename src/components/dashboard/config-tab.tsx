'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Pencil, Save, X } from 'lucide-react'
import { formatDate } from '@/lib/helpers'

interface ConfigItem {
  id: string
  chave: string
  valor: string
  tipoParse: string
  descricao: string
  updatedAt: string
}

const typeColors: Record<string, string> = {
  INT: 'bg-primary/10 text-primary',
  DECIMAL: 'bg-brand-accent/10 text-brand-accent',
  BOOLEAN: 'bg-state-success/10 text-state-success',
  VARCHAR: 'bg-state-warning/10 text-state-warning',
}

export function ConfigTab() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data: configs = [], isLoading } = useQuery<ConfigItem[]>({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const res = await fetch('/api/configuracoes')
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-config'],
    queryFn: async () => {
      const res = await fetch('/api/audit-logs?entidade=ConfiguracaoRegraNegocio&limit=10')
      if (!res.ok) return []
      return res.json()
    },
  })

  const startEdit = (config: ConfigItem) => {
    setEditingId(config.id)
    setEditValue(config.valor)
  }

  const saveEdit = async (config: ConfigItem) => {
    try {
      const res = await fetch(`/api/configuracoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: config.id, valor: editValue }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
        queryClient.invalidateQueries({ queryKey: ['audit-config'] })
        setEditingId(null)
      }
    } catch { /* ignore */ }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Regras de negócio da plataforma</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Chaves de Configuração ({configs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono font-semibold text-foreground">{config.chave}</code>
                      <Badge className={typeColors[config.tipoParse] || 'bg-muted text-muted-foreground'}>
                        {config.tipoParse}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{config.descricao}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {editingId === config.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type={config.tipoParse === 'INT' || config.tipoParse === 'DECIMAL' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex h-8 w-32 rounded-md border border-input bg-transparent px-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <Button size="sm" onClick={() => saveEdit(config)} className="h-8 px-2 bg-state-success text-white hover:bg-state-success/90">
                          <Save className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-2">
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium text-foreground">{config.valor}</code>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(config)} className="h-8 px-2">
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit log for config changes */}
      {auditLogs.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Histórico de Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {auditLogs.map((log: {
                id: string
                acao: string
                createdAt: string
                valoresAnteriores: string | null
                valoresNovos: string | null
              }) => (
                <div key={log.id} className="p-2 rounded bg-muted/30 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">{log.acao}</span>
                    <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                  </div>
                  {log.valoresAnteriores && log.valoresNovos && (
                    <div className="mt-1 flex gap-2">
                      <span className="text-state-error line-through">{log.valoresAnteriores}</span>
                      <span className="text-state-success">{log.valoresNovos}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
