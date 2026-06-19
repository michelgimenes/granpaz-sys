'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

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

export function CheckoutFlow() {
  const { checkoutStep, setCheckoutStep, selectedPlanId, setSelectedPlanId, setView } = useAppStore()

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/planos')
      if (!res.ok) throw new Error('Erro ao carregar planos')
      return res.json()
    },
  })

  const steps = [
    { label: 'Plano', number: 0 },
    { label: 'Titular', number: 1 },
    { label: 'Vínculos', number: 2 },
    { label: 'Resumo', number: 3 },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-16">
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-md px-2 py-1"
            aria-label="Voltar para página inicial"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <h1 className="font-serif text-lg font-bold text-foreground">Contratar Granpaz</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Stepper */}
        <nav className="mb-10" aria-label="Progresso do checkout">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      checkoutStep > step.number
                        ? 'bg-primary text-primary-foreground'
                        : checkoutStep === step.number
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    aria-current={checkoutStep === step.number ? 'step' : undefined}
                  >
                    {checkoutStep > step.number ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      step.number + 1
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium hidden sm:block ${
                    checkoutStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-16 rounded ${
                    checkoutStep > step.number ? 'bg-primary' : 'bg-muted'
                  }`} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Step Content */}
        {checkoutStep === 0 && (
          <StepPlan
            plans={plans}
            isLoading={isLoading}
            selectedPlanId={selectedPlanId}
            setSelectedPlanId={setSelectedPlanId}
            onNext={() => setCheckoutStep(1)}
          />
        )}
        {checkoutStep === 1 && <StepTitular />}
        {checkoutStep === 2 && <StepVinculos />}
        {checkoutStep === 3 && <StepResumo />}
      </div>
    </div>
  )
}

/* ─── Step 0: Plan Selection ─── */
function StepPlan({
  plans,
  isLoading,
  selectedPlanId,
  setSelectedPlanId,
  onNext,
}: {
  plans: Plan[]
  isLoading: boolean
  selectedPlanId: string | null
  setSelectedPlanId: (id: string | null) => void
  onNext: () => void
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" role="status">
          <span className="sr-only">Carregando planos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
          Escolha seu plano
        </h2>
        <p className="mt-2 text-muted-foreground">
          Selecione o plano ideal para proteger sua família
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedPlanId === plan.id
                ? 'border-primary border-2 shadow-md'
                : 'border-border/50 hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlanId(plan.id)}
            role="radio"
            aria-checked={selectedPlanId === plan.id}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelectedPlanId(plan.id)
              }
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-lg">{plan.nome}</CardTitle>
                {selectedPlanId === plan.id && (
                  <Badge className="bg-primary text-primary-foreground text-xs">Selecionado</Badge>
                )}
              </div>
              <CardDescription>{plan.descricao}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-primary">
                  R$ {plan.valorBase.toFixed(2).replace('.', ',')}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Taxa de adesão: R$ {plan.valorTaxaAdesao.toFixed(2).replace('.', ',')}
                </div>
                {plan.tipo === 'FAMILIAR' && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Até {plan.maxDependentes} dependentes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Até {plan.maxAgregados} agregados (R$ {plan.valorPorAgregado.toFixed(2).replace('.', ',')}/cada)
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={onNext}
          disabled={!selectedPlanId}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}

/* ─── Step 1: Titular Registration ─── */
function StepTitular() {
  const { setCheckoutStep } = useAppStore()
  const [form, setForm] = useState({
    nomeCompleto: '',
    cpf: '',
    dataNascimento: '',
    genero: '',
    estadoCivil: 'SOLTEIRO',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    profissao: '',
  })
  const [cpfError, setCpfError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCpfChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    let formatted = ''
    if (digits.length <= 3) formatted = digits
    else if (digits.length <= 6) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`
    else if (digits.length <= 9) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    else formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    setForm(f => ({ ...f, cpf: formatted }))
    setCpfError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      setCpfError('CPF deve ter 11 dígitos')
      return
    }
    if (/^(\d)\1{10}$/.test(cpfDigits)) {
      setCpfError('CPF inválido')
      return
    }
    setIsSubmitting(true)
    try {
      sessionStorage.setItem('granpaz_titular', JSON.stringify(form))
      setCheckoutStep(2)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
          Dados do Titular
        </h2>
        <p className="mt-2 text-muted-foreground">Preencha seus dados pessoais</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border/50">
          <CardContent className="pt-6 space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-foreground mb-1">Nome Completo *</label>
              <input id="nome" type="text" required value={form.nomeCompleto}
                onChange={(e) => setForm(f => ({ ...f, nomeCompleto: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Seu nome completo" />
            </div>
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-foreground mb-1">CPF *</label>
              <input id="cpf" type="text" required value={form.cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono ${cpfError ? 'border-state-error' : 'border-input'}`}
                placeholder="000.000.000-00" maxLength={14} />
              {cpfError && <p className="text-xs text-state-error mt-1">{cpfError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="nascimento" className="block text-sm font-medium text-foreground mb-1">Data de Nascimento *</label>
                <input id="nascimento" type="date" required value={form.dataNascimento}
                  onChange={(e) => setForm(f => ({ ...f, dataNascimento: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label htmlFor="genero" className="block text-sm font-medium text-foreground mb-1">Gênero</label>
                <select id="genero" value={form.genero}
                  onChange={(e) => setForm(f => ({ ...f, genero: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="estadoCivil" className="block text-sm font-medium text-foreground mb-1">Estado Civil *</label>
                <select id="estadoCivil" required value={form.estadoCivil}
                  onChange={(e) => setForm(f => ({ ...f, estadoCivil: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="SOLTEIRO">Solteiro(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="VIUVO">Viúvo(a)</option>
                  <option value="UNIAO_ESTAVEL">União Estável</option>
                </select>
              </div>
              <div>
                <label htmlFor="profissao" className="block text-sm font-medium text-foreground mb-1">Profissão</label>
                <input id="profissao" type="text" value={form.profissao}
                  onChange={(e) => setForm(f => ({ ...f, profissao: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Sua profissão" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">E-mail *</label>
                <input id="email" type="email" required value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="seu@email.com" />
              </div>
              <div>
                <label htmlFor="telefone" className="block text-sm font-medium text-foreground mb-1">Telefone *</label>
                <input id="telefone" type="tel" required value={form.telefone}
                  onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="cep" className="block text-sm font-medium text-foreground mb-1">CEP *</label>
                <input id="cep" type="text" required value={form.cep}
                  onChange={(e) => setForm(f => ({ ...f, cep: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                  placeholder="00000-000" />
              </div>
              <div className="col-span-2">
                <label htmlFor="logradouro" className="block text-sm font-medium text-foreground mb-1">Logradouro *</label>
                <input id="logradouro" type="text" required value={form.logradouro}
                  onChange={(e) => setForm(f => ({ ...f, logradouro: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Rua, Avenida..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="numero" className="block text-sm font-medium text-foreground mb-1">Número *</label>
                <input id="numero" type="text" required value={form.numero}
                  onChange={(e) => setForm(f => ({ ...f, numero: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label htmlFor="complemento" className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                <input id="complemento" type="text" value={form.complemento}
                  onChange={(e) => setForm(f => ({ ...f, complemento: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Apto, Sala..." />
              </div>
              <div>
                <label htmlFor="bairro" className="block text-sm font-medium text-foreground mb-1">Bairro *</label>
                <input id="bairro" type="text" required value={form.bairro}
                  onChange={(e) => setForm(f => ({ ...f, bairro: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cidade" className="block text-sm font-medium text-foreground mb-1">Cidade *</label>
                <input id="cidade" type="text" required value={form.cidade}
                  onChange={(e) => setForm(f => ({ ...f, cidade: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label htmlFor="estado" className="block text-sm font-medium text-foreground mb-1">Estado *</label>
                <input id="estado" type="text" required maxLength={2} value={form.estado}
                  onChange={(e) => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="UF" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          Seus dados são protegidos conforme a LGPD. O Granpaz atua como Estipulante de seguros coletivos.
        </div>
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setCheckoutStep(0)}>Voltar</Button>
          <Button type="submit" disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">
            {isSubmitting ? 'Processando...' : 'Continuar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/* ─── Step 2: Vínculos ─── */
function StepVinculos() {
  const { setCheckoutStep } = useAppStore()
  const [vinculos, setVinculos] = useState<Array<{
    nomeCompleto: string
    tipoVinculo: string
    parentesco: string
    dataNascimento: string
    genero: string
  }>>([])
  const [showForm, setShowForm] = useState(false)
  const [newVinc, setNewVinc] = useState({
    nomeCompleto: '',
    tipoVinculo: 'DEPENDENTE',
    parentesco: 'FILHO',
    dataNascimento: '',
    genero: '',
  })

  const addVinculo = () => {
    if (!newVinc.nomeCompleto || !newVinc.dataNascimento) return
    setVinculos([...vinculos, newVinc])
    setNewVinc({ nomeCompleto: '', tipoVinculo: 'DEPENDENTE', parentesco: 'FILHO', dataNascimento: '', genero: '' })
    setShowForm(false)
  }

  const removeVinculo = (index: number) => {
    setVinculos(vinculos.filter((_, i) => i !== index))
  }

  const handleNext = () => {
    sessionStorage.setItem('granpaz_vinculos', JSON.stringify(vinculos))
    setCheckoutStep(3)
  }

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Vínculos Familiares</h2>
        <p className="mt-2 text-muted-foreground">Adicione dependentes e agregados ao seu plano</p>
      </div>

      {vinculos.length > 0 && (
        <div className="space-y-3 mb-6">
          {vinculos.map((v, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card">
              <div>
                <p className="font-medium text-foreground text-sm">{v.nomeCompleto}</p>
                <p className="text-xs text-muted-foreground">
                  {v.tipoVinculo === 'DEPENDENTE' ? 'Dependente' : 'Agregado'} • {v.parentesco}
                </p>
              </div>
              <button onClick={() => removeVinculo(i)} className="text-xs text-state-error hover:underline" aria-label={`Remover ${v.nomeCompleto}`}>
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <Card className="border-border/50 mb-6">
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome Completo *</label>
              <input type="text" required value={newVinc.nomeCompleto}
                onChange={(e) => setNewVinc(v => ({ ...v, nomeCompleto: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tipo de Vínculo *</label>
                <select value={newVinc.tipoVinculo} onChange={(e) => setNewVinc(v => ({ ...v, tipoVinculo: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="DEPENDENTE">Dependente</option>
                  <option value="AGREGADO">Agregado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Parentesco *</label>
                <select value={newVinc.parentesco} onChange={(e) => setNewVinc(v => ({ ...v, parentesco: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="CONJUGE">Cônjuge</option>
                  <option value="FILHO">Filho(a)</option>
                  <option value="PAI_MAE">Pai/Mãe</option>
                  <option value="SOGRO">Sogro(a)</option>
                  <option value="ENTREADO">Enteado(a)</option>
                  <option value="NETO">Neto(a)</option>
                  <option value="AVO">Avô/Avó</option>
                  <option value="IRMAO">Irmão(ã)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data de Nascimento *</label>
                <input type="date" required value={newVinc.dataNascimento}
                  onChange={(e) => setNewVinc(v => ({ ...v, dataNascimento: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Gênero</label>
                <select value={newVinc.genero} onChange={(e) => setNewVinc(v => ({ ...v, genero: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} type="button">Cancelar</Button>
              <Button onClick={addVinculo} className="bg-primary text-primary-foreground" type="button">Adicionar</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          + Adicionar Dependente ou Agregado
        </button>
      )}

      {vinculos.length === 0 && !showForm && (
        <p className="text-center text-sm text-muted-foreground mb-6">
          Você pode adicionar dependentes e agregados depois, se desejar.
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCheckoutStep(1)}>Voltar</Button>
        <Button onClick={handleNext} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">Continuar</Button>
      </div>
    </div>
  )
}

/* ─── Step 3: Resumo ─── */
function StepResumo() {
  const { setCheckoutStep, setView, selectedPlanId } = useAppStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const titular = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('granpaz_titular') || '{}')
    : {}
  const vinculos = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('granpaz_vinculos') || '[]')
    : []

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoId: selectedPlanId, titular, vinculos }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao criar contrato')
        return
      }
      sessionStorage.removeItem('granpaz_titular')
      sessionStorage.removeItem('granpaz_vinculos')
      setView('landing')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Resumo do Pedido</h2>
        <p className="mt-2 text-muted-foreground">Revise seus dados antes de finalizar</p>
      </div>

      {/* NO seguradora_id or capital_segurado in DOM (Air-Gap compliance) */}
      <Card className="border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="text-base">Dados do Titular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium text-foreground">{titular.nomeCompleto || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CPF:</span>
            <span className="font-mono font-medium text-foreground">{titular.cpf || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail:</span>
            <span className="font-medium text-foreground">{titular.email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Telefone:</span>
            <span className="font-medium text-foreground">{titular.telefone || '—'}</span>
          </div>
        </CardContent>
      </Card>

      {vinculos.length > 0 && (
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-base">Vínculos ({vinculos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {vinculos.map((v: { nomeCompleto: string; tipoVinculo: string; parentesco: string }, i: number) => (
              <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="font-medium text-foreground">{v.nomeCompleto}</span>
                <span className="text-xs text-muted-foreground">
                  {v.tipoVinculo === 'DEPENDENTE' ? 'Dependente' : 'Agregado'} • {v.parentesco}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground mb-6 space-y-1">
        <p>O Plano Granpaz é um produto da Saúde &amp; Proteção Administração de Benefícios.</p>
        <p>A garantia de risco e o pagamento de indenizações são de responsabilidade integral das Seguradoras Parceiras.</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-state-error/10 text-state-error text-sm mb-4">{error}</div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCheckoutStep(2)}>Voltar</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">
          {isSubmitting ? 'Enviando...' : 'Finalizar Contratação'}
        </Button>
      </div>
    </div>
  )
}
