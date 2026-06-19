'use client'

import { useState, useCallback } from 'react'
import { validateCPF, formatCPF, formatPhone, formatCEP } from '@/lib/helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Check, Search, Loader2 } from 'lucide-react'

type SessionType = 'TITULAR' | 'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE'

interface PessoaFisicaFormProps {
  sessionType: SessionType
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
  initialData?: Record<string, unknown>
  agregadoPaiId?: string
  titularData?: Record<string, unknown>
  onCpfFound?: (data: Record<string, unknown>) => void
  planTipo?: string
}

const SESSION_CONFIG: Record<SessionType, {
  showProfissao: boolean
  showAddress: boolean
  showContact: boolean
  showEstadoCivil: boolean
  requiredProfissao: boolean
  parentescoOptions: Array<{ value: string; label: string }>
  label: string
}> = {
  TITULAR: {
    showProfissao: true,
    showAddress: true,
    showContact: true,
    showEstadoCivil: true,
    requiredProfissao: true,
    parentescoOptions: [],
    label: 'Titular',
  },
  DEPENDENTE: {
    showProfissao: false,
    showAddress: false,
    showContact: false,
    showEstadoCivil: false,
    requiredProfissao: false,
    parentescoOptions: [
      { value: 'CONJUGE', label: 'Cônjuge' },
      { value: 'FILHO', label: 'Filho(a)' },
    ],
    label: 'Dependente',
  },
  AGREGADO: {
    showProfissao: true,
    showAddress: true,
    showContact: true,
    showEstadoCivil: true,
    requiredProfissao: true,
    parentescoOptions: [
      { value: 'CONJUGE', label: 'Cônjuge' },
      { value: 'FILHO', label: 'Filho(a)' },
      { value: 'PAI_MAE', label: 'Pai/Mãe' },
      { value: 'SOGRO', label: 'Sogro(a)' },
      { value: 'ENTREADO', label: 'Enteado(a)' },
      { value: 'NETO', label: 'Neto(a)' },
      { value: 'AVO', label: 'Avô/Avó' },
      { value: 'IRMAO', label: 'Irmão(ã)' },
      { value: 'TIO', label: 'Tio(a)' },
    ],
    label: 'Agregado',
  },
  SUB_DEPENDENTE: {
    showProfissao: false,
    showAddress: false,
    showContact: false,
    showEstadoCivil: false,
    requiredProfissao: false,
    parentescoOptions: [
      { value: 'CONJUGE', label: 'Cônjuge' },
      { value: 'FILHO', label: 'Filho(a)' },
    ],
    label: 'Sub-dependente',
  },
}

export function PessoaFisicaForm({
  sessionType,
  onSubmit,
  onCancel,
  initialData,
  agregadoPaiId,
  titularData,
  onCpfFound,
}: PessoaFisicaFormProps) {
  const config = SESSION_CONFIG[sessionType]

  const [form, setForm] = useState({
    nomeCompleto: (initialData?.nomeCompleto as string) || '',
    cpf: (initialData?.cpf as string) || '',
    dataNascimento: (initialData?.dataNascimento as string) || '',
    genero: (initialData?.genero as string) || '',
    estadoCivil: (initialData?.estadoCivil as string) || 'SOLTEIRO',
    profissao: (initialData?.profissao as string) || '',
    email: (initialData?.email as string) || '',
    telefone: (initialData?.telefone as string) || '',
    cep: (initialData?.cep as string) || '',
    logradouro: (initialData?.logradouro as string) || '',
    numero: (initialData?.numero as string) || '',
    complemento: (initialData?.complemento as string) || '',
    bairro: (initialData?.bairro as string) || '',
    cidade: (initialData?.cidade as string) || '',
    estado: (initialData?.estado as string) || '',
    parentesco: (initialData?.parentesco as string) || config.parentescoOptions[0]?.value || '',
    tipoVinculo: sessionType === 'TITULAR' ? '' : sessionType,
    inheritAddress: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'blocked'>('idle')
  const [cpfFoundData, setCpfFoundData] = useState<Record<string, unknown> | null>(null)
  const [showReuseModal, setShowReuseModal] = useState(false)
  const [coverageTag, setCoverageTag] = useState(false)
  const [ageMessage, setAgeMessage] = useState('')
  const [viacepLoading, setViacepLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─── CPF Identification (blur → API) ───
  const handleCpfBlur = useCallback(async () => {
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) return

    if (!validateCPF(cpfDigits)) {
      setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }))
      return
    }

    setCpfStatus('checking')
    setErrors(prev => ({ ...prev, cpf: '' }))

    try {
      const res = await fetch(`/api/pessoas-fisicas/buscar-por-cpf?cpf=${cpfDigits}`)
      if (res.status === 404) {
        setCpfStatus('not_found')
        return
      }

      const data = await res.json()
      if (data.nomeCompleto) {
        setCpfFoundData(data)

        if (form.dataNascimento) {
          const existingBirth = new Date(data.dataNascimento as string).toISOString().split('T')[0]
          const inputBirth = form.dataNascimento

          if (existingBirth !== inputBirth) {
            setCpfStatus('blocked')
            setErrors(prev => ({ ...prev, cpf: 'Este CPF já está cadastrado para outra pessoa' }))
            return
          }
        }

        setCpfStatus('found')
        setShowReuseModal(true)
      }
    } catch {
      setCpfStatus('idle')
    }
  }, [form.cpf, form.dataNascimento])

  // ─── Reuse existing data ───
  const handleReuseData = () => {
    if (cpfFoundData) {
      setForm(prev => ({
        ...prev,
        nomeCompleto: (cpfFoundData.nomeCompleto as string) || prev.nomeCompleto,
        dataNascimento: cpfFoundData.dataNascimento ? new Date(cpfFoundData.dataNascimento as string).toISOString().split('T')[0] : prev.dataNascimento,
        genero: (cpfFoundData.genero as string) || prev.genero,
        estadoCivil: (cpfFoundData.estadoCivil as string) || prev.estadoCivil,
        email: (cpfFoundData.email as string) || prev.email,
        telefone: (cpfFoundData.telefone as string) || prev.telefone,
        cep: (cpfFoundData.cep as string) || prev.cep,
        logradouro: (cpfFoundData.logradouro as string) || prev.logradouro,
        numero: (cpfFoundData.numero as string) || prev.numero,
        complemento: (cpfFoundData.complemento as string) || prev.complemento,
        bairro: (cpfFoundData.bairro as string) || prev.bairro,
        cidade: (cpfFoundData.cidade as string) || prev.cidade,
        estado: (cpfFoundData.estado as string) || prev.estado,
        profissao: (cpfFoundData.profissao as string) || prev.profissao,
      }))
      if (onCpfFound) onCpfFound(cpfFoundData)
    }
    setShowReuseModal(false)
  }

  const handleDontReuse = () => {
    setShowReuseModal(false)
  }

  // ─── ViaCEP auto-fill ───
  const handleCepBlur = useCallback(async () => {
    const cepDigits = form.cep.replace(/\D/g, '')
    if (cepDigits.length !== 8) return

    setViacepLoading(true)
    try {
      const res = await fetch(`/api/viacep?cep=${cepDigits}`)
      if (res.ok) {
        const data = await res.json()
        setForm(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.cidade || prev.cidade,
          estado: data.estado || prev.estado,
          complemento: data.complemento || prev.complemento,
        }))
        setErrors(prev => ({ ...prev, cep: '' }))
      }
    } catch {
      // Network error — don't block
    } finally {
      setViacepLoading(false)
    }
  }, [form.cep])

  // ─── Age validation on dataNascimento change ───
  const handleDataNascimentoChange = useCallback(async (value: string) => {
    setForm(prev => ({ ...prev, dataNascimento: value }))
    setCoverageTag(false)
    setAgeMessage('')

    if (!value) return

    if (['DEPENDENTE', 'SUB_DEPENDENTE'].includes(sessionType) && form.parentesco === 'FILHO') {
      try {
        const birthDate = new Date(value)
        const hoje = new Date()
        const idade = Math.floor((hoje.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

        const configRes = await fetch('/api/configuracoes')
        if (configRes.ok) {
          const configs: Array<{ chave: string; valor: string }> = await configRes.json()
          const coverageKey = sessionType === 'SUB_DEPENDENTE' ? 'IDADE_COBERTURA_SUB_FILHO' : 'IDADE_COBERTURA_FILHO'
          const limitKey = sessionType === 'SUB_DEPENDENTE' ? 'IDADE_LIMITE_SUB_DEPENDENTE' : 'IDADE_LIMITE_DEPENDENTE'

          const coverageAge = parseInt(configs.find(c => c.chave === coverageKey)?.valor || '18', 10)
          const limitAge = parseInt(configs.find(c => c.chave === limitKey)?.valor || '21', 10)

          if (idade > limitAge) {
            setErrors(prev => ({ ...prev, dataNascimento: `Idade ${idade} excede o limite de ${limitAge} anos.` }))
          } else if (idade > coverageAge) {
            setCoverageTag(true)
            setAgeMessage(`SEM DIREITO À PROTEÇÃO: Idade ${idade} excede cobertura (${coverageAge} anos), mas dentro do limite de cadastro (${limitAge} anos).`)
            setErrors(prev => ({ ...prev, dataNascimento: '' }))
          } else {
            setErrors(prev => ({ ...prev, dataNascimento: '' }))
          }
        }
      } catch {
        // Config fetch failed — don't block, backend will validate
      }
    }
  }, [sessionType, form.parentesco])

  // ─── Form validation ───
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.nomeCompleto.trim()) newErrors.nomeCompleto = 'Nome completo é obrigatório'
    if (!form.dataNascimento) newErrors.dataNascimento = 'Data de nascimento é obrigatória'

    if (sessionType === 'TITULAR') {
      const cpfDigits = form.cpf.replace(/\D/g, '')
      if (cpfDigits.length !== 11) {
        newErrors.cpf = 'CPF deve ter 11 dígitos'
      } else if (!validateCPF(cpfDigits)) {
        newErrors.cpf = 'CPF inválido'
      }
      if (cpfStatus === 'blocked') {
        newErrors.cpf = 'Este CPF já está cadastrado para outra pessoa'
      }
    }

    if (sessionType === 'TITULAR' || (sessionType === 'AGREGADO' && form.email)) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      if (!form.email.trim()) {
        newErrors.email = 'E-mail é obrigatório'
      } else if (!emailRegex.test(form.email)) {
        newErrors.email = 'Formato de e-mail inválido'
      }
    }

    if (sessionType === 'TITULAR' || (sessionType === 'AGREGADO' && form.telefone)) {
      const phoneDigits = form.telefone.replace(/\D/g, '')
      if (!form.telefone.trim()) {
        newErrors.telefone = 'Telefone é obrigatório'
      } else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        newErrors.telefone = 'Telefone deve conter DDD + Número'
      }
    }

    if (sessionType === 'TITULAR' && form.cep) {
      const cepDigits = form.cep.replace(/\D/g, '')
      if (cepDigits.length !== 8) newErrors.cep = 'CEP inválido'
    }

    if (config.requiredProfissao && !form.profissao.trim()) {
      newErrors.profissao = 'Profissão é obrigatória'
    }

    if (sessionType !== 'TITULAR' && !form.parentesco) {
      newErrors.parentesco = 'Parentesco é obrigatório'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const output: Record<string, unknown> = {
        ...form,
        tipoRegistro: sessionType,
        cpf: form.cpf ? form.cpf.replace(/\D/g, '') : '',
        telefone: form.telefone ? form.telefone.replace(/\D/g, '') : '',
        cep: form.cep ? form.cep.replace(/\D/g, '') : '',
        coverageTag,
      }

      if (sessionType === 'SUB_DEPENDENTE' && agregadoPaiId) {
        output.agregadoPaiId = agregadoPaiId
      }

      if (sessionType === 'AGREGADO' && form.inheritAddress && titularData) {
        output.cep = titularData.cep || output.cep
        output.logradouro = titularData.logradouro || output.logradouro
        output.numero = titularData.numero || output.numero
        output.complemento = titularData.complemento || output.complemento
        output.bairro = titularData.bairro || output.bairro
        output.cidade = titularData.cidade || output.cidade
        output.estado = titularData.estado || output.estado
        output.email = titularData.email || output.email
        output.telefone = titularData.telefone || output.telefone
      }

      onSubmit(output)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateForm = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const inputClass = (hasError?: string) =>
    `flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${hasError ? 'border-state-error' : 'border-input'}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Reuse Modal */}
      {showReuseModal && cpfFoundData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Cadastro encontrado">
          <Card className="mx-4 max-w-md w-full border-primary/30 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-serif text-lg font-bold text-foreground">Cadastro encontrado</h3>
              <p className="text-sm text-muted-foreground">
                Encontramos um cadastro para este CPF: <strong className="text-foreground">{cpfFoundData.nomeCompleto as string}</strong>
              </p>
              <p className="text-sm text-muted-foreground">Deseja reutilizar os dados existentes?</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleDontReuse} className="flex-1">Não, preencher manualmente</Button>
                <Button type="button" onClick={handleReuseData} className="flex-1 bg-primary text-primary-foreground">Sim, reutilizar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Nome Completo */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Nome Completo *</label>
        <input
          type="text"
          required
          value={form.nomeCompleto}
          onChange={(e) => updateForm('nomeCompleto', e.target.value)}
          className={inputClass(errors.nomeCompleto)}
          aria-required="true"
          aria-invalid={!!errors.nomeCompleto}
          aria-describedby={errors.nomeCompleto ? 'err-nome' : undefined}
          placeholder="Nome completo"
        />
        {errors.nomeCompleto && <p id="err-nome" className="text-xs text-state-error mt-1" role="alert">{errors.nomeCompleto}</p>}
      </div>

      {/* CPF — only for TITULAR and AGREGADO */}
      {(sessionType === 'TITULAR' || sessionType === 'AGREGADO') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            CPF {sessionType === 'TITULAR' ? '*' : ''}
          </label>
          <div className="relative">
            <input
              type="text"
              value={form.cpf}
              onChange={(e) => { updateForm('cpf', formatCPF(e.target.value)); setCpfStatus('idle'); }}
              onBlur={handleCpfBlur}
              required={sessionType === 'TITULAR'}
              className={`${inputClass(errors.cpf)} font-mono pr-10`}
              placeholder="000.000.000-00"
              maxLength={14}
              aria-required={sessionType === 'TITULAR'}
              aria-invalid={!!errors.cpf}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {cpfStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {cpfStatus === 'found' && <Check className="h-4 w-4 text-state-success" />}
              {cpfStatus === 'not_found' && <Search className="h-4 w-4 text-muted-foreground" />}
              {cpfStatus === 'blocked' && <AlertCircle className="h-4 w-4 text-state-error" />}
            </div>
          </div>
          {errors.cpf && <p className="text-xs text-state-error mt-1" role="alert">{errors.cpf}</p>}
          {cpfStatus === 'not_found' && !errors.cpf && <p className="text-xs text-muted-foreground mt-1">CPF não encontrado. Preencha os dados manualmente.</p>}
        </div>
      )}

      {/* Data Nascimento */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Data de Nascimento *</label>
        <input
          type="date"
          required
          value={form.dataNascimento}
          onChange={(e) => handleDataNascimentoChange(e.target.value)}
          className={inputClass(errors.dataNascimento)}
          aria-required="true"
          aria-invalid={!!errors.dataNascimento}
        />
        {errors.dataNascimento && <p className="text-xs text-state-error mt-1" role="alert">{errors.dataNascimento}</p>}
        {/* RN-06: Coverage tag */}
        {coverageTag && (
          <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-state-warning/10 border border-state-warning/30">
            <AlertCircle className="h-4 w-4 text-state-warning flex-shrink-0" />
            <span className="text-xs font-semibold text-state-warning">SEM DIREITO À PROTEÇÃO</span>
          </div>
        )}
        {ageMessage && !coverageTag && <p className="text-xs text-muted-foreground mt-1">{ageMessage}</p>}
      </div>

      {/* Gênero */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Gênero</label>
        <select
          value={form.genero}
          onChange={(e) => updateForm('genero', e.target.value)}
          className={inputClass()}
        >
          <option value="">Selecione</option>
          <option value="M">Masculino</option>
          <option value="F">Feminino</option>
        </select>
      </div>

      {/* Estado Civil — for TITULAR and AGREGADO */}
      {config.showEstadoCivil && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Estado Civil *</label>
          <select
            value={form.estadoCivil}
            onChange={(e) => updateForm('estadoCivil', e.target.value)}
            className={inputClass()}
          >
            <option value="SOLTEIRO">Solteiro(a)</option>
            <option value="CASADO">Casado(a)</option>
            <option value="DIVORCIADO">Divorciado(a)</option>
            <option value="VIUVO">Viúvo(a)</option>
            <option value="UNIAO_ESTAVEL">União Estável</option>
          </select>
        </div>
      )}

      {/* Parentesco — for non-TITULAR */}
      {sessionType !== 'TITULAR' && config.parentescoOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Parentesco *</label>
          <select
            value={form.parentesco}
            onChange={(e) => {
              updateForm('parentesco', e.target.value)
              setCoverageTag(false)
              setAgeMessage('')
            }}
            className={inputClass(errors.parentesco)}
            aria-required="true"
          >
            {config.parentescoOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.parentesco && <p className="text-xs text-state-error mt-1" role="alert">{errors.parentesco}</p>}
        </div>
      )}

      {/* Profissão — for TITULAR and AGREGADO */}
      {config.showProfissao && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Profissão {config.requiredProfissao ? '*' : ''}
          </label>
          <input
            type="text"
            value={form.profissao}
            onChange={(e) => updateForm('profissao', e.target.value)}
            required={config.requiredProfissao}
            className={inputClass(errors.profissao)}
            placeholder="Sua profissão"
          />
          {errors.profissao && <p className="text-xs text-state-error mt-1" role="alert">{errors.profissao}</p>}
        </div>
      )}

      {/* Email — for TITULAR and AGREGADO */}
      {config.showContact && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">E-mail *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateForm('email', e.target.value)}
            required={sessionType === 'TITULAR'}
            className={inputClass(errors.email)}
            placeholder="seu@email.com"
          />
          {errors.email && <p className="text-xs text-state-error mt-1" role="alert">{errors.email}</p>}
        </div>
      )}

      {/* Telefone — for TITULAR and AGREGADO */}
      {config.showContact && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Telefone *</label>
          <input
            type="tel"
            value={form.telefone}
            onChange={(e) => updateForm('telefone', formatPhone(e.target.value))}
            required={sessionType === 'TITULAR'}
            className={inputClass(errors.telefone)}
            placeholder="(00) 00000-0000"
          />
          {errors.telefone && <p className="text-xs text-state-error mt-1" role="alert">{errors.telefone}</p>}
        </div>
      )}

      {/* Address fields — for TITULAR and optionally AGREGADO */}
      {config.showAddress && (
        <>
          {/* For AGREGADO: option to inherit titular's address */}
          {sessionType === 'AGREGADO' && titularData && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inheritAddress"
                checked={form.inheritAddress}
                onChange={(e) => updateForm('inheritAddress', e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="inheritAddress" className="text-sm text-muted-foreground">
                Usar mesmo endereço e contato do titular
              </label>
            </div>
          )}

          {!(sessionType === 'AGREGADO' && form.inheritAddress && titularData) && (
            <>
              {/* CEP with ViaCEP */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CEP *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.cep}
                    onChange={(e) => updateForm('cep', formatCEP(e.target.value))}
                    onBlur={handleCepBlur}
                    required={sessionType === 'TITULAR'}
                    className={`${inputClass(errors.cep)} font-mono pr-10`}
                    placeholder="00000-000"
                  />
                  {viacepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {errors.cep && <p className="text-xs text-state-error mt-1" role="alert">{errors.cep}</p>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Logradouro *</label>
                  <input
                    type="text"
                    value={form.logradouro}
                    onChange={(e) => updateForm('logradouro', e.target.value)}
                    required={sessionType === 'TITULAR'}
                    className={inputClass()}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Número *</label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={(e) => updateForm('numero', e.target.value)}
                    required={sessionType === 'TITULAR'}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                  <input
                    type="text"
                    value={form.complemento}
                    onChange={(e) => updateForm('complemento', e.target.value)}
                    className={inputClass()}
                    placeholder="Apto, Sala..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Bairro *</label>
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => updateForm('bairro', e.target.value)}
                    required={sessionType === 'TITULAR'}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Cidade *</label>
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={(e) => updateForm('cidade', e.target.value)}
                    required={sessionType === 'TITULAR'}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Estado *</label>
                  <input
                    type="text"
                    value={form.estado}
                    onChange={(e) => updateForm('estado', e.target.value.toUpperCase())}
                    required={sessionType === 'TITULAR'}
                    maxLength={2}
                    className={inputClass()}
                    placeholder="UF"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          type="submit"
          disabled={isSubmitting || cpfStatus === 'blocked'}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSubmitting ? 'Processando...' : 'Confirmar'}
        </Button>
      </div>
    </form>
  )
}
