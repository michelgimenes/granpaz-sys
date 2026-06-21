'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckSquare, Users, Wallet, ShieldCheck, CalendarDays, UserCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/helpers'
import { Badge } from '@/components/ui/badge'

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

function ClienteOverview() {
  const { user } = useAppStore()
  const pessoaFisicaId = user?.pessoaFisicaId

  const { data: contratos, isLoading } = useQuery({
    queryKey: ['cliente-overview', pessoaFisicaId],
    queryFn: async () => {
      if (!pessoaFisicaId) throw new Error('ID não encontrado')
      const [contratosRes, carteiraRes] = await Promise.all([
        fetch(`/api/contratos?titularId=${pessoaFisicaId}`),
        fetch(`/api/carteiras?titularId=${pessoaFisicaId}`),
      ])
      const contratosJson = await contratosRes.json()
      const contratosData = (contratosJson.data ?? []) as Array<{
        id: string; status: string; valorParcelaBase: number; valorTotalAgregados: number; diaVencimento: number; plano: { nome: string; tipo: string }
      }>
      const carteirasData = await carteiraRes.json()
      const carteira = Array.isArray(carteirasData) ? carteirasData[0] : carteirasData
      return { contratos: contratosData, carteira }
    },
    enabled: !!pessoaFisicaId,
  })

  const contratoAtivo = contratos?.contratos?.[0]
  const carteira = contratos?.carteira as { saldoDisponivel: number; saldoBloqueado: number; saldoDevedor: number } | undefined
  const vinculosCount = 0 // Will be populated from contrato data

  const cards = [
    {
      title: 'Meu Contrato',
      value: contratoAtivo ? statusLabels[contratoAtivo.status] ?? contratoAtivo.status : '—',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Meu Saldo',
      value: carteira ? formatCurrency(carteira.saldoDisponivel) : '—',
      icon: Wallet,
      color: 'text-state-success',
      bgColor: 'bg-state-success/10',
    },
    {
      title: 'Vencimento',
      value: contratoAtivo ? `Dia ${contratoAtivo.diaVencimento}` : '—',
      icon: CalendarDays,
      color: 'text-brand-accent',
      bgColor: 'bg-brand-accent/10',
    },
    {
      title: 'Plano',
      value: contratoAtivo?.plano?.nome ?? '—',
      icon: ShieldCheck,
      color: 'text-state-warning',
      bgColor: 'bg-state-warning/10',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Card key={i} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {contratoAtivo && (
        <Card className="border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-primary" />
              Detalhes do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                <Badge className={`mt-1 ${statusColors[contratoAtivo.status] ?? ''}`}>
                  {statusLabels[contratoAtivo.status] ?? contratoAtivo.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor Mensal</p>
                <p className="text-sm font-bold text-foreground mt-1">{formatCurrency(contratoAtivo.valorParcelaBase + (contratoAtivo.valorTotalAgregados ?? 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Plano</p>
                <p className="text-sm font-medium text-foreground mt-1">{contratoAtivo.plano.nome} ({contratoAtivo.plano.tipo === 'FAMILIAR' ? 'Familiar' : 'Individual'})</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vencimento</p>
                <p className="text-sm font-medium text-foreground mt-1">Dia {contratoAtivo.diaVencimento} de cada mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function AdminOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [contratosRes, approvalRes] = await Promise.all([
        fetch('/api/contratos'),
        fetch('/api/contratos?status=AGUARDANDO_APROVACAO'),
      ])
      const contratos = await contratosRes.json()
      const approval = await approvalRes.json()
      return {
        totalContracts: contratos.length || 0,
        pendingApprovals: approval.length || 0,
        activeContracts: contratos.filter((c: { status: string }) => c.status === 'APROVADO').length || 0,
        revenue: contratos
          .filter((c: { status: string }) => c.status === 'APROVADO')
          .reduce((sum: number, c: { valorParcelaBase: number }) => sum + (c.valorParcelaBase || 0), 0),
      }
    },
  })

  const cards = [
    {
      title: 'Total de Contratos',
      value: stats?.totalContracts ?? '—',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Aguardando Aprovação',
      value: stats?.pendingApprovals ?? '—',
      icon: CheckSquare,
      color: 'text-state-warning',
      bgColor: 'bg-state-warning/10',
    },
    {
      title: 'Contratos Ativos',
      value: stats?.activeContracts ?? '—',
      icon: Users,
      color: 'text-state-success',
      bgColor: 'bg-state-success/10',
    },
    {
      title: 'Receita Estimada',
      value: stats ? `R$ ${stats.revenue.toFixed(2).replace('.', ',')}` : '—',
      icon: Wallet,
      color: 'text-brand-accent',
      bgColor: 'bg-brand-accent/10',
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? (
                  <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function OverviewTab() {
  const { user, activeProfile } = useAppStore()
  const profile = activeProfile ?? user?.role
  const isCliente = profile === 'CLIENTE'

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">
          {isCliente ? 'Bem-vindo ao seu painel' : 'Resumo da plataforma Granpaz'}
        </p>
      </div>
      {isCliente ? <ClienteOverview /> : <AdminOverview />}
    </div>
  )
}
