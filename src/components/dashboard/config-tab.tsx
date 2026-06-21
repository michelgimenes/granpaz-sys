'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Pencil, ShieldCheck, ShieldAlert, AlertTriangle, FileSearch, Plane, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ConfigItem {
  id: string
  chave: string
  valor: string
  tipoParse: string
  descricao: string
  updatedAt: string
}

interface IntegrityResult {
  timestamp: string
  resumo: { total: number; ok: number; alertas: number; criticos: number }
  checks: Array<{
    nome: string
    status: 'OK' | 'ALERTA' | 'CRITICO'
    mensagem: string
    detalhes: unknown
  }>
}

interface AirGapResult {
  timestamp: string
  status: 'LIMPO' | 'ALERTA' | 'CRITICO'
  totalTermosVerificados: number
  totalViolacoes: number
  violations: Array<{
    entidade: string
    campo: string
    registroId: string
    termoEncontrado: string
    valor: string
  }>
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const CONFIG_CATEGORIES: Record<string, string[]> = {
  '🧠 Idades': [
    'IDADE_LIMITE_TITULAR', 'IDADE_LIMITE_CONJUGE', 'IDADE_LIMITE_DEPENDENTE',
    'IDADE_COBERTURA_FILHO', 'IDADE_LIMITE_AGREGADO', 'IDADE_LIMITE_SUB_DEPENDENTE',
    'IDADE_COBERTURA_SUB_FILHO',
  ],
  '⏳ Carências': [
    'DIAS_CARENCIA_ACIDENTAL', 'MESES_CARENCIA_NATURAL', 'MESES_CARENCIA_SUICIDIO',
  ],
  '💰 Financeiro': [
    'MESES_REMISSAO_OBITO_PADRAO', 'DIAS_SUSPENSAO_INADIMPLENCIA', 'SAQUE_PF_ATIVO', 'LIMITE_SAQUE_DIARIO',
  ],
  '🔒 Segurança': [
    'HASH_ASSINATURA_PDF_SALT', 'PREVALENCIA_APIOLICE_SOBRE_CONFIG',
  ],
}

const CRITICAL_KEYS = ['PREVALENCIA_APIOLICE_SOBRE_CONFIG', 'HASH_ASSINATURA_PDF_SALT']

const LABEL_MAP: Record<string, string> = {
  IDADE_LIMITE_TITULAR: 'Idade Máxima do Titular',
  IDADE_LIMITE_CONJUGE: 'Idade Máxima do Cônjuge',
  IDADE_LIMITE_DEPENDENTE: 'Idade Máxima do Dependente',
  IDADE_COBERTURA_FILHO: 'Idade Limite Cobertura Filho',
  IDADE_LIMITE_AGREGADO: 'Idade Máxima do Agregado',
  IDADE_LIMITE_SUB_DEPENDENTE: 'Idade Máxima do Sub-Dependente',
  IDADE_COBERTURA_SUB_FILHO: 'Idade Limite Cobertura Sub-Filho',
  DIAS_CARENCIA_ACIDENTAL: 'Dias Carência Acidental',
  MESES_CARENCIA_NATURAL: 'Meses Carência Natural',
  MESES_CARENCIA_SUICIDIO: 'Meses Carência Suicídio',
  MESES_REMISSAO_OBITO_PADRAO: 'Meses Remissão Óbito (Padrão)',
  DIAS_SUSPENSAO_INADIMPLENCIA: 'Dias Suspensão Inadimplência',
  SAQUE_PF_ATIVO: 'Saque PF Ativo',
  LIMITE_SAQUE_DIARIO: 'Limite Saque Diário',
  HASH_ASSINATURA_PDF_SALT: 'Hash Assinatura PDF Salt',
  PREVALENCIA_APIOLICE_SOBRE_CONFIG: 'Prevalência Apólice sobre Config',
}

const typeColors: Record<string, string> = {
  INT: 'bg-state-warning/10 text-state-warning',
  DECIMAL: 'bg-state-warning/10 text-state-warning',
  BOOLEAN: 'bg-state-success/10 text-state-success',
  VARCHAR: 'bg-state-warning/10 text-state-warning',
}

// ─────────────────────────────────────────────────────────
// Helper: format display value
// ─────────────────────────────────────────────────────────

function formatDisplayValue(valor: string, tipoParse: string, chave: string): string {
  if (tipoParse === 'BOOLEAN') {
    return valor.toLowerCase() === 'true' ? 'Sim' : 'Não'
  }
  if (tipoParse === 'INT') {
    const num = parseInt(valor, 10)
    if (chave.includes('IDADE') || chave.includes('DIAS') || chave.includes('MESES')) {
      return `${num}`
    }
    return `${num}`
  }
  if (tipoParse === 'DECIMAL') {
    const num = parseFloat(valor)
    if (chave.includes('LIMITE') || chave.includes('SAQUE')) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
    }
    return `${num}`
  }
  return valor
}

// ─────────────────────────────────────────────────────────
// Edit Config Dialog
// ─────────────────────────────────────────────────────────

function EditConfigDialog({
  config,
  open,
  onOpenChange,
}: {
  config: ConfigItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [editValue, setEditValue] = useState('')
  const [motivo, setMotivo] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const isCritical = config ? CRITICAL_KEYS.includes(config.chave) : false

  // Reset state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && config) {
      setEditValue(config.valor)
      setMotivo('')
      setConfirmed(false)
    }
    onOpenChange(nextOpen)
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('No config selected')

      const body: Record<string, unknown> = {
        valor: config.tipoParse === 'BOOLEAN' ? editValue.toLowerCase() : editValue,
        motivo_alteracao: motivo,
      }
      if (isCritical) {
        body.confirmado = confirmed
      }

      const res = await fetch(`/api/configuracoes/${encodeURIComponent(config.chave)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 409) {
        throw new Error('CONFLICT')
      }
      if (res.status === 400) {
        const data = await res.json()
        throw new Error(data.error || 'VALIDATION_ERROR')
      }
      if (!res.ok) {
        throw new Error('Erro ao atualizar configuração')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
      queryClient.invalidateQueries({ queryKey: ['audit-config'] })
      toast.success('Configuração atualizada com sucesso')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        toast.error('Conflito: configuração foi alterada por outro usuário. Recarregue.')
        queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
      } else if (error.message === 'VALIDATION_ERROR') {
        toast.error(error.message)
      } else {
        toast.error(error.message)
      }
    },
  })

  const motivoLength = motivo.length
  const motivoValid = motivoLength >= 20 && motivoLength <= 500
  const valueChanged = config ? editValue !== config.valor : false
  const canSubmit = valueChanged && motivoValid && (!isCritical || confirmed)

  if (!config) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar Configuração
          </DialogTitle>
          <DialogDescription>
            Altere o valor da configuração. Todos os cambios são registrados no log de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Config info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-semibold text-foreground">{config.chave}</code>
              <Badge className={typeColors[config.tipoParse] || 'bg-muted text-muted-foreground'}>
                {config.tipoParse}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{config.descricao}</p>
          </div>

          <Separator />

          {/* Value input */}
          <div className="space-y-2">
            <Label>Valor</Label>
            {config.tipoParse === 'BOOLEAN' ? (
              <div className="flex items-center gap-3">
                <Switch
                  checked={editValue.toLowerCase() === 'true'}
                  onCheckedChange={(checked) => setEditValue(checked ? 'true' : 'false')}
                />
                <span className="text-sm text-foreground">
                  {editValue.toLowerCase() === 'true' ? 'Sim' : 'Não'}
                </span>
              </div>
            ) : config.tipoParse === 'INT' || config.tipoParse === 'DECIMAL' ? (
              <Input
                type="number"
                step={config.tipoParse === 'DECIMAL' ? '0.01' : '1'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono"
              />
            ) : (
              <Input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono"
              />
            )}
          </div>

          {/* Old vs New preview */}
          {valueChanged && (
            <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Prévia da alteração</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14 shrink-0">Antes:</span>
                <code className="font-mono text-state-error line-through bg-state-error/5 px-1.5 py-0.5 rounded">
                  {formatDisplayValue(config.valor, config.tipoParse, config.chave)}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14 shrink-0">Depois:</span>
                <code className="font-mono text-state-success bg-state-success/5 px-1.5 py-0.5 rounded">
                  {formatDisplayValue(editValue, config.tipoParse, config.chave)}
                </code>
              </div>
            </div>
          )}

          {/* Critical key warning */}
          {isCritical && (
            <div className="rounded-lg border border-state-error/30 bg-state-error/5 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-state-error mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm font-medium text-state-error">
                  ⚠️ Esta é uma chave crítica. A alteração exige confirmação dupla.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-critical"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="confirm-critical" className="text-xs text-state-error cursor-pointer leading-snug">
                  Confirmo que compreendo o impacto desta alteração
                </label>
              </div>
            </div>
          )}

          {/* Motivo da alteração */}
          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo da Alteração <span className="text-state-error">*</span>
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da alteração (mín. 20 caracteres)..."
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex justify-between text-xs">
              <span className={motivoValid ? 'text-state-success' : motivoLength > 0 ? 'text-state-error' : 'text-muted-foreground'}>
                {motivoLength < 20 ? `Faltam ${20 - motivoLength} caracteres` : motivoLength > 500 ? 'Excedeu o limite de 500 caracteres' : '✓ Tamanho válido'}
              </span>
              <span className={`${motivoLength > 500 ? 'text-state-error' : 'text-muted-foreground'}`}>
                {motivoLength}/500
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!canSubmit || updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
            Salvar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
// Integrity Diagnostics Dialog
// ─────────────────────────────────────────────────────────

function IntegrityDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set())

  const integrityQuery = useQuery<IntegrityResult>({
    queryKey: ['diagnostico-integridade'],
    queryFn: async () => {
      const res = await fetch('/api/diagnostico/integridade', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao executar diagnóstico')
      return res.json()
    },
    enabled: open,
  })

  const airgapQuery = useQuery<AirGapResult>({
    queryKey: ['diagnostico-airgap-clt'],
    queryFn: async () => {
      const res = await fetch('/api/diagnostico/airgap-clt', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao verificar air-gap CLT')
      return res.json()
    },
    enabled: false, // manually triggered
  })

  const toggleCheck = (nome: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome)
      else next.add(nome)
      return next
    })
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'OK':
      case 'LIMPO':
        return <ShieldCheck className="h-4 w-4 text-state-success" aria-hidden="true" />
      case 'ALERTA':
        return <AlertTriangle className="h-4 w-4 text-state-warning" aria-hidden="true" />
      case 'CRITICO':
        return <ShieldAlert className="h-4 w-4 text-state-error" aria-hidden="true" />
      default:
        return null
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'OK':
      case 'LIMPO':
        return '✅ OK'
      case 'ALERTA':
        return '⚠️ ALERTA'
      case 'CRITICO':
        return '🔴 CRÍTICO'
      default:
        return status
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" aria-hidden="true" />
            Diagnóstico de Integridade
          </DialogTitle>
          <DialogDescription>
            Verificações de integridade do sistema Granpaz
          </DialogDescription>
        </DialogHeader>

        {integrityQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : integrityQuery.error ? (
          <div className="text-center py-8 text-sm text-state-error">
            Erro ao executar diagnóstico. Tente novamente.
          </div>
        ) : integrityQuery.data ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-state-success/30 bg-state-success/5 p-3 text-center">
                <p className="text-2xl font-bold text-state-success">{integrityQuery.data.resumo.ok}</p>
                <p className="text-xs text-state-success/80">OK</p>
              </div>
              <div className="rounded-lg border border-state-warning/30 bg-state-warning/5 p-3 text-center">
                <p className="text-2xl font-bold text-state-warning">{integrityQuery.data.resumo.alertas}</p>
                <p className="text-xs text-state-warning/80">Alertas</p>
              </div>
              <div className="rounded-lg border border-state-error/30 bg-state-error/5 p-3 text-center">
                <p className="text-2xl font-bold text-state-error">{integrityQuery.data.resumo.criticos}</p>
                <p className="text-xs text-state-error/80">Críticos</p>
              </div>
            </div>

            {/* Checks */}
            <div className="space-y-2">
              {integrityQuery.data.checks.map((check) => (
                <div key={check.nome} className="rounded-lg border border-border/60">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggleCheck(check.nome)}
                    aria-expanded={expandedChecks.has(check.nome)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {statusIcon(check.status)}
                      <span className="text-sm font-medium text-foreground truncate">{check.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {statusLabel(check.status)}
                      </Badge>
                      {expandedChecks.has(check.nome) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                  <div className={`px-3 pb-3 ${expandedChecks.has(check.nome) ? 'block' : 'hidden'}`}>
                    <p className="text-xs text-muted-foreground mb-2">{check.mensagem}</p>
                    {check.detalhes && (
                      <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto font-mono">
                        {JSON.stringify(check.detalhes, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Air-Gap CLT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">Verificação Air-Gap CLT</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => airgapQuery.refetch()}
                  disabled={airgapQuery.isFetching}
                >
                  {airgapQuery.isFetching ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden="true" />
                  ) : null}
                  Verificar Air-Gap CLT
                </Button>
              </div>

              {airgapQuery.data && (
                <div className={`rounded-lg border p-3 ${
                  airgapQuery.data.status === 'LIMPO'
                    ? 'border-state-success/30 bg-state-success/5'
                    : airgapQuery.data.status === 'ALERTA'
                    ? 'border-state-warning/30 bg-state-warning/5'
                    : 'border-state-error/30 bg-state-error/5'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(airgapQuery.data.status)}
                    <span className="text-sm font-medium">
                      {statusLabel(airgapQuery.data.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {airgapQuery.data.totalViolacoes === 0
                      ? 'Nenhum termo CLT proibido encontrado nos dados do sistema.'
                      : `${airgapQuery.data.totalViolacoes} violação(ões) encontrada(s) em ${airgapQuery.data.totalTermosVerificados} termos verificados.`}
                  </p>
                  {airgapQuery.data.violations.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {airgapQuery.data.violations.map((v, i) => (
                        <div key={i} className="text-xs bg-background/50 rounded p-2 font-mono">
                          <span className="text-state-error">{v.entidade}</span>
                          {' · '}
                          <span className="text-muted-foreground">{v.campo}</span>
                          {' · '}
                          <span className="text-state-warning">&quot;{v.termoEncontrado}&quot;</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {airgapQuery.error && (
                <p className="text-xs text-state-error">Erro ao verificar air-gap CLT.</p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
// Config List Item
// ─────────────────────────────────────────────────────────

function ConfigListItem({
  config,
  isSuperAdmin,
  onEdit,
}: {
  config: ConfigItem
  isSuperAdmin: boolean
  onEdit: (config: ConfigItem) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/30 gap-2">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {LABEL_MAP[config.chave] || config.chave}
          </span>
          <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[config.tipoParse] || 'bg-muted text-muted-foreground'}`}>
            {config.tipoParse}
          </Badge>
          {CRITICAL_KEYS.includes(config.chave) && (
            <Badge className="text-[10px] px-1.5 py-0 bg-state-error/10 text-state-error">
              CRÍTICO
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <code className="font-mono">{config.chave}</code>
          <span>·</span>
          <span>{config.descricao}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Atualizado em {formatDate(config.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-3 sm:ml-4">
        <div className="flex items-center gap-2">
          {config.tipoParse === 'BOOLEAN' ? (
            <Badge variant="outline" className="font-mono text-xs">
              {config.valor.toLowerCase() === 'true' ? '✓ Sim' : '✗ Não'}
            </Badge>
          ) : (
            <code className="text-sm font-mono font-medium text-foreground bg-background/60 px-2 py-0.5 rounded">
              {formatDisplayValue(config.valor, config.tipoParse, config.chave)}
            </code>
          )}
          {isSuperAdmin && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(config)} className="h-8 w-8 p-0" aria-label={`Editar ${config.chave}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main ConfigTab Component
// ─────────────────────────────────────────────────────────

export function ConfigTab() {
  const user = useAppStore((s) => s.user)
  const activeProfile = useAppStore((s) => s.activeProfile)
  const profile = activeProfile ?? user?.role
  const isSuperAdmin = profile === 'SUPERADMIN'
  const [editConfig, setEditConfig] = useState<ConfigItem | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [integrityDialogOpen, setIntegrityDialogOpen] = useState(false)

  const { data: configs = [], isLoading } = useQuery<ConfigItem[]>({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const res = await fetch('/api/configuracoes')
      if (!res.ok) throw new Error('Erro ao carregar configurações')
      return res.json()
    },
  })

  const handleEdit = (config: ConfigItem) => {
    setEditConfig(config)
    setEditDialogOpen(true)
  }

  // Group configs by category
  const categorizeConfigs = () => {
    const categorized: Record<string, ConfigItem[]> = {}
    const uncategorized: ConfigItem[] = []
    const assignedKeys: Set<string> = new Set()

    for (const [category, keys] of Object.entries(CONFIG_CATEGORIES)) {
      categorized[category] = []
      for (const key of keys) {
        const config = configs.find((c) => c.chave === key)
        if (config) {
          categorized[category].push(config)
          assignedKeys.add(key)
        }
      }
    }

    // Any configs not assigned to a category
    for (const config of configs) {
      if (!assignedKeys.has(config.chave)) {
        uncategorized.push(config)
      }
    }

    return { categorized, uncategorized }
  }

  const { categorized, uncategorized } = categorizeConfigs()

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Regras de negócio da plataforma</p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setIntegrityDialogOpen(true)}
            variant="outline"
            className="shrink-0"
          >
            <FileSearch className="h-4 w-4 mr-2" aria-hidden="true" />
            Diagnóstico de Integridade
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full rounded-lg" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Categorized configs */}
          <Accordion type="multiple" defaultValue={Object.keys(CONFIG_CATEGORIES)} className="space-y-3">
            {Object.entries(categorized).map(([category, categoryConfigs]) => {
              if (categoryConfigs.length === 0) return null
              return (
                <AccordionItem key={category} value={category} className="border rounded-lg border-border/50 bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <CardTitle className="text-base">{category}</CardTitle>
                      <Badge variant="outline" className="text-xs ml-1">
                        {categoryConfigs.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {categoryConfigs.map((config) => (
                        <ConfigListItem
                          key={config.id}
                          config={config}
                          isSuperAdmin={isSuperAdmin}
                          onEdit={handleEdit}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Outras Configurações ({uncategorized.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {uncategorized.map((config) => (
                    <ConfigListItem
                      key={config.id}
                      config={config}
                      isSuperAdmin={isSuperAdmin}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {configs.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-muted-foreground">Nenhuma configuração encontrada</p>
              </CardContent>
            </Card>
          )}

          {/* LGPD compliance note */}
          <p className="text-xs text-muted-foreground text-center mt-6 px-4">
            📋 Logs de auditoria são imutáveis e retidos conforme LGPD Art. 37 e SUSEP Circular 666/2022.
          </p>
        </div>
      )}

      {/* Dialogs */}
      <EditConfigDialog
        config={editConfig}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      <IntegrityDialog
        open={integrityDialogOpen}
        onOpenChange={setIntegrityDialogOpen}
      />
    </div>
  )
}
