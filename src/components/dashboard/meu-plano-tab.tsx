'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { formatCurrency, formatDate } from '@/lib/helpers'
import {
  Home,
  DollarSign,
  CalendarDays,
  FileText,
  Loader2,
  ShieldCheck,
  FileDown,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

interface Contrato {
  id: string
  status: string
  valorParcelaBase: number
  valorTaxaAdesao: number
  valorTotalAgregados: number
  periodicidade: string
  diaVencimento: number
  createdAt: string
  titular: { id: string; nomeCompleto: string; cpf: string | null }
  plano: { id: string; nome: string; tipo: string }
  seguradora?: { id: string; nome: string; codigoSeguradora: string } | null
  dadosAprovacao?: {
    capitalSeguradoInformado: number | null
    codigoSeguradoraInformado: string | null
    dataAprovacao: string | null
  } | null
}

interface Seguradora {
  id: string
  nome: string
  cnpj: string | null
  codigoSeguradora: string | null
  clausulasMarkdown: string | null
  siteUrl: string | null
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

export function MeuPlanoTab() {
  const { user } = useAppStore()
  const pessoaFisicaId = user?.pessoaFisicaId
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const { data: contratos, isLoading: loadingContratos } = useQuery({
    queryKey: ['meu-plano-contratos', pessoaFisicaId],
    queryFn: async () => {
      if (!pessoaFisicaId) throw new Error('ID não encontrado')
      const res = await fetch(`/api/contratos?titularId=${pessoaFisicaId}`)
      if (!res.ok) throw new Error('Erro ao carregar contrato')
      const json = await res.json()
      return (json.data ?? []) as Contrato[]
    },
    enabled: !!pessoaFisicaId,
  })

  const contrato = contratos?.[0]
  const seguradoraId = contrato?.dadosAprovacao?.codigoSeguradoraInformado ?? contrato?.seguradora?.id

  const { data: seguradora } = useQuery<Seguradora | null>({
    queryKey: ['seguradora-info', seguradoraId],
    queryFn: async () => {
      if (!seguradoraId) return null
      const res = await fetch(`/api/seguradoras/${seguradoraId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!seguradoraId,
  })

  const handleCancelamentoCDC = async () => {
    if (!contrato) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/cancelar-cdc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao cancelar')
      }
      toast.success('Contrato cancelado com sucesso! Direito de arrependimento (CDC Art. 49).')
      setCancelDialogOpen(false)
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar')
    } finally {
      setCancelling(false)
    }
  }

  if (loadingContratos) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contrato) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Nenhum contrato encontrado.
      </div>
    )
  }

  const valorTotalMensal = contrato.valorParcelaBase + (contrato.valorTotalAgregados ?? 0)
  const podeCancelarCDC = ['AGUARDANDO_APROVACAO', 'APROVADO', 'SUSPENSO'].includes(contrato.status)

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Meu Plano</h1>
        <p className="text-muted-foreground mt-1">Detalhes do plano contratado</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Home className="h-4 w-4" />
              Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{contrato.plano.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contrato.plano.tipo === 'FAMILIAR' ? 'Familiar' : 'Individual'}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Valor Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{formatCurrency(valorTotalMensal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contrato.periodicidade === 'ANUAL' ? 'Anual' : 'Mensal'}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">Dia {contrato.diaVencimento}</p>
            <p className="text-xs text-muted-foreground mt-0.5">de cada mês</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusColors[contrato.status] ?? ''}>
              {statusLabels[contrato.status] ?? contrato.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes do Contrato */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Contrato</p>
              <p className="text-sm font-medium text-foreground mt-0.5">#{contrato.id.slice(0, 12)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data de Contratação</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(contrato.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa de Adesão</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(contrato.valorTaxaAdesao)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor Base</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(contrato.valorParcelaBase)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor Agregados</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(contrato.valorTotalAgregados ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor Total Mensal</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(valorTotalMensal)}</p>
            </div>
          </div>

          {contrato.dadosAprovacao?.dataAprovacao && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Dados da Aprovação</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data de Aprovação</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(contrato.dadosAprovacao.dataAprovacao)}</p>
                </div>
                {contrato.dadosAprovacao.capitalSeguradoInformado && (
                  <div>
                    <p className="text-xs text-muted-foreground">Capital Segurado</p>
                    <p className="text-sm font-medium text-foreground">{formatCurrency(contrato.dadosAprovacao.capitalSeguradoInformado)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileDown className="h-5 w-5 text-primary" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Condições Gerais</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {seguradora?.nome ?? 'Seguradora Parceira'}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={seguradora?.siteUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Acessar
                  </a>
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Certificado do Contrato</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nº {contrato.id.slice(0, 12).toUpperCase()}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/contratos/${contrato.id}/certificado`} download>
                    <FileDown className="h-3.5 w-3.5 mr-1.5" />
                    Baixar
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancelamento */}
      {podeCancelarCDC && (
        <Card className="border-border/50 border-state-error/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-state-error">
              <XCircle className="h-5 w-5" />
              Cancelamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Você pode cancelar seu plano a qualquer momento. Se estiver dentro do prazo de 7 dias
              da contratação, o cancelamento segue o direito de arrependimento (CDC Art. 49) com
              estorno integral dos valores pagos.
            </p>
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Plano
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento do plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar seu contrato #{contrato.id.slice(0, 12)}.
              {new Date(contrato.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ? ' Você está dentro do prazo de arrependimento de 7 dias (CDC Art. 49) e terá estorno integral.'
                : ' Você está fora do prazo de arrependimento de 7 dias. Consulte as Condições Gerais para detalhes sobre cancelamento.'}
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Manter Plano</AlertDialogCancel>
            <AlertDialogAction
              className="bg-state-error text-white hover:bg-state-error/90"
              onClick={handleCancelamentoCDC}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sim, cancelar plano
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
