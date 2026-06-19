'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, ArrowLeft, Plus, X, Shield, Heart, Users, AlertCircle, Info, Loader2, MapPin, Phone, Mail } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PessoaFisicaForm } from './pessoa-fisica-form'
import { formatCPF, formatCurrency, formatDate } from '@/lib/helpers'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface Plan {
  id: string
  nome: string
  tipo: string
  valorBase: number
  valorTaxaAdesao: number
  valorPorAgregado: number
  maxDependentes: number
  maxAgregados: number
  descricao: string | null
}

interface VinculoData {
  nomeCompleto: string
  tipoVinculo: string
  tipoRegistro: string
  parentesco: string
  dataNascimento: string
  genero: string
  estadoCivil: string
  profissao: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cpf?: string
  agregadoPaiId?: string
  agregadoPaiNome?: string
  coverageTag?: boolean
  inheritAddress?: boolean
}

const PARENTESCO_LABELS: Record<string, string> = {
  CONJUGE: 'Cônjuge',
  FILHO: 'Filho(a)',
  PAI_MAE: 'Pai/Mãe',
  SOGRO: 'Sogro(a)',
  ENTREADO: 'Enteado(a)',
  NETO: 'Neto(a)',
  AVO: 'Avô/Avó',
  IRMAO: 'Irmão(ã)',
  TIO: 'Tio(a)',
}

const VINCULO_LABELS: Record<string, string> = {
  DEPENDENTE: 'Dependente',
  AGREGADO: 'Agregado',
  SUB_DEPENDENTE: 'Sub-dependente',
}

// ─────────────────────────────────────────────────────────
// ComplianceBanner — LGPD + Estipulante disclaimers
// ─────────────────────────────────────────────────────────
function ComplianceBanner() {
  return (
    <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-2">
      <div className="flex items-start gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Atuamos exclusivamente como <strong className="text-foreground">Estipulante</strong> de proteção coletiva.
          A garantia de risco e o pagamento de indenizações são de responsabilidade integral das Seguradoras Parceiras.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          O registro deste plano na SUSEP não implica, por parte da Autarquia, incentivo ou recomendação a sua comercialização.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-state-warning shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Seus dados pessoais são tratados conforme a LGPD e serão utilizados exclusivamente para a contratação e gestão do benefício.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main CheckoutFlow Component
// ─────────────────────────────────────────────────────────
export function CheckoutFlow() {
  const { checkoutStep, setCheckoutStep, selectedPlanId, setSelectedPlanId, setView, checkoutData, setCheckoutData, resetCheckout } = useAppStore()

  // Local state for titular and vinculos
  const [titularData, setTitularData] = useState<Record<string, unknown> | null>(
    checkoutData.titular as Record<string, unknown> | null
  )
  const [vinculos, setVinculos] = useState<VinculoData[]>(
    (checkoutData.vinculos as VinculoData[]) || []
  )
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  // Sheet state for adding vinculos
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addingVinculoType, setAddingVinculoType] = useState<'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE'>('DEPENDENTE')
  const [selectedAgregadoPai, setSelectedAgregadoPai] = useState<string>('')

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)

  // Fetch plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/planos')
      if (!res.ok) throw new Error('Erro ao carregar planos')
      return res.json()
    },
  })

  // Computed counts
  const dependenteCount = useMemo(() => vinculos.filter(v => v.tipoVinculo === 'DEPENDENTE').length, [vinculos])
  const agregadoCount = useMemo(() => vinculos.filter(v => v.tipoVinculo === 'AGREGADO').length, [vinculos])

  // Eligible agregados for sub-dependente (CASADO or UNIAO_ESTAVEL)
  const eligibleAgregadosForSub = useMemo(() => {
    return vinculos.filter(v => v.tipoVinculo === 'AGREGADO' && ['CASADO', 'UNIAO_ESTAVEL'].includes(v.estadoCivil))
  }, [vinculos])

  const steps = [
    { label: 'Plano', number: 0 },
    { label: 'Titular', number: 1 },
    { label: 'Vínculos', number: 2 },
    { label: 'Resumo', number: 3 },
  ]

  // ─── Step handlers ───
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setSelectedPlanId(plan.id)
    // Clear vinculos if switching from FAMILIAR to INDIVIDUAL
    if (plan.tipo === 'INDIVIDUAL' && vinculos.length > 0) {
      setVinculos([])
    }
    setCheckoutStep(1)
  }

  const handleTitularSubmit = (data: Record<string, unknown>) => {
    setTitularData(data)
    setCheckoutData({ titular: data })
    setCheckoutStep(2)
  }

  const handleVinculoSubmit = (data: Record<string, unknown>) => {
    const vincData = data as unknown as VinculoData
    vincData.tipoVinculo = addingVinculoType
    vincData.tipoRegistro = addingVinculoType

    // For SUB_DEPENDENTE, attach the agregado pai info
    if (addingVinculoType === 'SUB_DEPENDENTE' && selectedAgregadoPai) {
      vincData.agregadoPaiId = selectedAgregadoPai
      const paiAgregado = vinculos.find(v => v.nomeCompleto === selectedAgregadoPai)
      vincData.agregadoPaiNome = paiAgregado?.nomeCompleto || ''
    }

    setVinculos(prev => [...prev, vincData])
    setCheckoutData({ vinculos: [...vinculos, vincData] })
    setSheetOpen(false)
    toast.success(`${VINCULO_LABELS[addingVinculoType]} adicionado com sucesso`)
  }

  const handleRemoveVinculo = (index: number) => {
    setVinculos(prev => {
      const next = prev.filter((_, i) => i !== index)
      setCheckoutData({ vinculos: next })
      return next
    })
  }

  const handleFinalSubmit = async () => {
    if (!selectedPlan || !titularData) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planoId: selectedPlan.id,
          titular: titularData,
          vinculos: vinculos.map(v => ({
            nomeCompleto: v.nomeCompleto,
            dataNascimento: v.dataNascimento,
            genero: v.genero,
            estadoCivil: v.estadoCivil,
            tipoVinculo: v.tipoVinculo,
            parentesco: v.parentesco,
            cpf: v.cpf || null,
            profissao: v.profissao || null,
            email: v.email || null,
            telefone: v.telefone || null,
            cep: v.cep || null,
            logradouro: v.logradouro || null,
            numero: v.numero || null,
            complemento: v.complemento || null,
            bairro: v.bairro || null,
            cidade: v.cidade || null,
            estado: v.estado || null,
            agregadoPaiId: v.agregadoPaiId || null,
          })),
        }),
      })

      if (res.status === 409) {
        toast.error('Você já possui uma proposta em análise. Aguarde a aprovação.')
        return
      }

      if (res.status === 400) {
        const data = await res.json()
        toast.error(data.error || 'Dados inválidos. Verifique as informações e tente novamente.')
        return
      }

      if (!res.ok) {
        toast.error('Erro ao criar contratação. Tente novamente.')
        return
      }

      setSubmissionSuccess(true)
      toast.success('Contratação realizada com sucesso!')
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    if (checkoutStep === 0) {
      setView('landing')
    } else {
      setCheckoutStep(checkoutStep - 1)
    }
  }

  const handleRestart = () => {
    resetCheckout()
    setTitularData(null)
    setVinculos([])
    setSelectedPlan(null)
    setSubmissionSuccess(false)
  }

  // ─── Success screen ───
  if (submissionSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-state-success/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-state-success" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Contratação Realizada!</h2>
            <p className="text-muted-foreground text-sm">
              Sua proposta foi enviada com sucesso. Você receberá um e-mail de confirmação e acompanhamento do status de aprovação.
            </p>
            <ComplianceBanner />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setView('landing')} className="flex-1">
                Voltar ao Início
              </Button>
              <Button onClick={handleRestart} className="flex-1 bg-primary text-primary-foreground">
                Nova Contratação
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-16">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Voltar</span>
          </button>
          <h1 className="font-serif text-lg font-bold text-foreground">Contratação</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center gap-2 py-4 overflow-x-auto">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    checkoutStep === step.number
                      ? 'bg-primary text-primary-foreground'
                      : checkoutStep > step.number
                        ? 'bg-state-success/10 text-state-success'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {checkoutStep > step.number ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                      {step.number + 1}
                    </span>
                  )}
                  <span>{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* ─── STEP 0: Plano ─── */}
        {checkoutStep === 0 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Escolha seu Plano</h2>
              <p className="text-muted-foreground text-sm">Selecione o plano ideal para você e sua família</p>
            </div>

            {plansLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {plans.map(plan => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
                      selectedPlanId === plan.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                    onClick={() => {
                      setSelectedPlan(plan)
                      setSelectedPlanId(plan.id)
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Plano ${plan.nome}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedPlan(plan); setSelectedPlanId(plan.id) } }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-serif text-lg">{plan.nome}</CardTitle>
                        {plan.tipo === 'FAMILIAR' ? (
                          <Heart className="h-5 w-5 text-primary" />
                        ) : (
                          <Users className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <CardDescription className="text-xs">{plan.tipo === 'FAMILIAR' ? 'Proteção para toda a família' : 'Proteção individual'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(plan.valorBase)}
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Taxa de adesão: {formatCurrency(plan.valorTaxaAdesao)}
                        </p>
                        {plan.valorPorAgregado > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Por agregado: +{formatCurrency(plan.valorPorAgregado)}/mês
                          </p>
                        )}
                      </div>

                      {plan.descricao && (
                        <p className="text-sm text-muted-foreground">{plan.descricao}</p>
                      )}

                      {/* Plan type info */}
                      {plan.tipo === 'FAMILIAR' ? (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                          <p className="text-xs font-medium text-foreground">Plano Familiar inclui:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            <li>• Até {plan.maxDependentes} dependentes (cônjuge e filhos)</li>
                            <li>• Até {plan.maxAgregados} agregados (outros parentes)</li>
                            <li>• Sub-dependentes de agregados casados</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1">
                          <p className="text-xs font-medium text-foreground">Plano Individual:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            <li>• Proteção apenas para o titular</li>
                            <li>• Não inclui dependentes ou agregados</li>
                          </ul>
                        </div>
                      )}

                      {selectedPlanId === plan.id && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan); }}
                          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          Continuar
                          <Check className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 1: Titular ─── */}
        {checkoutStep === 1 && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Dados do Titular</h2>
              <p className="text-muted-foreground text-sm">Preencha seus dados pessoais</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <PessoaFisicaForm
                  sessionType="TITULAR"
                  onSubmit={handleTitularSubmit}
                  onCancel={() => setCheckoutStep(0)}
                  initialData={titularData || undefined}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── STEP 2: Vínculos ─── */}
        {checkoutStep === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Vínculos</h2>
              <p className="text-muted-foreground text-sm">
                Adicione dependentes e agregados ao seu plano
                {selectedPlan?.tipo && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedPlan.tipo === 'FAMILIAR' ? 'Familiar' : 'Individual'}
                  </Badge>
                )}
              </p>
            </div>

            {/* RN-05: Block dependentes in INDIVIDUAL plan */}
            {selectedPlan?.tipo === 'INDIVIDUAL' && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Plano Individual</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Este plano não permite adicionar dependentes ou agregados.
                  Apenas o titular terá cobertura.
                </p>
              </div>
            )}

            {/* Vinculos list */}
            {vinculos.length > 0 && (
              <div className="space-y-3">
                {vinculos.map((vinc, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm truncate">
                              {vinc.nomeCompleto}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {VINCULO_LABELS[vinc.tipoVinculo] || vinc.tipoVinculo}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {PARENTESCO_LABELS[vinc.parentesco] || vinc.parentesco}
                            </Badge>
                            {vinc.coverageTag && (
                              <Badge className="bg-state-warning/10 text-state-warning border-state-warning/30 text-xs">
                                SEM DIREITO À PROTEÇÃO
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{formatDate(vinc.dataNascimento)}</span>
                            {vinc.cpf && <span className="font-mono">{formatCPF(vinc.cpf)}</span>}
                          </div>
                          {/* Show sub-dependente info */}
                          {vinc.tipoVinculo === 'SUB_DEPENDENTE' && vinc.agregadoPaiNome && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Sub-dependente de: {vinc.agregadoPaiNome}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveVinculo(index)}
                          className="text-muted-foreground hover:text-state-error shrink-0"
                          aria-label={`Remover ${vinc.nomeCompleto}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Add vinculo button — only for FAMILIAR plan */}
            {selectedPlan?.tipo === 'FAMILIAR' && (
              <div className="space-y-4">
                {/* Counts */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Dependentes: {dependenteCount}/{selectedPlan.maxDependentes}</span>
                  <span>Agregados: {agregadoCount}/{selectedPlan.maxAgregados}</span>
                </div>

                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <div className="flex flex-wrap gap-3">
                    {/* Add Dependente */}
                    <Button
                      variant="outline"
                      onClick={() => { setAddingVinculoType('DEPENDENTE'); setSheetOpen(true); }}
                      disabled={dependenteCount >= (selectedPlan.maxDependentes || 8)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Dependente
                      {dependenteCount >= (selectedPlan.maxDependentes || 8) && (
                        <Badge variant="secondary" className="text-xs ml-1">Limite</Badge>
                      )}
                    </Button>

                    {/* Add Agregado */}
                    <Button
                      variant="outline"
                      onClick={() => { setAddingVinculoType('AGREGADO'); setSheetOpen(true); }}
                      disabled={agregadoCount >= (selectedPlan.maxAgregados || 4)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Agregado
                      {agregadoCount >= (selectedPlan.maxAgregados || 4) && (
                        <Badge variant="secondary" className="text-xs ml-1">Limite</Badge>
                      )}
                    </Button>

                    {/* Add Sub-dependente — only if eligible agregados exist */}
                    {eligibleAgregadosForSub.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddingVinculoType('SUB_DEPENDENTE')
                          setSelectedAgregadoPai(eligibleAgregadosForSub[0].nomeCompleto)
                          setSheetOpen(true)
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Sub-dependente
                      </Button>
                    )}
                  </div>

                  <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="font-serif">
                        Adicionar {VINCULO_LABELS[addingVinculoType]}
                      </SheetTitle>
                    </SheetHeader>

                    <div className="px-4 pb-6 space-y-4">
                      {/* Sub-dependente: select parent agregado */}
                      {addingVinculoType === 'SUB_DEPENDENTE' && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Agregado responsável *
                          </label>
                          <select
                            value={selectedAgregadoPai}
                            onChange={(e) => setSelectedAgregadoPai(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {eligibleAgregadosForSub.map(agg => (
                              <option key={agg.nomeCompleto} value={agg.nomeCompleto}>
                                {agg.nomeCompleto} — {PARENTESCO_LABELS[agg.parentesco] || agg.parentesco}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Apenas agregados com estado civil &quot;Casado&quot; ou &quot;União Estável&quot; podem ter sub-dependentes.
                          </p>
                        </div>
                      )}

                      <PessoaFisicaForm
                        sessionType={addingVinculoType}
                        onSubmit={handleVinculoSubmit}
                        onCancel={() => setSheetOpen(false)}
                        agregadoPaiId={addingVinculoType === 'SUB_DEPENDENTE' ? selectedAgregadoPai : undefined}
                        titularData={titularData || undefined}
                        planTipo={selectedPlan?.tipo}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCheckoutStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={() => setCheckoutStep(3)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                Continuar para Resumo
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Resumo ─── */}
        {checkoutStep === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Resumo da Contratação</h2>
              <p className="text-muted-foreground text-sm">Confira os dados antes de finalizar</p>
            </div>

            {/* Plano */}
            {selectedPlan && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Plano Selecionado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{selectedPlan.nome}</span>
                    <Badge variant="secondary">{selectedPlan.tipo === 'FAMILIAR' ? 'Familiar' : 'Individual'}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Valor base: <strong className="text-foreground">{formatCurrency(selectedPlan.valorBase)}/mês</strong></p>
                    <p>Taxa de adesão: <strong className="text-foreground">{formatCurrency(selectedPlan.valorTaxaAdesao)}</strong></p>
                    {selectedPlan.valorPorAgregado > 0 && agregadoCount > 0 && (
                      <p>Agregados ({agregadoCount}x): <strong className="text-foreground">{formatCurrency(selectedPlan.valorPorAgregado * agregadoCount)}/mês</strong></p>
                    )}
                    <div className="border-t border-border/50 pt-2 mt-2">
                      <p className="font-medium text-foreground">
                        Total estimado: {formatCurrency(
                          selectedPlan.valorBase + (selectedPlan.valorPorAgregado * agregadoCount)
                        )}/mês
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Titular */}
            {titularData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Titular
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium text-foreground">{titularData.nomeCompleto as string}</p>
                    </div>
                    {titularData.cpf && (
                      <div>
                        <span className="text-muted-foreground">CPF:</span>
                        <p className="font-medium text-foreground font-mono">{formatCPF(titularData.cpf as string)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Nascimento:</span>
                      <p className="font-medium text-foreground">{formatDate(titularData.dataNascimento as string)}</p>
                    </div>
                    {titularData.genero && (
                      <div>
                        <span className="text-muted-foreground">Gênero:</span>
                        <p className="font-medium text-foreground">{titularData.genero === 'M' ? 'Masculino' : 'Feminino'}</p>
                      </div>
                    )}
                    {titularData.estadoCivil && (
                      <div>
                        <span className="text-muted-foreground">Estado Civil:</span>
                        <p className="font-medium text-foreground">{titularData.estadoCivil as string}</p>
                      </div>
                    )}
                    {titularData.profissao && (
                      <div>
                        <span className="text-muted-foreground">Profissão:</span>
                        <p className="font-medium text-foreground">{titularData.profissao as string}</p>
                      </div>
                    )}
                  </div>
                  {/* Contact & Address */}
                  {(titularData.email || titularData.telefone) && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {titularData.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {titularData.email as string}
                        </span>
                      )}
                      {titularData.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {titularData.telefone as string}
                        </span>
                      )}
                    </div>
                  )}
                  {titularData.logradouro && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>
                        {titularData.logradouro as string}, {titularData.numero as string}
                        {titularData.complemento ? ` - ${titularData.complemento as string}` : ''}
                        {' — '}{titularData.bairro as string}, {titularData.cidade as string}/{titularData.estado as string}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vínculos */}
            {vinculos.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Vínculos ({vinculos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vinculos.map((vinc, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{vinc.nomeCompleto}</span>
                        <Badge variant="secondary" className="text-xs">
                          {VINCULO_LABELS[vinc.tipoVinculo]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {PARENTESCO_LABELS[vinc.parentesco] || vinc.parentesco}
                        </Badge>
                        {vinc.coverageTag && (
                          <Badge className="bg-state-warning/10 text-state-warning border-state-warning/30 text-xs">
                            SEM DIREITO À PROTEÇÃO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(vinc.dataNascimento)}</span>
                        {vinc.genero && <span>{vinc.genero === 'M' ? 'Masculino' : 'Feminino'}</span>}
                        {vinc.estadoCivil && <span>{vinc.estadoCivil}</span>}
                      </div>
                      {vinc.tipoVinculo === 'SUB_DEPENDENTE' && vinc.agregadoPaiNome && (
                        <p className="text-xs text-muted-foreground">
                          Sub-dependente de: {vinc.agregadoPaiNome}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Compliance Banner */}
            <ComplianceBanner />

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setCheckoutStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 flex-1 sm:flex-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Finalizar Contratação
                    <Check className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
