'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatCPF, formatDate, formatPhone, formatCEP } from '@/lib/helpers'
import { DadosPessoaisForm, type DadosPessoaisFormHandle } from '@/components/checkout/dados-pessoais-form'
import { EnderecoForm, type EnderecoFormHandle } from '@/components/checkout/endereco-form'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  UserCircle,
  Users,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Heart,
} from 'lucide-react'
import { toast } from 'sonner'

interface PessoaFisica {
  id: string
  nomeCompleto: string
  dataNascimento: string
  cpf: string | null
  genero: string | null
  estadoCivil: string | null
  tipoRegistro: string
  email: string | null
  telefone: string | null
  profissao: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  titularRaizId: string | null
}

interface Vinculo {
  id: string
  tipoVinculo: string
  parentesco: string
  agregadoPaiId: string | null
  pessoaVinculada: {
    id: string
    nomeCompleto: string
    tipoRegistro: string
    dataNascimento: string
    cpf: string | null
    estadoCivil: string | null
  }
}

interface Contrato {
  id: string
  titularId: string
  status: string
  vinculos: Vinculo[]
}

const tipoVinculoLabel: Record<string, string> = {
  DEPENDENTE: 'Dependente',
  AGREGADO: 'Agregado',
  SUB_DEPENDENTE: 'Sub-dependente',
}

const parentescoLabel: Record<string, string> = {
  CONJUGE: 'Cônjuge',
  FILHO: 'Filho(a)',
  PAI_MAE: 'Pai/Mãe',
  SOGRO: 'Sogro(a)',
  ENTREADO: 'Enteado(a)',
  NETO: 'Neto(a)',
  AVO: 'Avô(ó)',
  IRMAO: 'Irmão(ã)',
  TIO: 'Tio(a)',
}

const estadoCivilOptions = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
  { value: 'UNIAO_ESTAVEL', label: 'União Estável' },
]

const generoOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
]

const parentescoPorTipo: Record<string, Array<{ value: string; label: string }>> = {
  DEPENDENTE: [
    { value: 'CONJUGE', label: 'Cônjuge' },
    { value: 'FILHO', label: 'Filho(a)' },
  ],
  AGREGADO: [
    { value: 'CONJUGE', label: 'Cônjuge' },
    { value: 'FILHO', label: 'Filho(a)' },
    { value: 'PAI_MAE', label: 'Pai/Mãe' },
    { value: 'SOGRO', label: 'Sogro(a)' },
    { value: 'ENTREADO', label: 'Enteado(a)' },
    { value: 'NETO', label: 'Neto(a)' },
    { value: 'AVO', label: 'Avô(ó)' },
    { value: 'IRMAO', label: 'Irmão(ã)' },
    { value: 'TIO', label: 'Tio(a)' },
  ],
  SUB_DEPENDENTE: [
    { value: 'CONJUGE', label: 'Cônjuge' },
    { value: 'FILHO', label: 'Filho(a)' },
  ],
}

// ─── Dialog: Editar Dados Pessoais (Titular) — sem endereço ───

function EditPessoaDialog({
  open,
  onOpenChange,
  pessoa,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pessoa: PessoaFisica
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSave = async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload: Record<string, string | undefined> = {}
      const allowedFields = [
        'nomeCompleto', 'dataNascimento', 'genero', 'estadoCivil', 'profissao',
        'email', 'telefone',
      ]
      allowedFields.forEach((field) => {
        const val = data[field]
        if (val && typeof val === 'string' && val.trim()) {
          payload[field] = val
        }
      })

      const res = await fetch(`/api/pessoas-fisicas/${pessoa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      toast.success('Dados atualizados com sucesso!')
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Editar Dados Pessoais</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-4">
          <DadosPessoaisForm
            sessionType="TITULAR"
            mode="edit"
            onSubmit={handleSave}
            onCancel={() => onOpenChange(false)}
            initialData={pessoa as unknown as Record<string, unknown>}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Dialog: Editar Endereço (Titular) ───

function EditEnderecoDialog({
  open,
  onOpenChange,
  pessoa,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pessoa: PessoaFisica
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSave = async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload: Record<string, string | undefined> = {}
      const allowedFields = [
        'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
      ]
      allowedFields.forEach((field) => {
        const val = data[field]
        if (val && typeof val === 'string' && val.trim()) {
          payload[field] = val
        }
      })

      const res = await fetch(`/api/pessoas-fisicas/${pessoa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      toast.success('Endereço atualizado com sucesso!')
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Editar Endereço</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-4">
          <EnderecoForm
            mode="edit"
            onSubmit={handleSave}
            onCancel={() => onOpenChange(false)}
            initialData={pessoa as unknown as Record<string, unknown>}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}



// ─── Dialog: Alterar Estado Civil ───

function EstadoCivilDialog({
  open,
  onOpenChange,
  pessoaId,
  estadoCivilAtual,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pessoaId: string
  estadoCivilAtual: string | null
  onSuccess: () => void
}) {
  const [novoEstadoCivil, setNovoEstadoCivil] = useState(estadoCivilAtual ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!novoEstadoCivil) {
      toast.error('Selecione um estado civil.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/pessoas-fisicas/${pessoaId}/estado-civil`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novoEstadoCivil,
          motivo: 'Alteração realizada pelo titular via autogestão',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao alterar')
      }
      toast.success('Estado civil atualizado!')
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar Estado Civil</DialogTitle>
          <DialogDescription>
            {estadoCivilAtual && ['CASADO', 'UNIAO_ESTAVEL'].includes(estadoCivilAtual)
              ? 'Ao alterar para solteiro(a)/divorciado(a)/viúvo(a), sub-dependentes cônjuges serão desvinculados. Filhos permanecem ativos.'
              : 'Selecione o novo estado civil.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="estado-civil-select">Estado Civil</Label>
          <Select value={novoEstadoCivil} onValueChange={setNovoEstadoCivil}>
            <SelectTrigger id="estado-civil-select" className="mt-1.5">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {estadoCivilOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Alterar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog: Editar Vínculo (DadosPessoais + Endereco) ───

function EditVinculoDialog({
  open,
  onOpenChange,
  vinculo,
  onSuccess,
  titularData,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vinculo: Vinculo | null
  onSuccess: () => void
  titularData?: Record<string, unknown>
}) {
  const [saving, setSaving] = useState(false)

  const { data: pessoaData, isLoading } = useQuery({
    queryKey: ['edit-vinculo-pessoa', vinculo?.pessoaVinculada.id],
    queryFn: async () => {
      if (!vinculo) return null
      const res = await fetch(`/api/pessoas-fisicas/${vinculo.pessoaVinculada.id}`)
      if (!res.ok) throw new Error('Erro ao carregar dados')
      return res.json() as Promise<PessoaFisica>
    },
    enabled: !!vinculo && open,
  })

  const tipoVinculo = vinculo?.tipoVinculo as 'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE' | undefined
  const showEndereco = tipoVinculo === 'AGREGADO'

  const dadosRef = useRef<DadosPessoaisFormHandle>(null)
  const enderecoRef = useRef<EnderecoFormHandle>(null)

  const handleCombinedSave = async () => {
    if (!vinculo) return
    if (!dadosRef.current?.validate()) return
    if (showEndereco && !enderecoRef.current?.validate()) return

    setSaving(true)
    try {
      const data = {
        ...dadosRef.current?.getData(),
        ...enderecoRef.current?.getData(),
      }
      const payload: Record<string, string | undefined> = {}
      const allowedFields = [
        'nomeCompleto', 'dataNascimento', 'genero', 'estadoCivil', 'profissao',
        'email', 'telefone',
        'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
      ]
      allowedFields.forEach((field) => {
        const val = data[field]
        if (val && typeof val === 'string' && val.trim()) {
          payload[field] = val
        }
      })

      const res = await fetch(`/api/pessoas-fisicas/${vinculo.pessoaVinculada.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      toast.success(`${tipoVinculoLabel[vinculo.tipoVinculo]} atualizado com sucesso!`)
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">
            Editar {vinculo ? tipoVinculoLabel[vinculo.tipoVinculo] ?? 'Vínculo' : 'Vínculo'}
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <DadosPessoaisForm
                ref={dadosRef}
                sessionType={tipoVinculo || 'DEPENDENTE'}
                mode="edit"
                initialData={pessoaData as unknown as Record<string, unknown> | undefined}
                existingCpfs={undefined}
              />

              {showEndereco && (
                <EnderecoForm
                  ref={enderecoRef}
                  mode="edit"
                  initialData={pessoaData as unknown as Record<string, unknown> | undefined}
                  titularData={titularData}
                  showInheritOption
                />
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  type="button"
                  onClick={handleCombinedSave}
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Dialog: Adicionar Vínculo (DadosPessoais + Endereco) ───

function AddVinculoDialog({
  open,
  onOpenChange,
  titularId,
  tipoVinculo,
  onSuccess,
  eligibleAgregados = [],
  titularData,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titularId: string
  tipoVinculo: 'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE'
  onSuccess: () => void
  eligibleAgregados?: Vinculo[]
  titularData?: Record<string, unknown>
}) {
  const [saving, setSaving] = useState(false)
  const [selectedAgregadoPai, setSelectedAgregadoPai] = useState('')
  const showEndereco = tipoVinculo === 'AGREGADO'

  const dadosRef = useRef<DadosPessoaisFormHandle>(null)
  const enderecoRef = useRef<EnderecoFormHandle>(null)

  const handleSubmit = async () => {
    if (tipoVinculo === 'SUB_DEPENDENTE' && !selectedAgregadoPai) {
      toast.error('Selecione o agregado responsável.')
      return
    }

    if (!dadosRef.current?.validate()) return
    if (showEndereco && !enderecoRef.current?.validate()) return

    const dadosData = dadosRef.current?.getData() ?? {}
    const enderecoData = showEndereco ? (enderecoRef.current?.getData() ?? {}) : {}
    const data = { ...dadosData, ...enderecoData }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...data,
        tipoVinculo,
        agregadoPaiId: tipoVinculo === 'SUB_DEPENDENTE' ? selectedAgregadoPai : undefined,
      }
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === null || payload[k] === undefined) delete payload[k]
      })

      const res = await fetch(`/api/pessoas-fisicas/${titularId}/vinculos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao adicionar')
      }
      toast.success(`${tipoVinculoLabel[tipoVinculo]} adicionado com sucesso!`)
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onOpenChange(v); setSelectedAgregadoPai('') } }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Adicionar {tipoVinculoLabel[tipoVinculo]}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-4">
          {/* Sub-dependente: select parent agregado */}
          {tipoVinculo === 'SUB_DEPENDENTE' && eligibleAgregados.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Agregado responsável *
              </label>
              <Select value={selectedAgregadoPai} onValueChange={setSelectedAgregadoPai}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agregado" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAgregados.map((ag) => (
                    <SelectItem key={ag.id} value={ag.pessoaVinculada.id}>
                      {ag.pessoaVinculada.nomeCompleto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DadosPessoaisForm
            ref={dadosRef}
            sessionType={tipoVinculo}
            mode="create"
            existingCpfs={undefined}
          />

          {showEndereco && (
            <EnderecoForm
              ref={enderecoRef}
              mode="create"
              titularData={titularData}
              showInheritOption
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); setSelectedAgregadoPai('') }}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Componente Principal ───

export function MeusDadosTab() {
  const { user } = useAppStore()
  const pessoaFisicaId = user?.pessoaFisicaId
  const queryClient = useQueryClient()

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['minha-pessoa', pessoaFisicaId] })
    queryClient.invalidateQueries({ queryKey: ['meus-contratos-vinculos', pessoaFisicaId] })
  }

  const { data: pessoa, isLoading: loadingPessoa } = useQuery<PessoaFisica>({
    queryKey: ['minha-pessoa', pessoaFisicaId],
    queryFn: async () => {
      if (!pessoaFisicaId) throw new Error('ID da pessoa não encontrado')
      const res = await fetch(`/api/pessoas-fisicas/${pessoaFisicaId}`)
      if (!res.ok) throw new Error('Erro ao carregar dados')
      return res.json()
    },
    enabled: !!pessoaFisicaId,
  })

  const { data: contratos } = useQuery<Contrato[]>({
    queryKey: ['meus-contratos-vinculos', pessoaFisicaId],
    queryFn: async () => {
      if (!pessoaFisicaId) throw new Error('ID não encontrado')
      const res = await fetch(`/api/contratos?titularId=${pessoaFisicaId}`)
      if (!res.ok) throw new Error('Erro ao carregar contratos')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!pessoaFisicaId,
  })

  const deleteVinculo = useMutation({
    mutationFn: async (vinculoId: string) => {
      const res = await fetch(`/api/pessoas-fisicas/${pessoaFisicaId}/vinculos/${vinculoId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao remover')
      }
    },
    onSuccess: () => {
      toast.success('Vínculo removido com sucesso!')
      refreshData()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const contratoAtivo = contratos?.[0]
  const vinculos = contratoAtivo?.vinculos ?? []

  const eligibleAgregadosForSub = useMemo(() => {
    return vinculos.filter(
      (v) => v.tipoVinculo === 'AGREGADO' && ['CASADO', 'UNIAO_ESTAVEL'].includes(v.pessoaVinculada.estadoCivil ?? '')
    )
  }, [vinculos])

  // Dialog states
  const [editDadosOpen, setEditDadosOpen] = useState(false)
  const [editEnderecoOpen, setEditEnderecoOpen] = useState(false)
  const [estadoCivilOpen, setEstadoCivilOpen] = useState(false)
  const [addVinculoOpen, setAddVinculoOpen] = useState(false)
  const [addVinculoTipo, setAddVinculoTipo] = useState<'DEPENDENTE' | 'AGREGADO' | 'SUB_DEPENDENTE'>('DEPENDENTE')
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [editVinculoId, setEditVinculoId] = useState<string | null>(null)

  if (loadingPessoa) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!pessoa) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Dados não encontrados.
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Meus Dados</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações cadastrais e vínculos familiares</p>
      </div>

      {/* Dados Pessoais */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditDadosOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nome</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.nomeCompleto}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CPF</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.cpf ? formatCPF(pessoa.cpf) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data de Nascimento</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(pessoa.dataNascimento)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gênero</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {pessoa.genero
                  ? pessoa.genero === 'M' ? 'Masculino' : pessoa.genero === 'F' ? 'Feminino' : pessoa.genero
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Estado Civil</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                {pessoa.estadoCivil
                  ? estadoCivilOptions.find((o) => o.value === pessoa.estadoCivil)?.label ?? pessoa.estadoCivil
                  : '—'}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-primary"
                  onClick={() => setEstadoCivilOpen(true)}
                >
                  Alterar
                </Button>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Profissão</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.profissao || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">E-mail</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {pessoa.email || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Telefone</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {pessoa.telefone ? formatPhone(pessoa.telefone) : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Endereço
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditEnderecoOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CEP</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.cep ? formatCEP(pessoa.cep) : '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Logradouro</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {pessoa.logradouro || '—'}{pessoa.numero ? `, ${pessoa.numero}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Complemento</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.complemento || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bairro</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{pessoa.bairro || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cidade / UF</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {pessoa.cidade || '—'}{pessoa.estado ? ` / ${pessoa.estado}` : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vínculos (Dependentes / Agregados) */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Dependentes e Agregados
            {vinculos.length > 0 && (
              <Badge variant="secondary" className="ml-2">{vinculos.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddVinculoTipo('DEPENDENTE'); setAddVinculoOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Dependente
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAddVinculoTipo('AGREGADO'); setAddVinculoOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Agregado
            </Button>
            {eligibleAgregadosForSub.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setAddVinculoTipo('SUB_DEPENDENTE'); setAddVinculoOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Sub-dependente
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {vinculos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum dependente ou agregado vinculado ao seu contrato.
            </p>
          ) : (
            <div className="space-y-3">
              {vinculos.map((vinc) => (
                <div
                  key={vinc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {vinc.pessoaVinculada.nomeCompleto}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tipoVinculoLabel[vinc.tipoVinculo] ?? vinc.tipoVinculo}
                        {' · '}
                        {parentescoLabel[vinc.parentesco] ?? vinc.parentesco}
                        {vinc.pessoaVinculada.cpf ? ` · ${formatCPF(vinc.pessoaVinculada.cpf)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {vinc.pessoaVinculada.tipoRegistro}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditVinculoId(vinc.id)}
                      title="Editar vínculo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-state-error hover:text-state-error hover:bg-state-error/10"
                      onClick={() => setRemoveConfirmId(vinc.id)}
                      title="Remover vínculo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status do Contrato */}
      {contratoAtivo && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Situação do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge className={statusLabels[contratoAtivo.status] ? 'bg-state-success/10 text-state-success' : ''}>
                {statusLabels[contratoAtivo.status] ?? contratoAtivo.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Contrato #{contratoAtivo.id.slice(0, 8)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <EditPessoaDialog
        open={editDadosOpen}
        onOpenChange={setEditDadosOpen}
        pessoa={pessoa}
        onSuccess={refreshData}
      />

      <EditEnderecoDialog
        open={editEnderecoOpen}
        onOpenChange={setEditEnderecoOpen}
        pessoa={pessoa}
        onSuccess={refreshData}
      />

      <EstadoCivilDialog
        open={estadoCivilOpen}
        onOpenChange={setEstadoCivilOpen}
        pessoaId={pessoa.id}
        estadoCivilAtual={pessoa.estadoCivil}
        onSuccess={refreshData}
      />

      <AddVinculoDialog
        open={addVinculoOpen}
        onOpenChange={setAddVinculoOpen}
        titularId={pessoa.id}
        tipoVinculo={addVinculoTipo}
        onSuccess={refreshData}
        eligibleAgregados={addVinculoTipo === 'SUB_DEPENDENTE' ? eligibleAgregadosForSub : []}
        titularData={pessoa as unknown as Record<string, unknown>}
      />

      <EditVinculoDialog
        open={!!editVinculoId}
        onOpenChange={(v) => { if (!v) setEditVinculoId(null) }}
        vinculo={vinculos.find((v) => v.id === editVinculoId) ?? null}
        onSuccess={refreshData}
        titularData={pessoa as unknown as Record<string, unknown>}
      />

      {/* Confirmar Remoção */}
      <AlertDialog open={!!removeConfirmId} onOpenChange={(v) => { if (!v) setRemoveConfirmId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O vínculo será removido do seu contrato.
              {vinculos.find((v) => v.id === removeConfirmId)?.tipoVinculo === 'AGREGADO' &&
                ' Verifique se não há sub-dependentes vinculados a este agregado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-state-error text-white hover:bg-state-error/90"
              onClick={() => {
                if (removeConfirmId) {
                  deleteVinculo.mutate(removeConfirmId)
                  setRemoveConfirmId(null)
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const statusLabels: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
  SUSPENSO: 'Suspenso',
  CANCELADO_CDC: 'Cancelado CDC',
}
