'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckSquare, Users, Wallet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export function OverviewTab() {
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
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">Resumo da plataforma Granpaz</p>
      </div>

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
    </div>
  )
}
