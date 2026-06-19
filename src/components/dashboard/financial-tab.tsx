'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, formatCPF } from '@/lib/helpers'
import { toast } from 'sonner'

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Icons
import {
  Wallet,
  Lock,
  TrendingDown,
  ArrowUpRight,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Receipt,
  Loader2,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface TitularInfo {
  id: string
  nomeCompleto: string
  cpf: string | null
}

interface CarteiraDigital {
  id: string
  titularId: string
  saldoDisponivel: number
  saldoBloqueado: number
  saldoDevedor: number
  titular: TitularInfo
}

interface ContaAPagar {
  id: string
  contratoId: string
  descricao: string
  valor: number
  valorRestante: number
  dataVencimento: string
  status: string
  contrato?: {
    id: string
    titular: TitularInfo
  }
}

interface ExtratoItem {
  id: string
  tipo: string
  valor: number
  status: string
  data: string
  descricao: string
}

interface TransacaoPagamento {
  id: string
  carteiraId: string
  tipoTransacao: string
  valorAbatido: number
  valorIrrfRetido: number | null
  valorInssRetido: number | null
  valorLiquido: number | null
  status: string
  dataTransacao: string
  observacoes: string | null
  motivoRejeicao: string | null
  carteira: {
    titular: TitularInfo
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ─────────────────────────────────────────────────────────
// Status badge helper
// ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDENTE: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    PENDENTE_APROVACAO: { label: 'Pendente Aprovação', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    PARCIALMENTE_PAGO: { label: 'Parcialmente Pago', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
    PAGO: { label: 'Pago', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
    CONCLUIDO: { label: 'Concluído', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
    LIBERADO: { label: 'Liberado', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
    ESTORNADO: { label: 'Estornado', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
    CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
    VENCIDO: { label: 'Vencido', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  }
  const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' }
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.className}`}>
      {c.label}
    </Badge>
  )
}

// ─────────────────────────────────────────────────────────
// Pagination controls
// ─────────────────────────────────────────────────────────

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
}) {
  if (pagination.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs text-muted-foreground">
        {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function FinancialTab() {
  const user = useAppStore((s) => s.user)
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'FINANCEIRO'

  // ── Wallet query ──
  const {
    data: carteiraData,
    isLoading: loadingCarteira,
  } = useQuery({
    queryKey: ['carteira', user?.pessoaFisicaId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (user?.pessoaFisicaId) params.set('titularId', user.pessoaFisicaId)
      params.set('limit', '1')
      const res = await fetch(`/api/carteiras?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar carteira')
      const json = await res.json()
      return (json.data as CarteiraDigital[])[0] || null
    },
    enabled: !!user,
  })

  const carteira = carteiraData

  // ── Contas a Pagar ──
  const [contasPage, setContasPage] = useState(1)
  const [contasStatus, setContasStatus] = useState<string>('all')

  const {
    data: contasData,
    isLoading: loadingContas,
  } = useQuery({
    queryKey: ['contas-a-pagar', contasPage, contasStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(contasPage))
      params.set('limit', '10')
      if (contasStatus !== 'all') params.set('status', contasStatus)
      const res = await fetch(`/api/contas-a-pagar?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar contas')
      return res.json() as Promise<{ data: ContaAPagar[]; pagination: PaginationInfo }>
    },
  })

  // ── Extrato ──
  const [extratoPage, setExtratoPage] = useState(1)
  const [extratoTipo, setExtratoTipo] = useState<string>('todos')
  const [extratoDataInicio, setExtratoDataInicio] = useState('')
  const [extratoDataFim, setExtratoDataFim] = useState('')

  const {
    data: extratoData,
    isLoading: loadingExtrato,
  } = useQuery({
    queryKey: ['extrato', carteira?.id, extratoPage, extratoTipo, extratoDataInicio, extratoDataFim],
    queryFn: async () => {
      if (!carteira?.id) return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }
      const params = new URLSearchParams()
      params.set('page', String(extratoPage))
      params.set('limit', '10')
      if (extratoTipo !== 'todos') params.set('tipo', extratoTipo)
      if (extratoDataInicio) params.set('data_inicio', extratoDataInicio)
      if (extratoDataFim) params.set('data_fim', extratoDataFim)
      const res = await fetch(`/api/carteiras/${carteira.id}/extrato?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar extrato')
      return res.json() as Promise<{ data: ExtratoItem[]; pagination: PaginationInfo }>
    },
    enabled: !!carteira?.id,
  })

  // ── Admin: Pending Saques ──
  const [saquesPage, setSaquesPage] = useState(1)

  const {
    data: saquesData,
    isLoading: loadingSaques,
  } = useQuery({
    queryKey: ['admin-saques', saquesPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(saquesPage))
      params.set('limit', '10')
      params.set('status', 'PENDENTE_APROVACAO')
      const res = await fetch(`/api/admin/saques?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar saques pendentes')
      return res.json() as Promise<{ data: TransacaoPagamento[]; pagination: PaginationInfo }>
    },
    enabled: isAdmin,
  })

  // ── Abatimento Mutation ──
  const abatimentoMutation = useMutation({
    mutationFn: async ({ carteiraId, contaAPagarId }: { carteiraId: string; contaAPagarId: string }) => {
      const res = await fetch(`/api/carteiras/${carteiraId}/abatimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contaAPagarId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar abatimento')
      return data
    },
    onSuccess: (data) => {
      const valor = data._meta?.valorAbatido ?? 0
      toast.success(`Abatimento de ${formatCurrency(valor)} realizado com sucesso!`)
      if (data._meta?.isPartial) {
        toast.info('Abatimento parcial — restam ' + formatCurrency(data._meta.saldoRestanteParcela))
      }
      queryClient.invalidateQueries({ queryKey: ['carteira'] })
      queryClient.invalidateQueries({ queryKey: ['contas-a-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['extrato'] })
      setAbatimentoDialogOpen(false)
      setSelectedConta(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ── Saque Mutation ──
  const saqueMutation = useMutation({
    mutationFn: async ({ carteiraId, valor }: { carteiraId: string; valor: number }) => {
      const res = await fetch(`/api/carteiras/${carteiraId}/saques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar saque')
      return data
    },
    onSuccess: (data) => {
      const meta = data._meta
      toast.success(`Saque de ${formatCurrency(meta.valor)} solicitado com sucesso!`)
      if (meta.status === 'PENDENTE_APROVACAO') {
        toast.info('Seu saque está pendente de aprovação do Financeiro.', { duration: 6000 })
      }
      queryClient.invalidateQueries({ queryKey: ['carteira'] })
      queryClient.invalidateQueries({ queryKey: ['extrato'] })
      queryClient.invalidateQueries({ queryKey: ['admin-saques'] })
      setSaqueDialogOpen(false)
      setSaqueValor('')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ── Aprovar Saque Mutation ──
  const aprovarMutation = useMutation({
    mutationFn: async ({ transacaoId, aprovado, motivoRejeicao }: { transacaoId: string; aprovado: boolean; motivoRejeicao?: string }) => {
      const res = await fetch(`/api/admin/saques/${transacaoId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovado, motivoRejeicao }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar aprovação')
      return data
    },
    onSuccess: (data) => {
      const acao = data._meta?.acao
      if (acao === 'APROVADO') {
        toast.success('Saque aprovado com sucesso!')
      } else {
        toast.success('Saque rejeitado com sucesso.')
      }
      queryClient.invalidateQueries({ queryKey: ['admin-saques'] })
      setRejeitarDialogOpen(false)
      setRejeitarTransacaoId(null)
      setMotivoRejeicao('')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ── Dialog states ──
  const [abatimentoDialogOpen, setAbatimentoDialogOpen] = useState(false)
  const [selectedConta, setSelectedConta] = useState<ContaAPagar | null>(null)
  const [saqueDialogOpen, setSaqueDialogOpen] = useState(false)
  const [saqueValor, setSaqueValor] = useState('')
  const [rejeitarDialogOpen, setRejeitarDialogOpen] = useState(false)
  const [rejeitarTransacaoId, setRejeitarTransacaoId] = useState<string | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')

  // ── Abatimento handlers ──
  const openAbatimento = (conta: ContaAPagar) => {
    setSelectedConta(conta)
    setAbatimentoDialogOpen(true)
  }

  // ── Saque calculations ──
  const saqueValorNum = parseFloat(saqueValor) || 0
  const saqueIrrfPreview = calcularIRRF(saqueValorNum)
  const saqueInssPreview = calcularINSS(saqueValorNum)
  const saqueLiquidoPreview = saqueValorNum - saqueIrrfPreview - saqueInssPreview

  // ── Wallet cards config ──
  const walletCards = [
    {
      title: 'Saldo Disponível',
      value: carteira?.saldoDisponivel ?? 0,
      icon: Wallet,
      color: 'text-state-success',
      bgColor: 'bg-state-success/10',
    },
    {
      title: 'Saldo Bloqueado',
      value: carteira?.saldoBloqueado ?? 0,
      icon: Lock,
      color: 'text-state-warning',
      bgColor: 'bg-state-warning/10',
    },
    {
      title: 'Saldo Devedor',
      value: carteira?.saldoDevedor ?? 0,
      icon: TrendingDown,
      color: 'text-state-error',
      bgColor: 'bg-state-error/10',
    },
  ]

  // ── Tab value ──
  const [activeTab, setActiveTab] = useState('carteira')

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Carteira digital, contas e transações</p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="carteira">
            <Wallet className="h-4 w-4 mr-1.5" />
            Carteira
          </TabsTrigger>
          <TabsTrigger value="extrato">
            <Receipt className="h-4 w-4 mr-1.5" />
            Extrato
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="aprovacoes">
              <Clock className="h-4 w-4 mr-1.5" />
              Aprovações
            </TabsTrigger>
          )}
        </TabsList>

        {/* ═══════════ CARTEIRA TAB ═══════════ */}
        <TabsContent value="carteira">
          {/* Wallet Owner Info */}
          {carteira?.titular && (
            <Card className="border-border/50 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{carteira.titular.nomeCompleto}</p>
                    {carteira.titular.cpf && (
                      <p className="text-xs text-muted-foreground">CPF: {formatCPF(carteira.titular.cpf)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {walletCards.map((card, i) => {
              const Icon = card.icon
              return (
                <Card key={i} className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bgColor}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      {loadingCarteira ? (
                        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                      ) : (
                        formatCurrency(card.value)
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Saldo Devedor Warning */}
          {!loadingCarteira && carteira && carteira.saldoDevedor > 0 && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30" role="alert">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Saldo devedor pendente
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                    Regularize seu saldo devedor de{' '}
                    <strong>{formatCurrency(carteira.saldoDevedor)}</strong> antes de realizar novos saques.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No wallet message */}
          {!loadingCarteira && !carteira && (
            <Card className="border-border/50 mb-6">
              <CardContent className="p-8 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Nenhuma carteira digital encontrada para seu perfil.</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {carteira && (
            <div className="flex gap-3 mb-6">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setSaqueDialogOpen(true)}
                disabled={carteira.saldoDisponivel <= 0}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" aria-hidden="true" />
                Solicitar Saque
              </Button>
            </div>
          )}

          {/* Contas a Pagar */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Contas a Pagar</CardTitle>
              <Select value={contasStatus} onValueChange={(v) => { setContasStatus(v); setContasPage(1) }}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PARCIALMENTE_PAGO">Parcial</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loadingContas ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !contasData?.data?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta a pagar encontrada</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {contasData.data.map((conta) => (
                      <div
                        key={conta.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/30 text-sm gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-foreground truncate">{conta.descricao}</p>
                            <StatusBadge status={conta.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Valor: {formatCurrency(conta.valor)}</span>
                            <span>Restante: {formatCurrency(conta.valorRestante)}</span>
                            <span>Vencimento: {formatDate(conta.dataVencimento)}</span>
                          </div>
                        </div>
                        {(conta.status === 'PENDENTE' || conta.status === 'PARCIALMENTE_PAGO') && carteira && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => openAbatimento(conta)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Abater
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {contasData.pagination && (
                    <PaginationControls
                      pagination={contasData.pagination}
                      onPageChange={setContasPage}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ EXTRATO TAB ═══════════ */}
        <TabsContent value="extrato">
          {!carteira ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Nenhuma carteira digital encontrada para visualizar o extrato.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-base">Extrato</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={extratoTipo} onValueChange={(v) => { setExtratoTipo(v); setExtratoPage(1) }}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="bonificacao">Bonificações</SelectItem>
                        <SelectItem value="pagamento">Pagamentos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      className="w-[140px] h-8 text-xs"
                      value={extratoDataInicio}
                      onChange={(e) => { setExtratoDataInicio(e.target.value); setExtratoPage(1) }}
                      aria-label="Data início"
                    />
                    <Input
                      type="date"
                      className="w-[140px] h-8 text-xs"
                      value={extratoDataFim}
                      onChange={(e) => { setExtratoDataFim(e.target.value); setExtratoPage(1) }}
                      aria-label="Data fim"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingExtrato ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !extratoData?.data?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação encontrada</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {extratoData.data.map((item) => (
                        <div
                          key={`${item.tipo}-${item.id}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/30 text-sm gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {item.tipo === 'bonificacao' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Bonificação
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                  Pagamento
                                </span>
                              )}
                              <StatusBadge status={item.status} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-semibold ${item.tipo === 'bonificacao' ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                              {item.tipo === 'bonificacao' ? '+' : '-'}{formatCurrency(item.valor)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {extratoData.pagination && (
                      <PaginationControls
                        pagination={extratoData.pagination}
                        onPageChange={setExtratoPage}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════ APROVAÇÕES TAB (Admin Only) ═══════════ */}
        {isAdmin && (
          <TabsContent value="aprovacoes">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Saques Pendentes de Aprovação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSaques ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !saquesData?.data?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum saque pendente de aprovação</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {saquesData.data.map((saque) => (
                        <div
                          key={saque.id}
                          className="p-4 rounded-lg border border-border/50 bg-muted/20"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-foreground text-sm">
                                  {saque.carteira?.titular?.nomeCompleto || 'Desconhecido'}
                                </p>
                                {saque.carteira?.titular?.cpf && (
                                  <span className="text-xs text-muted-foreground">
                                    CPF: {formatCPF(saque.carteira.titular.cpf)}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                                <div>
                                  <span className="block text-[10px] uppercase tracking-wider">Valor Bruto</span>
                                  <span className="font-medium text-foreground">{formatCurrency(saque.valorAbatido)}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-wider">IRRF</span>
                                  <span className="font-medium text-foreground">{formatCurrency(saque.valorIrrfRetido ?? 0)}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-wider">INSS</span>
                                  <span className="font-medium text-foreground">{formatCurrency(saque.valorInssRetido ?? 0)}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-wider">Líquido</span>
                                  <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(saque.valorLiquido ?? 0)}</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1.5">
                                Solicitado em: {formatDate(saque.dataTransacao)}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={aprovarMutation.isPending}
                                onClick={() => aprovarMutation.mutate({ transacaoId: saque.id, aprovado: true })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={aprovarMutation.isPending}
                                onClick={() => {
                                  setRejeitarTransacaoId(saque.id)
                                  setRejeitarDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {saquesData.pagination && (
                      <PaginationControls
                        pagination={saquesData.pagination}
                        onPageChange={setSaquesPage}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ═══════════ ABATIMENTO DIALOG ═══════════ */}
      <Dialog open={abatimentoDialogOpen} onOpenChange={setAbatimentoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abatimento de Parcela</DialogTitle>
            <DialogDescription>
              Utilize o saldo da carteira para abater o valor desta conta.
            </DialogDescription>
          </DialogHeader>

          {selectedConta && carteira && (
            <div className="space-y-4">
              {/* Saldo Devedor Block */}
              {carteira.saldoDevedor > 0 && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Você possui saldo devedor de <strong>{formatCurrency(carteira.saldoDevedor)}</strong>.
                      Regularize antes de realizar abatimentos. (RN-007)
                    </p>
                  </div>
                </div>
              )}

              {/* Conta Details */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descrição</span>
                  <span className="font-medium text-foreground">{selectedConta.descricao}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Total</span>
                  <span className="font-medium text-foreground">{formatCurrency(selectedConta.valor)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Restante</span>
                  <span className="font-medium text-foreground">{formatCurrency(selectedConta.valorRestante)}</span>
                </div>
              </div>

              {/* Calculated abatimento */}
              {(() => {
                const valorAbatido = Math.min(carteira.saldoDisponivel, selectedConta.valorRestante)
                const isPartial = valorAbatido < selectedConta.valorRestante
                return (
                  <div className="space-y-2 p-3 rounded-lg border border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo Disponível</span>
                      <span className="font-medium text-foreground">{formatCurrency(carteira.saldoDisponivel)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor do Abatimento</span>
                      <span className="font-bold text-primary">{formatCurrency(valorAbatido)}</span>
                    </div>
                    {isPartial && (
                      <div className="p-2 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Abatimento parcial — seu saldo disponível não cobre o valor restante da conta.
                          Após o abatimento, restará <strong>{formatCurrency(selectedConta.valorRestante - valorAbatido)}</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAbatimentoDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={
                    abatimentoMutation.isPending ||
                    carteira.saldoDevedor > 0 ||
                    carteira.saldoDisponivel <= 0
                  }
                  onClick={() => {
                    if (selectedConta && carteira) {
                      abatimentoMutation.mutate({
                        carteiraId: carteira.id,
                        contaAPagarId: selectedConta.id,
                      })
                    }
                  }}
                >
                  {abatimentoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Abatimento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ SAQUE DIALOG ═══════════ */}
      <Dialog open={saqueDialogOpen} onOpenChange={setSaqueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Solicite o saque do saldo disponível na sua carteira digital.
            </DialogDescription>
          </DialogHeader>

          {carteira && (
            <div className="space-y-4">
              {/* Saldo Devedor Block */}
              {carteira.saldoDevedor > 0 && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Você possui saldo devedor de <strong>{formatCurrency(carteira.saldoDevedor)}</strong>.
                      Regularize antes de solicitar saques. (RN-007)
                    </p>
                  </div>
                </div>
              )}

              {/* Saldo disponível */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Disponível</span>
                  <span className="font-bold text-foreground">{formatCurrency(carteira.saldoDisponivel)}</span>
                </div>
              </div>

              {/* Valor input */}
              <div className="space-y-2">
                <Label htmlFor="saque-valor">Valor do Saque (mínimo R$ 10,00)</Label>
                <Input
                  id="saque-valor"
                  type="number"
                  step="0.01"
                  min="10"
                  max={carteira.saldoDisponivel}
                  placeholder="0,00"
                  value={saqueValor}
                  onChange={(e) => setSaqueValor(e.target.value)}
                  disabled={carteira.saldoDevedor > 0}
                />
              </div>

              {/* Tax preview */}
              {saqueValorNum >= 10 && (
                <div className="space-y-2 p-3 rounded-lg border border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Prévia de Descontos</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Bruto</span>
                    <span className="font-medium text-foreground">{formatCurrency(saqueValorNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IRRF</span>
                    <span className="font-medium text-foreground">{formatCurrency(saqueIrrfPreview)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">INSS</span>
                    <span className="font-medium text-foreground">{formatCurrency(saqueInssPreview)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="font-semibold text-foreground">Valor Líquido</span>
                    <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(saqueLiquidoPreview)}</span>
                  </div>
                </div>
              )}

              {/* Validation messages */}
              {saqueValorNum > 0 && saqueValorNum < 10 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Valor mínimo para saque é R$ 10,00.</p>
              )}
              {saqueValorNum > carteira.saldoDisponivel && (
                <p className="text-xs text-red-600 dark:text-red-400">Valor excede o saldo disponível.</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setSaqueDialogOpen(false); setSaqueValor('') }}>
                  Cancelar
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={
                    saqueMutation.isPending ||
                    carteira.saldoDevedor > 0 ||
                    saqueValorNum < 10 ||
                    saqueValorNum > carteira.saldoDisponivel
                  }
                  onClick={() => {
                    if (carteira && saqueValorNum >= 10) {
                      saqueMutation.mutate({
                        carteiraId: carteira.id,
                        valor: saqueValorNum,
                      })
                    }
                  }}
                >
                  {saqueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Saque
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ REJEITAR SAQUE DIALOG ═══════════ */}
      <Dialog open={rejeitarDialogOpen} onOpenChange={setRejeitarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Saque</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O valor será estornado para a carteira do revendedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="motivo-rejeicao">Motivo da Rejeição</Label>
              <Textarea
                id="motivo-rejeicao"
                placeholder="Descreva o motivo da rejeição (mínimo 10 caracteres)..."
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                rows={4}
              />
              {motivoRejeicao.length > 0 && motivoRejeicao.trim().length < 10 && (
                <p className="text-xs text-amber-600">Mínimo de 10 caracteres ({motivoRejeicao.trim().length}/10)</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejeitarDialogOpen(false); setMotivoRejeicao('') }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={
                  aprovarMutation.isPending ||
                  motivoRejeicao.trim().length < 10
                }
                onClick={() => {
                  if (rejeitarTransacaoId) {
                    aprovarMutation.mutate({
                      transacaoId: rejeitarTransacaoId,
                      aprovado: false,
                      motivoRejeicao,
                    })
                  }
                }}
              >
                {aprovarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Rejeitar Saque
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// IRRF/INSS calculation helpers (mirrors backend logic)
// ─────────────────────────────────────────────────────────

function calcularIRRF(base: number): number {
  if (base <= 2251.05) return 0
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 168.83)
  if (base <= 3751.05) return Math.max(0, base * 0.15 - 381.44)
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77)
  return Math.max(0, base * 0.275 - 896.00)
}

function calcularINSS(base: number): number {
  const teto = 908.85
  const calculado = base * 0.11
  return Math.min(calculado, teto)
}
