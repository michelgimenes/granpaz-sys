'use client'

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { validateCPF, formatCPF, formatPhone, calculateAge } from '@/lib/helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Check, Search, Loader2 } from 'lucide-react'

type SessionType = 'TITULAR' | 'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE'

interface DadosPessoaisFormProps {
  sessionType: SessionType
  onSubmit?: (data: Record<string, unknown>) => void
  onCancel?: () => void
  initialData?: Record<string, unknown>
  onCpfFound?: (data: Record<string, unknown>) => void
  existingCpfs?: string[]
  mode?: 'create' | 'edit'
}

export interface DadosPessoaisFormHandle {
  getData: () => Record<string, unknown>
  validate: () => boolean
}

const SESSION_CONFIG: Record<SessionType, {
  showProfissao: boolean
  showContact: boolean
  showEstadoCivil: boolean
  requiredProfissao: boolean
  parentescoOptions: Array<{ value: string; label: string }>
}> = {
  TITULAR: {
    showProfissao: true,
    showContact: true,
    showEstadoCivil: true,
    requiredProfissao: true,
    parentescoOptions: [],
  },
  DEPENDENTE: {
    showProfissao: false,
    showContact: false,
    showEstadoCivil: false,
    requiredProfissao: false,
    parentescoOptions: [
      { value: 'CONJUGE', label: 'Cônjuge' },
      { value: 'FILHO', label: 'Filho(a)' },
    ],
  },
  AGREGADO: {
    showProfissao: true,
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
  },
  SUB_DEPENDENTE: {
    showProfissao: false,
    showContact: false,
    showEstadoCivil: false,
    requiredProfissao: false,
    parentescoOptions: [
      { value: 'CONJUGE', label: 'Cônjuge' },
      { value: 'FILHO', label: 'Filho(a)' },
    ],
  },
}

export const DadosPessoaisForm = forwardRef<DadosPessoaisFormHandle, DadosPessoaisFormProps>(function DadosPessoaisForm({
  sessionType,
  onSubmit,
  onCancel,
  initialData,
  onCpfFound,
  existingCpfs,
  mode = 'create',
}, ref) {
  const config = SESSION_CONFIG[sessionType]
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    nomeCompleto: (initialData?.nomeCompleto as string) || '',
    cpf: (initialData?.cpf as string) || '',
    dataNascimento: (initialData?.dataNascimento as string) || '',
    genero: (initialData?.genero as string) || '',
    estadoCivil: (initialData?.estadoCivil as string) || 'SOLTEIRO',
    profissao: (initialData?.profissao as string) || '',
    email: (initialData?.email as string) || '',
    telefone: (initialData?.telefone as string) || '',
    parentesco: (initialData?.parentesco as string) || config.parentescoOptions[0]?.value || '',
    tipoVinculo: sessionType === 'TITULAR' ? '' : sessionType,
  })

  const initialBirthRef = useRef(initialData?.dataNascimento as string || '')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'blocked'>('idle')
  const [cpfFoundData, setCpfFoundData] = useState<Record<string, unknown> | null>(null)
  const [showReuseModal, setShowReuseModal] = useState(false)
  const [idade, setIdade] = useState<number | null>(null)
  const [coverageTag, setCoverageTag] = useState(false)
  const [ageMessage, setAgeMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─── CPF Identification (blur → API) ───
  const handleCpfBlur = useCallback(async () => {
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) return

    if (!validateCPF(cpfDigits)) {
      setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }))
      return
    }

    if (existingCpfs?.includes(cpfDigits)) {
      setCpfStatus('blocked')
      setErrors(prev => ({ ...prev, cpf: 'Este CPF já foi cadastrado para outro dependente/agregado nesta contratação' }))
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
        profissao: (cpfFoundData.profissao as string) || prev.profissao,
      }))
      if (onCpfFound) onCpfFound(cpfFoundData)
    }
    setShowReuseModal(false)
  }

  const handleDontReuse = () => {
    setShowReuseModal(false)
  }

  // ─── Age validation on dataNascimento change ───
  const handleDataNascimentoChange = useCallback(async (value: string) => {
    setForm(prev => ({ ...prev, dataNascimento: value }))
    setCoverageTag(false)
    setAgeMessage('')

    if (!value) {
      setIdade(null)
      return
    }

    const calculatedAge = calculateAge(value)
    setIdade(calculatedAge)

    // RN-02: In edit mode, validate age only if dataNascimento changed from initial
    if (isEdit && value === initialBirthRef.current) {
      setErrors(prev => ({ ...prev, dataNascimento: '' }))
      return
    }

    if (['DEPENDENTE', 'SUB_DEPENDENTE'].includes(sessionType) && form.parentesco === 'FILHO') {
      try {
        const configRes = await fetch('/api/configuracoes')
        if (configRes.ok) {
          const configs: Array<{ chave: string; valor: string }> = await configRes.json()
          const coverageKey = sessionType === 'SUB_DEPENDENTE' ? 'IDADE_COBERTURA_SUB_FILHO' : 'IDADE_COBERTURA_FILHO'
          const limitKey = sessionType === 'SUB_DEPENDENTE' ? 'IDADE_LIMITE_SUB_DEPENDENTE' : 'IDADE_LIMITE_DEPENDENTE'

          const coverageAge = parseInt(configs.find(c => c.chave === coverageKey)?.valor || '18', 10)
          const limitAge = parseInt(configs.find(c => c.chave === limitKey)?.valor || '21', 10)

          if (calculatedAge > limitAge) {
            setErrors(prev => ({ ...prev, dataNascimento: `Idade ${calculatedAge} excede o limite de ${limitAge} anos.` }))
          } else if (calculatedAge > coverageAge) {
            setCoverageTag(true)
            setAgeMessage(`SEM DIREITO À PROTEÇÃO: Idade ${calculatedAge} excede cobertura (${coverageAge} anos), mas dentro do limite de cadastro (${limitAge} anos).`)
            setErrors(prev => ({ ...prev, dataNascimento: '' }))
          } else {
            setErrors(prev => ({ ...prev, dataNascimento: '' }))
          }
        }
      } catch {
        // Config fetch failed — don't block, backend will validate
      }
    }
  }, [sessionType, form.parentesco, isEdit])

  // ─── Form validation ───
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.nomeCompleto.trim()) newErrors.nomeCompleto = 'Nome completo é obrigatório'
    if (!form.dataNascimento) newErrors.dataNascimento = 'Data de nascimento é obrigatória'

    if (!isEdit) {
      const cpfDigits = form.cpf.replace(/\D/g, '')
      if (cpfDigits.length === 0) {
        newErrors.cpf = 'CPF é obrigatório'
      } else if (cpfDigits.length !== 11) {
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

    if (config.requiredProfissao && !form.profissao.trim()) {
      newErrors.profissao = 'Profissão é obrigatória'
    }

    if (sessionType !== 'TITULAR' && !form.parentesco) {
      newErrors.parentesco = 'Parentesco é obrigatório'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ─── Expose data via ref ───
  const getData = (): Record<string, unknown> => {
    return {
      ...form,
      tipoRegistro: sessionType,
      cpf: form.cpf ? form.cpf.replace(/\D/g, '') : '',
      telefone: form.telefone ? form.telefone.replace(/\D/g, '') : '',
      coverageTag,
    }
  }

  useImperativeHandle(ref, () => ({ getData, validate }), [form, errors, cpfStatus, coverageTag, sessionType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      onSubmit?.(getData())
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateForm = (field: string, value: string) => {
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

  const standalone = !!onSubmit

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
        {errors.nomeCompleto && <p id="err-nome" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.nomeCompleto}</p>}
      </div>

      {/* CPF */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">CPF *</label>
        <div className="relative">
          <input
            type="text"
            value={form.cpf}
            onChange={(e) => { updateForm('cpf', formatCPF(e.target.value)); setCpfStatus('idle'); }}
            onBlur={isEdit ? undefined : handleCpfBlur}
            disabled={isEdit}
            required
            className={`${inputClass(errors.cpf)} font-mono pr-10 ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            placeholder="000.000.000-00"
            maxLength={14}
            aria-required="true"
            aria-invalid={!!errors.cpf}
            aria-describedby={errors.cpf ? 'cpf-error' : undefined}
          />
          {!isEdit && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {cpfStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {cpfStatus === 'found' && <Check className="h-4 w-4 text-state-success" />}
            {cpfStatus === 'not_found' && <Search className="h-4 w-4 text-muted-foreground" />}
            {cpfStatus === 'blocked' && <AlertCircle className="h-4 w-4 text-state-error" />}
          </div>
          )}
        </div>
        {errors.cpf && <p id="cpf-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.cpf}</p>}
        {cpfStatus === 'not_found' && !errors.cpf && <p className="text-xs text-muted-foreground mt-1">CPF não encontrado. Preencha os dados manualmente.</p>}
      </div>

      {/* Data Nascimento + Idade */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Data de Nascimento *</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            required
            value={form.dataNascimento}
            onChange={(e) => handleDataNascimentoChange(e.target.value)}
            className={inputClass(errors.dataNascimento)}
            aria-required="true"
            aria-invalid={!!errors.dataNascimento}
            aria-describedby={errors.dataNascimento ? 'dataNascimento-error' : undefined}
          />
          <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {idade !== null ? `${idade} anos` : '—'}
          </div>
        </div>
        {errors.dataNascimento && <p id="dataNascimento-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.dataNascimento}</p>}
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

      {/* Estado Civil */}
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

      {/* Parentesco */}
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
            aria-invalid={!!errors.parentesco}
            aria-describedby={errors.parentesco ? 'parentesco-error' : undefined}
          >
            {config.parentescoOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.parentesco && <p id="parentesco-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.parentesco}</p>}
        </div>
      )}

      {/* Profissão */}
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
            aria-invalid={!!errors.profissao}
            aria-describedby={errors.profissao ? 'profissao-error' : undefined}
          />
          {errors.profissao && <p id="profissao-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.profissao}</p>}
        </div>
      )}

      {/* Email */}
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
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && <p id="email-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.email}</p>}
        </div>
      )}

      {/* Telefone */}
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
            aria-invalid={!!errors.telefone}
            aria-describedby={errors.telefone ? 'telefone-error' : undefined}
          />
          {errors.telefone && <p id="telefone-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.telefone}</p>}
        </div>
      )}

      {/* Action buttons — only in standalone mode */}
      {standalone && (
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            type="submit"
            disabled={isSubmitting || (!isEdit && cpfStatus === 'blocked')}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? 'Processando...' : isEdit ? 'Salvar' : 'Confirmar'}
          </Button>
        </div>
      )}
    </form>
  )
})
