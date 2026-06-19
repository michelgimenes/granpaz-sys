'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  AlertTriangle, Plus, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Loader2, Shield, ShieldCheck,
  ShieldAlert, FileText, Ban, UserX, Scale, Eye,
  Lock, Fingerprint, CalendarDays, Hourglass, Play,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────

interface Vinculo {
  id: string
  tipoVinculo: string
  parentesco: string
  dataFimVinculo?: string | null
  pessoaVinculada: {
    id: string
    nomeCompleto: string
    tipoRegistro: string
    dataNascimento?: string
    cpf?: string | null
  }
}

interface Contrato {
  id: string
  status: string
  valorParcelaBase: number
  valorTaxaAdesao: number
  dataInicio: string | null
  dataCancelamento: string | null
  motivoCancelamento: string | null
  dataSuspensao: string | null
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
    dataAprovacao: string | null
  } | null
  remissao?: {
    id: string
    dataInicioRemissao: string
    dataFimRemissao: string
    mesesAplicados: number
    origemPrazo: string
  } | null
}

interface RemissaoInfo {
  id: string
  dataInicioRemissao: string
  dataFimRemissao: string
  mesesAplicados: number
  origemPrazo: string
}

interface Sinistro {
  id: string
  contratoId: string
  pessoaVinculadaId: string
  tipoSinistro: string
  dataOcorrencia: string
  status: string
  documentoS3Hash: string | null
  motivoNegacao: string | null
  carenciaDias: number | null
  carenciaMeses: number | null
  observacoes: string | null
  createdAt: string
  contrato: {
    id: string
    titular: { id: string; nomeCompleto: string }
    plano: { nome: string }
    remissao?: RemissaoInfo | null
  }
  pessoaVinculada: {
    id: string
    nomeCompleto: string
    tipoRegistro: string
  }
}

interface PaginatedSinistros {
  data: Sinistro[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface PaginatedContratos {
  data: Contrato[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Constants ───────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  EM_ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  NEGADO_CARENCIA: 'Negado - Carência',
  NEGADO_FRAUDE: 'Negado - Fraude',
  NEGADO_EXCLUSAO: 'Negado - Exclusão',
}

const STATUS_COLORS: Record<string, string> = {
  EM_ANALISE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  APROVADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  NEGADO_CARENCIA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  NEGADO_FRAUDE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  NEGADO_EXCLUSAO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  EM_ANALISE: Clock,
  APROVADO: CheckCircle2,
  NEGADO_CARENCIA: XCircle,
  NEGADO_FRAUDE: ShieldAlert,
  NEGADO_EXCLUSAO: Ban,
}

const TIPO_SINISTRO_LABELS: Record<string, string> = {
  OBITO_NATURAL: 'Óbito Natural',
  OBITO_ACIDENTAL: 'Óbito Acidental',
  SUICIDIO: 'Suicídio',
  INVALIDEZ_TOTAL: 'Invalidez Total',
}

const CARENCIA_INFO: Record<string, string> = {
  OBITO_ACIDENTAL: '3 dias',
  OBITO_NATURAL: '6 meses',
  SUICIDIO: '24 meses',
  INVALIDEZ_TOTAL: '6 meses',
}

// ─── Helper: get auth headers ────────────────────────────

function getAuthHeaders(userId?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
  }
}

// ─── Main Component ──────────────────────────────────────

export function ClaimsTab() {
  const queryClient = useQueryClient()
  const user = useAppStore((s) => s.user)
  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const isFinanceiroOrAdmin = user?.role === 'SUPERADMIN' || user?.role === 'FINANCEIRO'

  // ── Form state ──
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    contratoId: '',
    pessoaVinculadaId: '',
    tipoSinistro: 'OBITO_NATURAL',
    dataOcorrencia: '',
    documentoS3Hash: '',
    observacoes: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [carenciaResult, setCarenciaResult] = useState<{
    negado: boolean
    motivoNegacao?: string
    carenciaDias?: number | null
    carenciaMeses?: number | null
  } | null>(null)

  // ── List state ──
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sinistrosPage, setSinistrosPage] = useState(1)
  const [expandedSinistro, setExpandedSinistro] = useState<string | null>(null)
  const [sinistroDetail, setSinistroDetail] = useState<Sinistro | null>(null)

  // ── Action dialogs ──
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; sinistroId: string }>({ open: false, sinistroId: '' })
  const [denyFraudDialog, setDenyFraudDialog] = useState<{ open: boolean; sinistroId: string }>({ open: false, sinistroId: '' })
  const [denyExclusionDialog, setDenyExclusionDialog] = useState<{ open: boolean; sinistroId: string }>({ open: false, sinistroId: '' })
  const [denyMotivo, setDenyMotivo] = useState('')

  // ── Suspension dialog ──
  const [suspensionDialog, setSuspensionDialog] = useState<{
    open: boolean
    contratoId: string
    acao: 'SUSPENDER' | 'REATIVAR'
    contratoTitulo: string
  }>({ open: false, contratoId: '', acao: 'SUSPENDER', contratoTitulo: '' })
  const [suspensionMotivo, setSuspensionMotivo] = useState('')

  // ── CDC dialog ──
  const [cdcDialog, setCdcDialog] = useState<{
    open: boolean
    contratoId: string
    contratoTitulo: string
    dataInicio: string
    diasRestantes: number
  }>({ open: false, contratoId: '', contratoTitulo: '', dataInicio: '', diasRestantes: 0 })

  // ── Compliance dialog ──
  const [complianceDialog, setComplianceDialog] = useState<{
    open: boolean
    tipo: 'maioridade' | 'lgpd' | 'suspensao-auto'
    titulo: string
    descricao: string
  }>({ open: false, tipo: 'maioridade', titulo: '', descricao: '' })

  // ── Compliance section open ──
  const [complianceOpen, setComplianceOpen] = useState(false)

  // ── Contracts for CDC and suspension ──
  const [contratosPage, setContratosPage] = useState(1)

  // ─── Queries ───

  const { data: sinistrosData, isLoading: sinistrosLoading } = useQuery<PaginatedSinistros>({
    queryKey: ['sinistros', sinistrosPage, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(sinistrosPage), limit: '10' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/sinistros?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar sinistros')
      return res.json()
    },
  })

  const { data: contratosData } = useQuery<PaginatedContratos>({
    queryKey: ['contratos-claims', contratosPage],
    queryFn: async () => {
      const res = await fetch(`/api/contratos?page=${contratosPage}&limit=50`)
      if (!res.ok) return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }
      return res.json()
    },
  })

  // Get vinculos for selected contract
  const selectedContrato = contratosData?.data?.find((c) => c.id === form.contratoId)
  const activeVinculos = selectedContrato?.vinculos?.filter((v) => !v.dataFimVinculo) || []

  // Sinistro detail query
  const { data: sinistroDetailData } = useQuery<Sinistro>({
    queryKey: ['sinistro-detail', expandedSinistro],
    queryFn: async () => {
      if (!expandedSinistro) return null
      const res = await fetch(`/api/sinistros/${expandedSinistro}`)
      if (!res.ok) throw new Error('Erro')
      return res.json()
    },
    enabled: !!expandedSinistro,
  })

  // ─── Mutations ───

  const createSinistroMutation = useMutation({
    mutationFn: async () => {
      const body = {
        contratoId: form.contratoId,
        pessoaVinculadaId: form.pessoaVinculadaId || undefined,
        tipoSinistro: form.tipoSinistro,
        dataOcorrencia: form.dataOcorrencia,
        documentoS3Hash: form.documentoS3Hash || undefined,
        observacoes: form.observacoes || undefined,
      }
      const res = await fetch('/api/sinistros', {
        method: 'POST',
        headers: getAuthHeaders(user?.id),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar sinistro')
      return data
    },
    onSuccess: (data: Sinistro) => {
      queryClient.invalidateQueries({ queryKey: ['sinistros'] })
      setShowForm(false)
      setForm({
        contratoId: '',
        pessoaVinculadaId: '',
        tipoSinistro: 'OBITO_NATURAL',
        dataOcorrencia: '',
        documentoS3Hash: '',
        observacoes: '',
      })

      // Show carência result
      if (data.status === 'NEGADO_CARENCIA') {
        setCarenciaResult({
          negado: true,
          motivoNegacao: data.motivoNegacao || undefined,
          carenciaDias: data.carenciaDias,
          carenciaMeses: data.carenciaMeses,
        })
        toast.error('Sinistro negado por carência', {
          description: data.motivoNegacao || 'Período de carência não cumprido.',
          duration: 8000,
        })
      } else {
        setCarenciaResult({ negado: false })
        toast.success('Sinistro registrado', {
          description: 'O sinistro foi aberto e está em análise.',
        })
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar sinistro', { description: error.message })
    },
  })

  const updateSinistroMutation = useMutation({
    mutationFn: async ({ id, status, motivoNegacao }: { id: string; status: string; motivoNegacao?: string }) => {
      const res = await fetch(`/api/sinistros/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(user?.id),
        body: JSON.stringify({ status, motivoNegacao }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar sinistro')
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sinistros'] })
      queryClient.invalidateQueries({ queryKey: ['sinistro-detail'] })
      if (variables.status === 'APROVADO') {
        toast.success('Sinistro aprovado', { description: 'O sinistro foi aprovado com sucesso.' })
      } else {
        toast.success('Sinistro negado', { description: `Status alterado para ${STATUS_LABELS[variables.status]}` })
      }
      setApproveDialog({ open: false, sinistroId: '' })
      setDenyFraudDialog({ open: false, sinistroId: '' })
      setDenyExclusionDialog({ open: false, sinistroId: '' })
      setDenyMotivo('')
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar sinistro', { description: error.message })
    },
  })

  const cancelarCdcMutation = useMutation({
    mutationFn: async (contratoId: string) => {
      const res = await fetch(`/api/contratos/${contratoId}/cancelar-cdc`, {
        method: 'POST',
        headers: getAuthHeaders(user?.id),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar contrato')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-claims'] })
      queryClient.invalidateQueries({ queryKey: ['sinistros'] })
      setCdcDialog({ open: false, contratoId: '', contratoTitulo: '', dataInicio: '', diasRestantes: 0 })
      toast.success('Contrato cancelado por arrependimento CDC', {
        description: 'Estorno integral realizado. Zero multa aplicada.',
        duration: 6000,
      })
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar contrato', { description: error.message })
    },
  })

  const suspensaoMutation = useMutation({
    mutationFn: async ({ contratoId, acao, motivo }: { contratoId: string; acao: 'SUSPENDER' | 'REATIVAR'; motivo: string }) => {
      const res = await fetch(`/api/contratos/${contratoId}/suspensao`, {
        method: 'POST',
        headers: getAuthHeaders(user?.id),
        body: JSON.stringify({ acao, motivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na operação')
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contratos-claims'] })
      queryClient.invalidateQueries({ queryKey: ['sinistros'] })
      setSuspensionDialog({ open: false, contratoId: '', acao: 'SUSPENDER', contratoTitulo: '' })
      setSuspensionMotivo('')
      toast.success(
        variables.acao === 'SUSPENDER' ? 'Contrato suspenso' : 'Contrato reativado',
        { description: variables.acao === 'SUSPENDER' ? 'O contrato foi suspenso com sucesso.' : 'Contrato reativado (Récita). EC-08: Carência pode necessitar recálculo.' }
      )
    },
    onError: (error: Error) => {
      toast.error('Erro na operação', { description: error.message })
    },
  })

  const complianceMutation = useMutation({
    mutationFn: async (tipo: 'maioridade' | 'lgpd' | 'suspensao-auto') => {
      const res = await fetch(`/api/compliance/${tipo}`, {
        method: 'POST',
        headers: getAuthHeaders(user?.id),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao executar job')
      return { tipo, data }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contratos-claims'] })
      queryClient.invalidateQueries({ queryKey: ['sinistros'] })
      setComplianceDialog({ open: false, tipo: 'maioridade', titulo: '', descricao: '' })

      if (result.tipo === 'maioridade') {
        toast.success('Job de Maioridade executado', {
          description: `${result.data.expirados || 0} vínculos expirados, ${result.data.totalVerificados || 0} verificados.`,
          duration: 6000,
        })
      } else if (result.tipo === 'lgpd') {
        toast.success('Job LGPD executado', {
          description: `${result.data.anonimizados || 0} anonimizados, ${result.data.skipped || 0} com pendência financeira.`,
          duration: 6000,
        })
      } else {
        toast.success('Job de Auto-Suspensão executado', {
          description: `${result.data.contratosSuspensos || 0} contratos suspensos por inadimplência.`,
          duration: 6000,
        })
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao executar job de compliance', { description: error.message })
    },
  })

  // ─── Handlers ───

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setCarenciaResult(null)

    // Validate data_ocorrencia not in future
    if (form.dataOcorrencia) {
      const dataOcc = new Date(form.dataOcorrencia)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (dataOcc > today) {
        setFormError('Data da ocorrência não pode ser futura.')
        return
      }
    }

    // Validate SHA-256 hash format (64 hex chars)
    if (form.documentoS3Hash) {
      const hash = form.documentoS3Hash.trim()
      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        setFormError('Hash SHA-256 inválido. Deve conter exatamente 64 caracteres hexadecimais.')
        return
      }
    }

    if (!form.contratoId || !form.tipoSinistro || !form.dataOcorrencia) {
      setFormError('Preencha todos os campos obrigatórios.')
      return
    }

    createSinistroMutation.mutate()
  }, [form, createSinistroMutation])

  // CDC countdown calculation
  const getCdcInfo = useCallback((dataInicio: string | null) => {
    if (!dataInicio) return { eligible: false, diasRestantes: 0 }
    const inicio = new Date(dataInicio)
    const prazo = new Date(inicio)
    prazo.setDate(prazo.getDate() + 7)
    const now = new Date()
    const diasRestantes = Math.ceil((prazo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { eligible: diasRestantes > 0, diasRestantes: Math.max(0, diasRestantes) }
  }, [])

  // Filter contracts for CDC eligibility
  const contratosCdc = (contratosData?.data || []).filter((c) => {
    if (c.status !== 'APROVADO') return false
    const info = getCdcInfo(c.dataInicio)
    return info.eligible
  })

  // Filter contracts for suspension/reativação
  const contratosSuspensao = (contratosData?.data || []).filter((c) =>
    c.status === 'APROVADO' || c.status === 'SUSPENSO'
  )

  // ─── Rendering ───

  const sinistros = sinistrosData?.data || []
  const sinistrosPagination = sinistrosData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }

  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Sinistros & Compliance</h1>
          <p className="text-muted-foreground mt-1">Gestão de sinistros, carência e compliance legal</p>
        </div>
        {isFinanceiroOrAdmin && (
          <Button onClick={() => { setShowForm(!showForm); setCarenciaResult(null); setFormError(null) }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Novo Sinistro
          </Button>
        )}
      </div>

      {/* ═══ SECTION 1: Carência Reference ═══ */}
      <Card className="border-border/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
            <span className="text-muted-foreground">
              Carência: <strong className="text-foreground">3 dias</strong> (acidental) •{' '}
              <strong className="text-foreground">6 meses</strong> (natural/invalidez) •{' '}
              <strong className="text-foreground">24 meses</strong> (suicídio, Art. 798 CC)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION 2: Sinistro Registration Form ═══ */}
      {showForm && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Registrar Novo Sinistro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Contrato + Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contratoId">Contrato *</Label>
                  <Select
                    value={form.contratoId}
                    onValueChange={(val) => setForm((f) => ({ ...f, contratoId: val, pessoaVinculadaId: '' }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o contrato..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(contratosData?.data || [])
                        .filter((c) => c.status === 'APROVADO' || c.status === 'SUSPENSO')
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.titular.nomeCompleto} — {c.plano.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipoSinistro">Tipo de Sinistro *</Label>
                  <Select
                    value={form.tipoSinistro}
                    onValueChange={(val) => setForm((f) => ({ ...f, tipoSinistro: val }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_SINISTRO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label} (carência: {CARENCIA_INFO[value]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Pessoa Vinculada + Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pessoaVinculadaId">Pessoa Vinculada (EC-04)</Label>
                  <Select
                    value={form.pessoaVinculadaId}
                    onValueChange={(val) => setForm((f) => ({ ...f, pessoaVinculadaId: val }))}
                    disabled={!form.contratoId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={form.contratoId ? 'Titular (padrão)' : 'Selecione contrato primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Titular option */}
                      {selectedContrato && (
                        <SelectItem key={selectedContrato.titular.id} value={selectedContrato.titular.id}>
                          {selectedContrato.titular.nomeCompleto} (Titular)
                        </SelectItem>
                      )}
                      {/* Active vinculos */}
                      {activeVinculos.map((v) => (
                        <SelectItem key={v.pessoaVinculada.id} value={v.pessoaVinculada.id}>
                          {v.pessoaVinculada.nomeCompleto} ({v.tipoVinculo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se não selecionado, o titular do contrato será utilizado.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataOcorrencia">Data da Ocorrência *</Label>
                  <Input
                    type="date"
                    id="dataOcorrencia"
                    required
                    value={form.dataOcorrencia}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm((f) => ({ ...f, dataOcorrencia: e.target.value }))}
                  />
                </div>
              </div>

              {/* Row 3: Documento S3 Hash (Air-Gap RN-01) */}
              <div className="space-y-2">
                <Label htmlFor="documentoS3Hash" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Hash SHA-256 do Documento (Air-Gap RN-01)
                </Label>
                <Input
                  id="documentoS3Hash"
                  placeholder="Hash SHA-256 (64 caracteres hexadecimais)"
                  value={form.documentoS3Hash}
                  onChange={(e) => setForm((f) => ({ ...f, documentoS3Hash: e.target.value }))}
                  maxLength={64}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Apenas o hash é armazenado (Air-Gap). Dados clínicos nunca entram no sistema.
                </p>
              </div>

              {/* Row 4: Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Detalhes do sinistro..."
                  className="min-h-[60px]"
                />
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {formError}
                </div>
              )}

              {/* Carência Result */}
              {carenciaResult && (
                <div
                  className={`flex items-start gap-2 text-sm p-3 rounded-md ${
                    carenciaResult.negado
                      ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                      : 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
                  }`}
                >
                  {carenciaResult.negado ? (
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    {carenciaResult.negado ? (
                      <>
                        <p className="font-medium">Sinistro Negado por Carência</p>
                        <p>{carenciaResult.motivoNegacao}</p>
                        {carenciaResult.carenciaMeses && (
                          <p className="text-xs mt-1">Período de carência exigido: {carenciaResult.carenciaMeses} meses</p>
                        )}
                        {carenciaResult.carenciaDias !== null && carenciaResult.carenciaDias !== undefined && carenciaResult.carenciaDias > 0 && (
                          <p className="text-xs mt-1">Período de carência exigido: {carenciaResult.carenciaDias} dias</p>
                        )}
                        {form.tipoSinistro === 'SUICIDIO' && (
                          <p className="text-xs mt-1 italic">Art. 798 CC aplicado — carência de 24 meses para suicídio</p>
                        )}
                      </>
                    ) : (
                      <p className="font-medium">Sinistro registrado com sucesso — Em Análise</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={createSinistroMutation.isPending}
                >
                  {createSinistroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                  Registrar Sinistro
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setCarenciaResult(null); setFormError(null) }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 3: Sinistro List ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Sinistros Registrados</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="statusFilter" className="text-xs text-muted-foreground sr-only sm:not-sr-only">
                Filtrar:
              </Label>
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setSinistrosPage(1) }}>
                <SelectTrigger className="w-[160px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="NEGADO_CARENCIA">Negado - Carência</SelectItem>
                  <SelectItem value="NEGADO_FRAUDE">Negado - Fraude</SelectItem>
                  <SelectItem value="NEGADO_EXCLUSAO">Negado - Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sinistrosLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : sinistros.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
              <p className="text-muted-foreground">Nenhum sinistro encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sinistros.map((sinistro) => {
                const StatusIcon = STATUS_ICONS[sinistro.status] || AlertTriangle
                const isExpanded = expandedSinistro === sinistro.id

                return (
                  <div key={sinistro.id}>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedSinistro(isExpanded ? null : sinistro.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center justify-between py-3 px-1 hover:bg-muted/50 rounded-md transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {sinistro.pessoaVinculada.nomeCompleto}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{TIPO_SINISTRO_LABELS[sinistro.tipoSinistro] || sinistro.tipoSinistro}</span>
                              <span>•</span>
                              <span>{formatDate(sinistro.dataOcorrencia)}</span>
                              {sinistro.documentoS3Hash && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[10px]" title={sinistro.documentoS3Hash}>
                                    🔒 {sinistro.documentoS3Hash.substring(0, 8)}...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={STATUS_COLORS[sinistro.status] || 'bg-muted text-muted-foreground'}>
                            {STATUS_LABELS[sinistro.status] || sinistro.status}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="ml-8 mb-3 space-y-3">
                        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                          {/* Details grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">Contrato:</span>{' '}
                              <span className="font-medium">{sinistro.contrato.titular.nomeCompleto}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Plano:</span>{' '}
                              <span className="font-medium">{sinistro.contrato.plano.nome}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Registro:</span>{' '}
                              <span className="font-medium">{formatDate(sinistro.createdAt)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tipo Registro:</span>{' '}
                              <span className="font-medium">{sinistro.pessoaVinculada.tipoRegistro}</span>
                            </div>
                          </div>

                          {/* Documento S3 Hash */}
                          {sinistro.documentoS3Hash && (
                            <div>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                Hash SHA-256 (Air-Gap):
                              </span>{' '}
                              <code className="font-mono text-xs bg-background px-2 py-0.5 rounded break-all">
                                {sinistro.documentoS3Hash}
                              </code>
                            </div>
                          )}

                          {/* Motivo Negação */}
                          {sinistro.motivoNegacao && (
                            <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              <span className="text-red-700 dark:text-red-400 font-medium">Motivo da Negação:</span>{' '}
                              <span className="text-red-600 dark:text-red-300">{sinistro.motivoNegacao}</span>
                            </div>
                          )}

                          {/* Carência Info */}
                          {(sinistro.carenciaDias !== null || sinistro.carenciaMeses !== null) && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                              <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                                <Hourglass className="h-3 w-3" aria-hidden="true" />
                                Carência:
                              </span>{' '}
                              <span className="text-amber-600 dark:text-amber-300">
                                {sinistro.carenciaMeses
                                  ? `${sinistro.carenciaMeses} meses`
                                  : sinistro.carenciaDias
                                    ? `${sinistro.carenciaDias} dias`
                                    : 'N/A'}
                              </span>
                            </div>
                          )}

                          {/* Observações */}
                          {sinistro.observacoes && (
                            <div>
                              <span className="text-muted-foreground">Observações:</span>{' '}
                              <span>{sinistro.observacoes}</span>
                            </div>
                          )}

                          {/* Remissão info for APROVADO OBITO */}
                          {sinistro.status === 'APROVADO' &&
                            ['OBITO_NATURAL', 'OBITO_ACIDENTAL', 'SUICIDIO'].includes(sinistro.tipoSinistro) &&
                            sinistroDetailData?.contrato?.remissao && (
                              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded space-y-1">
                                <p className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                  Remissão Ativa (RN-07)
                                </p>
                                <div className="text-xs text-emerald-600 dark:text-emerald-300 space-y-0.5">
                                  <p>Início: {formatDate(sinistroDetailData.contrato.remissao.dataInicioRemissao)}</p>
                                  <p>Fim: {formatDate(sinistroDetailData.contrato.remissao.dataFimRemissao)}</p>
                                  <p>Meses aplicados: {sinistroDetailData.contrato.remissao.mesesAplicados}</p>
                                  <p>Origem do prazo: {sinistroDetailData.contrato.remissao.origemPrazo}</p>
                                </div>
                              </div>
                            )}

                          {/* Action buttons for EM_ANALISE */}
                          {sinistro.status === 'EM_ANALISE' && isSuperAdmin && (
                            <>
                              <Separator />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() => setApproveDialog({ open: true, sinistroId: sinistro.id })}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                                  Aprovar Sinistro
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => { setDenyFraudDialog({ open: true, sinistroId: sinistro.id }); setDenyMotivo('') }}
                                >
                                  <ShieldAlert className="h-3 w-3 mr-1" aria-hidden="true" />
                                  Negar por Fraude
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                  onClick={() => { setDenyExclusionDialog({ open: true, sinistroId: sinistro.id }); setDenyMotivo('') }}
                                >
                                  <Ban className="h-3 w-3 mr-1" aria-hidden="true" />
                                  Negar por Exclusão
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Pagination */}
              {sinistrosPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    {sinistrosPagination.total} sinistro(s) — Página {sinistrosPagination.page} de {sinistrosPagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sinistrosPage <= 1}
                      onClick={() => setSinistrosPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sinistrosPage >= sinistrosPagination.totalPages}
                      onClick={() => setSinistrosPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 4: CDC Arrependimento ═══ */}
      {isSuperAdmin && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Arrependimento CDC (Art. 49)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contratosCdc.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum contrato elegível para arrependimento CDC no momento.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {contratosCdc.map((c) => {
                  const cdcInfo = getCdcInfo(c.dataInicio)
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{c.titular.nomeCompleto}</p>
                        <p className="text-xs text-muted-foreground">
                          Início: {formatDate(c.dataInicio!)} • {c.plano.nome}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <CalendarDays className="h-3 w-3 mr-1" aria-hidden="true" />
                          {cdcInfo.diasRestantes}d restantes
                        </Badge>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setCdcDialog({
                              open: true,
                              contratoId: c.id,
                              contratoTitulo: c.titular.nomeCompleto,
                              dataInicio: c.dataInicio!,
                              diasRestantes: cdcInfo.diasRestantes,
                            })
                          }
                        >
                          Cancelar CDC
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Show expired contracts info */}
            {(contratosData?.data || [])
              .filter((c) => c.status === 'APROVADO' && c.dataInicio && !getCdcInfo(c.dataInicio).eligible)
              .slice(0, 3)
              .map((c) => (
                <div key={`expired-${c.id}`} className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Hourglass className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {c.titular.nomeCompleto}: Prazo de arrependimento expirado
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 5: Contract Suspension/Reativação ═══ */}
      {isSuperAdmin && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Suspensão / Reativação de Contratos (RN-03)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contratosSuspensao.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum contrato elegível para suspensão/reativação.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {contratosSuspensao.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{c.titular.nomeCompleto}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.plano.nome}</span>
                        <Badge
                          className={
                            c.status === 'SUSPENSO'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }
                        >
                          {c.status}
                        </Badge>
                        {c.dataSuspensao && (
                          <span>Desde: {formatDate(c.dataSuspensao)}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {c.status === 'APROVADO' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          onClick={() =>
                            setSuspensionDialog({
                              open: true,
                              contratoId: c.id,
                              acao: 'SUSPENDER',
                              contratoTitulo: c.titular.nomeCompleto,
                            })
                          }
                        >
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() =>
                            setSuspensionDialog({
                              open: true,
                              contratoId: c.id,
                              acao: 'REATIVAR',
                              contratoTitulo: c.titular.nomeCompleto,
                            })
                          }
                        >
                          Reativar (Récita)
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 6: Compliance Admin (SuperAdmin only) ═══ */}
      {isSuperAdmin && (
        <Card className="border-border/50">
          <Collapsible open={complianceOpen} onOpenChange={setComplianceOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Ferramentas de Compliance
                  </CardTitle>
                  {complianceOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Jobs de compliance para execução manual. Em produção, estes jobs devem ser agendados automaticamente.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Maioridade */}
                  <div className="border border-border/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <UserX className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      <h3 className="font-medium text-sm">Job de Maioridade</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      RN-05: Expira dependentes FILHO que completaram 21 anos.
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant="outline"
                      disabled={complianceMutation.isPending}
                      onClick={() =>
                        setComplianceDialog({
                          open: true,
                          tipo: 'maioridade',
                          titulo: 'Executar Job de Maioridade',
                          descricao: 'Esta ação expirará automaticamente todos os vínculos de dependentes FILHO que completaram 21 anos. Pessoas com tags especiais (inválido/incapaz) serão ignoradas. Deseja continuar?',
                        })
                      }
                    >
                      <Play className="h-3 w-3 mr-1" aria-hidden="true" />
                      Executar
                    </Button>
                  </div>

                  {/* LGPD */}
                  <div className="border border-border/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-500" aria-hidden="true" />
                      <h3 className="font-medium text-sm">Job LGPD</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      RN-06: Anonimiza PII de contratos encerrados há mais de 5 anos.
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant="outline"
                      disabled={complianceMutation.isPending}
                      onClick={() =>
                        setComplianceDialog({
                          open: true,
                          tipo: 'lgpd',
                          titulo: 'Executar Job de Anonimização LGPD',
                          descricao: 'Esta ação anonimizará permanentemente os dados pessoais (PII) de pessoas cujos contratos foram encerrados há mais de 5 anos. Esta ação é IRREVERSÍVEL. Deseja continuar?',
                        })
                      }
                    >
                      <Play className="h-3 w-3 mr-1" aria-hidden="true" />
                      Executar
                    </Button>
                  </div>

                  {/* Auto-Suspensão */}
                  <div className="border border-border/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      <h3 className="font-medium text-sm">Auto-Suspensão</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      RN-03: Suspende contratos com contas vencidas além do limite configurado.
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant="outline"
                      disabled={complianceMutation.isPending}
                      onClick={() =>
                        setComplianceDialog({
                          open: true,
                          tipo: 'suspensao-auto',
                          titulo: 'Executar Job de Auto-Suspensão',
                          descricao: 'Esta ação suspenderá automaticamente os contratos que possuem contas vencidas além do limite de dias configurado (DIAS_SUSPENSAO_INADIMPLENCIA). Deseja continuar?',
                        })
                      }
                    >
                      <Play className="h-3 w-3 mr-1" aria-hidden="true" />
                      Executar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* ═══ DIALOGS ═══ */}

      {/* Approve Sinistro Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => setApproveDialog({ open, sinistroId: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Confirmar Aprovação do Sinistro
            </DialogTitle>
            <DialogDescription>
              Esta ação aprovará o sinistro. Se for óbito do titular, a remissão será criada automaticamente (RN-07).
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, sinistroId: '' })}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={updateSinistroMutation.isPending}
              onClick={() =>
                updateSinistroMutation.mutate({ id: approveDialog.sinistroId, status: 'APROVADO' })
              }
            >
              {updateSinistroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny by Fraud Dialog */}
      <Dialog open={denyFraudDialog.open} onOpenChange={(open) => setDenyFraudDialog({ open, sinistroId: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
              Negar Sinistro por Fraude
            </DialogTitle>
            <DialogDescription>
              Esta ação negará o sinistro por fraude comprovada. O registro ficará permanentemente marcado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="denyFraudMotivo">Motivo da Negação *</Label>
            <Textarea
              id="denyFraudMotivo"
              value={denyMotivo}
              onChange={(e) => setDenyMotivo(e.target.value)}
              placeholder="Descreva a fraude comprovada..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenyFraudDialog({ open: false, sinistroId: '' }); setDenyMotivo('') }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={updateSinistroMutation.isPending || !denyMotivo.trim()}
              onClick={() =>
                updateSinistroMutation.mutate({
                  id: denyFraudDialog.sinistroId,
                  status: 'NEGADO_FRAUDE',
                  motivoNegacao: denyMotivo.trim(),
                })
              }
            >
              {updateSinistroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Negar por Fraude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny by Exclusion Dialog */}
      <Dialog open={denyExclusionDialog.open} onOpenChange={(open) => setDenyExclusionDialog({ open, sinistroId: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" aria-hidden="true" />
              Negar Sinistro por Exclusão Contratual
            </DialogTitle>
            <DialogDescription>
              Esta ação negará o sinistro por exclusão contratual. O registro ficará permanentemente marcado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="denyExclusionMotivo">Motivo da Negação *</Label>
            <Textarea
              id="denyExclusionMotivo"
              value={denyMotivo}
              onChange={(e) => setDenyMotivo(e.target.value)}
              placeholder="Descreva a cláusula de exclusão aplicável..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenyExclusionDialog({ open: false, sinistroId: '' }); setDenyMotivo('') }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={updateSinistroMutation.isPending || !denyMotivo.trim()}
              onClick={() =>
                updateSinistroMutation.mutate({
                  id: denyExclusionDialog.sinistroId,
                  status: 'NEGADO_EXCLUSAO',
                  motivoNegacao: denyMotivo.trim(),
                })
              }
            >
              {updateSinistroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Negar por Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CDC Cancellation Dialog */}
      <Dialog open={cdcDialog.open} onOpenChange={(open) => setCdcDialog({ open: false, contratoId: '', contratoTitulo: '', dataInicio: '', diasRestantes: 0 })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-600" aria-hidden="true" />
              Cancelar por Arrependimento (CDC Art. 49)
            </DialogTitle>
            <DialogDescription>
              Esta ação cancelará o contrato por arrependimento dentro do prazo de 7 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Contrato:</strong> {cdcDialog.contratoTitulo}</p>
              <p><strong>Data de Início:</strong> {formatDate(cdcDialog.dataInicio)}</p>
              <p><strong>Dias Restantes:</strong> {cdcDialog.diasRestantes} dia(s)</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm text-red-700 dark:text-red-400 space-y-1">
              <p className="font-medium">⚠️ Atenção — Esta ação é irreversível:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Estorno integral de todas as bonificações (LIBERADO → ESTORNADO)</li>
                <li>Cancelamento de todas as contas pendentes</li>
                <li>Zero multa aplicada (Art. 49 CDC)</li>
                <li>Contrato passará para status CANCELADO_CDC</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCdcDialog({ open: false, contratoId: '', contratoTitulo: '', dataInicio: '', diasRestantes: 0 })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelarCdcMutation.isPending}
              onClick={() => cancelarCdcMutation.mutate(cdcDialog.contratoId)}
            >
              {cancelarCdcMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Confirmar Cancelamento CDC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspension/Reativação Dialog */}
      <Dialog open={suspensionDialog.open} onOpenChange={(open) => setSuspensionDialog({ open: false, contratoId: '', acao: 'SUSPENDER', contratoTitulo: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {suspensionDialog.acao === 'SUSPENDER' ? (
                <Shield className="h-5 w-5 text-amber-600" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              )}
              {suspensionDialog.acao === 'SUSPENDER' ? 'Suspender Contrato' : 'Reativar Contrato (Récita)'}
            </DialogTitle>
            <DialogDescription>
              {suspensionDialog.acao === 'SUSPENDER'
                ? 'O contrato será suspenso. O titular perderá acesso aos benefícios até reativação.'
                : 'O contrato será reativado. EC-08: A carência pode necessitar recálculo após a reativação.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm"><strong>Contrato:</strong> {suspensionDialog.contratoTitulo}</p>
            <div className="space-y-2">
              <Label htmlFor="suspensionMotivo">Motivo *</Label>
              <Textarea
                id="suspensionMotivo"
                value={suspensionMotivo}
                onChange={(e) => setSuspensionMotivo(e.target.value)}
                placeholder={
                  suspensionDialog.acao === 'SUSPENDER'
                    ? 'Motivo da suspensão...'
                    : 'Motivo da reativação...'
                }
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSuspensionDialog({ open: false, contratoId: '', acao: 'SUSPENDER', contratoTitulo: '' }); setSuspensionMotivo('') }}>
              Cancelar
            </Button>
            <Button
              className={
                suspensionDialog.acao === 'SUSPENDER'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }
              disabled={suspensaoMutation.isPending || !suspensionMotivo.trim()}
              onClick={() =>
                suspensaoMutation.mutate({
                  contratoId: suspensionDialog.contratoId,
                  acao: suspensionDialog.acao,
                  motivo: suspensionMotivo.trim(),
                })
              }
            >
              {suspensaoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              {suspensionDialog.acao === 'SUSPENDER' ? 'Confirmar Suspensão' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compliance Confirmation Dialog */}
      <Dialog open={complianceDialog.open} onOpenChange={(open) => setComplianceDialog({ open: false, tipo: 'maioridade', titulo: '', descricao: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" aria-hidden="true" />
              {complianceDialog.titulo}
            </DialogTitle>
            <DialogDescription>
              {complianceDialog.descricao}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplianceDialog({ open: false, tipo: 'maioridade', titulo: '', descricao: '' })}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700"
              disabled={complianceMutation.isPending}
              onClick={() => complianceMutation.mutate(complianceDialog.tipo)}
            >
              {complianceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Confirmar Execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
