'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DadosPessoaisForm, type DadosPessoaisFormHandle } from './dados-pessoais-form'
import { EnderecoForm, type EnderecoFormHandle } from './endereco-form'

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
  existingCpfs?: string[]
  mode?: 'create' | 'edit'
}

const SHOW_ADDRESS: Record<SessionType, boolean> = {
  TITULAR: true,
  DEPENDENTE: false,
  AGREGADO: true,
  SUB_DEPENDENTE: false,
}

export function PessoaFisicaForm({
  sessionType,
  onSubmit,
  onCancel,
  initialData,
  agregadoPaiId,
  titularData,
  onCpfFound,
  existingCpfs,
  mode = 'create',
}: PessoaFisicaFormProps) {
  const isEdit = mode === 'edit'
  const showAddress = SHOW_ADDRESS[sessionType]
  const showInheritOption = sessionType === 'AGREGADO' && !!titularData

  const dadosRef = useRef<DadosPessoaisFormHandle>(null)
  const enderecoRef = useRef<EnderecoFormHandle>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(() => {
    const dadosValid = dadosRef.current?.validate() ?? true
    const enderecoValid = showAddress ? (enderecoRef.current?.validate() ?? true) : true

    if (!dadosValid || !enderecoValid) return

    setSubmitting(true)
    try {
      const dadosData = dadosRef.current?.getData() ?? {}

      const output: Record<string, unknown> = {
        ...dadosData,
      }

      if (sessionType === 'SUB_DEPENDENTE' && agregadoPaiId) {
        output.agregadoPaiId = agregadoPaiId
      }

      if (showAddress) {
        const enderecoData = enderecoRef.current?.getData() ?? {}
        Object.assign(output, enderecoData)
      }

      onSubmit(output)
    } finally {
      setSubmitting(false)
    }
  }, [sessionType, showAddress, agregadoPaiId, onSubmit])

  return (
    <div className="space-y-4">
      <DadosPessoaisForm
        ref={dadosRef}
        sessionType={sessionType}
        initialData={initialData}
        onCpfFound={onCpfFound}
        existingCpfs={existingCpfs}
        mode={mode}
      />

      {showAddress && (
        <EnderecoForm
          ref={enderecoRef}
          initialData={initialData}
          titularData={titularData}
          showInheritOption={showInheritOption}
          mode={mode}
        />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {submitting ? 'Processando...' : isEdit ? 'Salvar' : 'Confirmar'}
        </Button>
      </div>
    </div>
  )
}
