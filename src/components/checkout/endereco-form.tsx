'use client'

import { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react'
import { formatCEP } from '@/lib/helpers'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface EnderecoFormProps {
  onSubmit?: (data: Record<string, unknown>) => void
  onCancel?: () => void
  initialData?: Record<string, unknown>
  titularData?: Record<string, unknown>
  showInheritOption?: boolean
  mode?: 'create' | 'edit'
}

export interface EnderecoFormHandle {
  getData: () => Record<string, unknown>
  validate: () => boolean
}

function addressesMatch(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return (
    a.cep === b.cep &&
    a.logradouro === b.logradouro &&
    a.numero === b.numero &&
    a.complemento === b.complemento &&
    a.bairro === b.bairro &&
    a.cidade === b.cidade &&
    a.estado === b.estado
  )
}

export const EnderecoForm = forwardRef<EnderecoFormHandle, EnderecoFormProps>(function EnderecoForm({
  onSubmit,
  onCancel,
  initialData,
  titularData,
  showInheritOption,
  mode = 'create',
}, ref) {
  const isEdit = mode === 'edit'

  // Determine default inheritAddress:
  // - On create: default true
  // - On edit: true if address matches titular, false otherwise
  const defaultInherit = showInheritOption && titularData
    ? (!isEdit || !initialData || (titularData && addressesMatch(initialData, titularData)))
    : false

  const [inheritAddress, setInheritAddress] = useState(defaultInherit)
  const [form, setForm] = useState({
    cep: (initialData?.cep as string) || '',
    logradouro: (initialData?.logradouro as string) || '',
    numero: (initialData?.numero as string) || '',
    complemento: (initialData?.complemento as string) || '',
    bairro: (initialData?.bairro as string) || '',
    cidade: (initialData?.cidade as string) || '',
    estado: (initialData?.estado as string) || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [viacepLoading, setViacepLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync inheritAddress when titularData changes
  useEffect(() => {
    if (showInheritOption && titularData) {
      setInheritAddress(!isEdit || !initialData || addressesMatch(initialData, titularData))
    }
  }, [titularData, initialData, showInheritOption, isEdit])

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
          estado: data.uf || prev.estado,
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

  // ─── Validation ───
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const hidden = showInheritOption && inheritAddress && titularData
    if (hidden) {
      setErrors({})
      return true
    }

    const cepDigits = form.cep.replace(/\D/g, '')
    if (cepDigits.length !== 8) newErrors.cep = 'CEP inválido'
    if (!form.logradouro.trim()) newErrors.logradouro = 'Logradouro é obrigatório'
    if (!form.numero.trim()) newErrors.numero = 'Número é obrigatório'
    if (!form.bairro.trim()) newErrors.bairro = 'Bairro é obrigatório'
    if (!form.cidade.trim()) newErrors.cidade = 'Cidade é obrigatória'
    if (!form.estado.trim()) newErrors.estado = 'Estado é obrigatório'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getData = (): Record<string, unknown> => {
    if (showInheritOption && inheritAddress && titularData) {
      return {
        cep: (titularData.cep as string) || '',
        logradouro: (titularData.logradouro as string) || '',
        numero: (titularData.numero as string) || '',
        complemento: (titularData.complemento as string) || '',
        bairro: (titularData.bairro as string) || '',
        cidade: (titularData.cidade as string) || '',
        estado: (titularData.estado as string) || '',
      }
    }
    return {
      ...form,
      cep: form.cep ? form.cep.replace(/\D/g, '') : '',
    }
  }

  useImperativeHandle(ref, () => ({ getData, validate }), [form, errors, inheritAddress, titularData, showInheritOption])

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
  const hidden = showInheritOption && inheritAddress && titularData

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Inherit address checkbox */}
      {showInheritOption && titularData && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="inheritAddress"
            checked={inheritAddress}
            onChange={(e) => setInheritAddress(e.target.checked)}
            className="rounded border-input"
          />
          <label htmlFor="inheritAddress" className="text-sm text-muted-foreground">
            Usar mesmo endereço e contato do titular
          </label>
        </div>
      )}

      {!hidden && (
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
                required
                className={`${inputClass(errors.cep)} font-mono pr-10`}
                placeholder="00000-000"
                aria-invalid={!!errors.cep}
                aria-describedby={errors.cep ? 'cep-error' : undefined}
              />
              {viacepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {errors.cep && <p id="cep-error" className="text-xs text-state-error mt-1" role="alert" aria-live="polite">{errors.cep}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Logradouro *</label>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) => updateForm('logradouro', e.target.value)}
                required
                className={inputClass(errors.logradouro)}
                placeholder="Rua, Avenida..."
                aria-invalid={!!errors.logradouro}
                aria-describedby={errors.logradouro ? 'logradouro-error' : undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Número *</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => updateForm('numero', e.target.value)}
                required
                className={inputClass(errors.numero)}
                aria-invalid={!!errors.numero}
                aria-describedby={errors.numero ? 'numero-error' : undefined}
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
                required
                className={inputClass(errors.bairro)}
                aria-invalid={!!errors.bairro}
                aria-describedby={errors.bairro ? 'bairro-error' : undefined}
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
                required
                className={inputClass(errors.cidade)}
                aria-invalid={!!errors.cidade}
                aria-describedby={errors.cidade ? 'cidade-error' : undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Estado *</label>
              <input
                type="text"
                value={form.estado}
                onChange={(e) => updateForm('estado', e.target.value.toUpperCase())}
                required
                maxLength={2}
                className={inputClass(errors.estado)}
                placeholder="UF"
                aria-invalid={!!errors.estado}
                aria-describedby={errors.estado ? 'estado-error' : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* Action buttons — only in standalone mode */}
      {standalone && (
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? 'Processando...' : isEdit ? 'Salvar' : 'Confirmar'}
          </Button>
        </div>
      )}
    </form>
  )
})
