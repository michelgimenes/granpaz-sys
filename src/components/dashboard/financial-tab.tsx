'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Wallet, Lock, TrendingDown, ArrowUpRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/helpers'

export function FinancialTab() {
  const { data: carteira, isLoading: loadingCarteira } = useQuery({
    queryKey: ['carteira'],
    queryFn: async () => {
      const res = await fetch('/api/carteiras')
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      return data[0] || null
    },
  })

  const { data: transacoes = [], isLoading: loadingTransacoes } = useQuery({
    queryKey: ['transacoes-pagamento'],
    queryFn: async () => {
      const res = await fetch('/api/carteiras/transacoes')
      if (!res.ok) return []
      return res.json()
    },
  })

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

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Carteira digital e transações</p>
      </div>

      {/* Wallet Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
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

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <ArrowUpRight className="h-4 w-4 mr-2" aria-hidden="true" />
          Solicitar Saque
        </Button>
      </div>

      {/* Transaction History */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransacoes ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : transacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {transacoes.map((t: {
                id: string
                tipoTransacao: string
                valorAbatido: number
                status: string
                dataTransacao: string
              }) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{t.tipoTransacao}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.dataTransacao)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{formatCurrency(t.valorAbatido)}</p>
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
