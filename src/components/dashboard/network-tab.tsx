'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { formatCPF, formatDate } from '@/lib/helpers'
import { toast } from 'sonner'

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// Icons
import {
  Download,
  Users,
  TreePine,
  UserPlus,
  ArrowRightLeft,
  Search,
  ChevronRight,
  ChevronDown,
  Shield,
  History,
  UserCheck,
  Leaf,
  Layers,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───

interface TreeNode {
  id: string
  revendedorId: string
  nomeCompleto: string
  cpf: string | null
  nivelProfundidade: number
  subordinados: TreeNode[]
}

interface PatrocinioItem {
  id: string
  nivelProfundidade: number
  dataEntrada: string
  dataFimVinculo: string | null
  motivoRealocacao: string | null
  revendedor: { id: string; nomeCompleto: string; cpf: string | null }
  patrocinador: { id: string; nomeCompleto: string; cpf: string | null }
}

interface PatrocinioPaginated {
  data: PatrocinioItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface HistoricoEntry {
  id: string
  patrocinadorId: string
  patrocinadorNome: string
  patrocinadorCpf: string | null
  nivelProfundidade: number
  dataEntrada: string
  dataFimVinculo: string | null
  motivoRealocacao: string | null
  ativo: boolean
}

interface HistoricoResponse {
  revendedor: { id: string; nomeCompleto: string; cpf: string | null }
  historico: HistoricoEntry[]
  total: number
  ativos: number
  realocacoes: number
}

interface SubordinadoItem {
  patrocinioId: string
  revendedorId: string
  nomeCompleto: string
  cpf: string | null
  tipoRegistro: string
  nivelProfundidade: number
  dataEntrada: string
  relacao: 'direto' | 'indireto'
}

interface SubordinadosResponse {
  data: SubordinadoItem[]
  countPorNivel: Record<number, number>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface PessoaOption {
  id: string
  nomeCompleto: string
  cpf: string | null
}

// ─── Constants ───

const levelColors = [
  'bg-primary/10 text-primary',
  'bg-brand-accent/10 text-brand-accent',
  'bg-state-success/10 text-state-success',
  'bg-state-warning/10 text-state-warning',
  'bg-state-error/10 text-state-error',
]

const levelBorderColors = [
  'border-l-primary',
  'border-l-brand-accent',
  'border-l-state-success',
  'border-l-state-warning',
  'border-l-state-error',
]

function getLevelColor(level: number): string {
  return levelColors[(level - 1) % levelColors.length]
}

function getLevelBorderColor(level: number): string {
  return levelBorderColors[(level - 1) % levelBorderColors.length]
}

// ─── Helper: count all nodes in tree ───

function countNodes(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    if (node.subordinados.length > 0) {
      count += countNodes(node.subordinados)
    }
  }
  return count
}

// ─── Helper: count leaves (nodes with no subordinados) ───

function countLeaves(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.subordinados.length === 0) {
      count += 1
    } else {
      count += countLeaves(node.subordinados)
    }
  }
  return count
}

// ─── Helper: max depth of tree ───

function maxDepth(nodes: TreeNode[]): number {
  if (nodes.length === 0) return 0
  let max = 0
  for (const node of nodes) {
    const childDepth = maxDepth(node.subordinados)
    max = Math.max(max, node.nivelProfundidade, childDepth)
  }
  return max
}

// ─── Helper: collect all unique patrocinadores from patrocinios list ───

function uniquePatrocinadores(patrocinios: PatrocinioItem[]): Set<string> {
  const set = new Set<string>()
  for (const p of patrocinios) {
    set.add(p.patrocinador.id)
  }
  return set
}

// ─── Helper: filter tree by search term ───

function filterTree(nodes: TreeNode[], term: string): TreeNode[] {
  if (!term.trim()) return nodes
  const lower = term.toLowerCase()

  return nodes.reduce<TreeNode[]>((acc, node) => {
    const nameMatch = node.nomeCompleto.toLowerCase().includes(lower)
    const cpfMatch = node.cpf ? node.cpf.includes(term.replace(/\D/g, '')) : false
    const filteredChildren = filterTree(node.subordinados, term)

    if (nameMatch || cpfMatch || filteredChildren.length > 0) {
      acc.push({
        ...node,
        subordinados: filteredChildren,
      })
    }
    return acc
  }, [])
}

// ─── Tree Node Component ───

function TreeNodeItem({
  node,
  isSuperAdmin,
  onRealocar,
  onViewSubordinados,
  onViewHistorico,
  depth = 0,
}: {
  node: TreeNode
  isSuperAdmin: boolean
  onRealocar: (node: TreeNode) => void
  onViewSubordinados: (node: TreeNode) => void
  onViewHistorico: (node: TreeNode) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.subordinados.length > 0

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg border-l-4 ${getLevelBorderColor(node.nivelProfundidade)} hover:bg-muted/50 transition-colors group`}
        style={{ marginLeft: `${depth * 24}px` }}
        role="treeitem"
        aria-selected={false}
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hasChildren) {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`shrink-0 h-5 w-5 flex items-center justify-center rounded transition-colors ${
            hasChildren
              ? 'hover:bg-muted cursor-pointer'
              : 'opacity-0 cursor-default'
          }`}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          tabIndex={-1}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Level Badge */}
        <Badge className={`text-[10px] px-1.5 py-0 ${getLevelColor(node.nivelProfundidade)}`}>
          N{node.nivelProfundidade}
        </Badge>

        {/* Name & CPF */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-foreground truncate block">
            {node.nomeCompleto}
          </span>
          {node.cpf && (
            <span className="text-xs text-muted-foreground">
              {formatCPF(node.cpf)}
            </span>
          )}
        </div>

        {/* Subordinates count */}
        {hasChildren && (
          <span className="text-xs text-muted-foreground shrink-0">
            {node.subordinados.length} {node.subordinados.length === 1 ? 'subordinado' : 'subordinados'}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewSubordinados(node)}
            title="Ver subordinados"
          >
            <Users className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewHistorico(node)}
            title="Ver histórico"
          >
            <History className="h-3 w-3" />
          </Button>
          {isSuperAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-state-warning"
              onClick={() => onRealocar(node)}
              title="Realocar"
            >
              <ArrowRightLeft className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div role="group">
          {node.subordinados.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              isSuperAdmin={isSuperAdmin}
              onRealocar={onRealocar}
              onViewSubordinados={onViewSubordinados}
              onViewHistorico={onViewHistorico}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───

export function NetworkTab() {
  const queryClient = useQueryClient()
  const { user } = useAppStore()
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // ─── State ───
  const [treeSearch, setTreeSearch] = useState('')
  const [selectedRevendedor, setSelectedRevendedor] = useState<TreeNode | null>(null)
  const [activeTab, setActiveTab] = useState('arvore')

  // Create Patrocínio dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createRevendedorId, setCreateRevendedorId] = useState('')
  const [createPatrocinadorId, setCreatePatrocinadorId] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // Realocação dialog
  const [realocarDialogOpen, setRealocarDialogOpen] = useState(false)
  const [realocarNode, setRealocarNode] = useState<TreeNode | null>(null)
  const [realocarNovoPatrocinadorId, setRealocarNovoPatrocinadorId] = useState('')
  const [realocarMotivo, setRealocarMotivo] = useState('')
  const [realocarConfirmOpen, setRealocarConfirmOpen] = useState(false)
  const [realocarSubmitting, setRealocarSubmitting] = useState(false)

  // Subordinates view
  const [subordinadosTipo, setSubordinadosTipo] = useState<'diretos' | 'indiretos' | 'todos'>('diretos')
  const [subordinadosPage, setSubordinadosPage] = useState(1)

  // History view
  const [historicoRevendedorId, setHistoricoRevendedorId] = useState<string | null>(null)

  // CSV export
  const [csvExportHistorico, setCsvExportHistorico] = useState(false)
  const [csvExportNivel, setCsvExportNivel] = useState<string>('all')

  // ─── Queries ───

  // Patrocínios list (for stats + CSV + selects)
  const { data: patrociniosData, isLoading: patrociniosLoading } = useQuery<PatrocinioPaginated>({
    queryKey: ['patrocinios', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/patrocinios?limit=100&incluirInativos=true')
      if (!res.ok) throw new Error('Erro ao carregar patrocínios')
      return res.json()
    },
  })

  // Active patrocínios (for stats)
  const { data: patrociniosAtivosData } = useQuery<PatrocinioPaginated>({
    queryKey: ['patrocinios', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/patrocinios?limit=100')
      if (!res.ok) throw new Error('Erro ao carregar patrocínios ativos')
      return res.json()
    },
  })

  // Tree data
  const { data: treeData, isLoading: treeLoading } = useQuery<{ trees?: TreeNode[]; tree?: TreeNode }>({
    queryKey: ['rede', 'arvore'],
    queryFn: async () => {
      const res = await fetch('/api/rede/arvore?max_nivel=10')
      if (!res.ok) throw new Error('Erro ao carregar árvore')
      return res.json()
    },
  })

  // People for selects (all pessoas_fisicas who are titulares)
  const { data: pessoasData } = useQuery<{ data: PessoaOption[] }>({
    queryKey: ['pessoas-fisicas'],
    queryFn: async () => {
      // Use patrocinios to derive available people
      const res = await fetch('/api/contratos?limit=100')
      if (!res.ok) return { data: [] }
      const json = await res.json()
      // Extract unique titular people from contracts
      const people: PessoaOption[] = []
      const seen = new Set<string>()
      if (json.data) {
        for (const c of json.data) {
          if (c.titular && !seen.has(c.titular.id)) {
            seen.add(c.titular.id)
            people.push({
              id: c.titular.id,
              nomeCompleto: c.titular.nomeCompleto,
              cpf: c.titular.cpf || null,
            })
          }
        }
      }
      return { data: people }
    },
  })

  // All people from patrocínios (both revendedores and patrocinadores)
  const allPeopleFromPatrocinios = useMemo<PessoaOption[]>(() => {
    if (!patrociniosData?.data) return []
    const map = new Map<string, PessoaOption>()
    for (const p of patrociniosData.data) {
      if (!map.has(p.revendedor.id)) {
        map.set(p.revendedor.id, {
          id: p.revendedor.id,
          nomeCompleto: p.revendedor.nomeCompleto,
          cpf: p.revendedor.cpf,
        })
      }
      if (!map.has(p.patrocinador.id)) {
        map.set(p.patrocinador.id, {
          id: p.patrocinador.id,
          nomeCompleto: p.patrocinador.nomeCompleto,
          cpf: p.patrocinador.cpf,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
  }, [patrociniosData])

  // Merge people from contracts + patrocínios for selects
  const allPeopleOptions = useMemo<PessoaOption[]>(() => {
    const map = new Map<string, PessoaOption>()
    for (const p of allPeopleFromPatrocinios) {
      if (!map.has(p.id)) map.set(p.id, p)
    }
    if (pessoasData?.data) {
      for (const p of pessoasData.data) {
        if (!map.has(p.id)) map.set(p.id, p)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
  }, [allPeopleFromPatrocinios, pessoasData])

  // Available revendedores = people without active patrocínio
  const availableRevendedores = useMemo<PessoaOption[]>(() => {
    const activeRevendedorIds = new Set(
      (patrociniosAtivosData?.data || []).map(p => p.revendedor.id)
    )
    return allPeopleOptions.filter(p => !activeRevendedorIds.has(p.id))
  }, [allPeopleOptions, patrociniosAtivosData])

  // Available patrocinadores = people with active patrocínio or root
  const availablePatrocinadores = useMemo<PessoaOption[]>(() => {
    const activePatrocinadores = new Set(
      (patrociniosAtivosData?.data || []).map(p => p.patrocinador.id)
    )
    const activeRevendedores = new Set(
      (patrociniosAtivosData?.data || []).map(p => p.revendedor.id)
    )
    // Patrocinadores are those who are active in the network (either as a patrocinador or as a revendedor)
    // Or root nodes (are patrocinadores but don't have active patrocínio as revendedor)
    return allPeopleOptions.filter(p => {
      return activePatrocinadores.has(p.id) || activeRevendedores.has(p.id)
    })
  }, [allPeopleOptions, patrociniosAtivosData])

  // Subordinates query
  const { data: subordinadosData, isLoading: subordinadosLoading } = useQuery<SubordinadosResponse>({
    queryKey: ['rede', 'subordinados', selectedRevendedor?.revendedorId, subordinadosTipo, subordinadosPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        revendedor_id: selectedRevendedor!.revendedorId,
        tipo: subordinadosTipo,
        page: String(subordinadosPage),
        limit: '20',
      })
      const res = await fetch(`/api/rede/subordinados?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar subordinados')
      return res.json()
    },
    enabled: !!selectedRevendedor && activeTab === 'subordinados',
  })

  // History query
  const { data: historicoData, isLoading: historicoLoading } = useQuery<HistoricoResponse>({
    queryKey: ['rede', 'historico', historicoRevendedorId],
    queryFn: async () => {
      const res = await fetch(`/api/rede/historico?revendedor_id=${historicoRevendedorId}`)
      if (!res.ok) throw new Error('Erro ao carregar histórico')
      return res.json()
    },
    enabled: !!historicoRevendedorId && activeTab === 'historico',
  })

  // Realocação: count subordinados for confirmation
  const realocarSubordinadosCount = useMemo(() => {
    if (!realocarNode) return 0
    return countNodes(realocarNode.subordinados)
  }, [realocarNode])

  // ─── Mutations ───

  const createPatrocinioMutation = useMutation({
    mutationFn: async (data: { revendedorId: string; patrocinadorId: string }) => {
      const res = await fetch('/api/patrocinios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: () => {
      toast.success('Vínculo criado com sucesso')
      setCreateDialogOpen(false)
      setCreateRevendedorId('')
      setCreatePatrocinadorId('')
      queryClient.invalidateQueries({ queryKey: ['patrocinios'] })
      queryClient.invalidateQueries({ queryKey: ['rede'] })
    },
    onError: (error: Record<string, unknown>) => {
      const err = error as { error?: string; code?: string }
      const codeMessages: Record<string, string> = {
        CONFLITO_DE_REDE: 'Revendedor já possui vínculo ativo em outra árvore de patrocínio.',
        AUTO_PATROCINIO_PROIBIDO: 'Auto-patrocínio não é permitido.',
        AIR_GAP_CLT: 'Requisição contém termos proibidos (Air-Gap CLT).',
        PATROCINADOR_INATIVO: 'Patrocinador não possui vínculo ativo na rede.',
      }
      toast.error(codeMessages[err.code || ''] || err.error || 'Erro ao criar vínculo')
    },
  })

  const realocarMutation = useMutation({
    mutationFn: async (data: { revendedor_id: string; novo_patrocinador_id: string; motivo: string }) => {
      const res = await fetch('/api/rede/realocar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: (data) => {
      const count = data.subordinadosAfetados || 0
      toast.success(`Realocação concluída. ${count} subordinado${count !== 1 ? 's' : ''} recalculado${count !== 1 ? 's' : ''}.`)
      setRealocarDialogOpen(false)
      setRealocarConfirmOpen(false)
      setRealocarNode(null)
      setRealocarNovoPatrocinadorId('')
      setRealocarMotivo('')
      queryClient.invalidateQueries({ queryKey: ['patrocinios'] })
      queryClient.invalidateQueries({ queryKey: ['rede'] })
    },
    onError: (error: Record<string, unknown>) => {
      const err = error as { error?: string; code?: string }
      const codeMessages: Record<string, string> = {
        CICLO_DE_PATROCINIO_DETECTADO: 'A realocação criaria um ciclo na árvore de patrocínio.',
        CONFLITO_DE_REDE: 'Conflito de rede detectado.',
        AUTO_PATROCINIO_PROIBIDO: 'Auto-patrocínio não é permitido.',
        PATROCINADOR_INATIVO: 'Novo patrocinador não possui vínculo ativo.',
        SEM_VINCULO_ATIVO: 'Revendedor não possui vínculo ativo na rede.',
        MESMO_PATROCINADOR: 'Novo patrocinador é o mesmo que o atual.',
        ACESSO_NEGADO: 'Acesso negado. Apenas SuperAdmin pode realizar realocação.',
      }
      toast.error(codeMessages[err.code || ''] || err.error || 'Erro ao realizar realocação')
    },
  })

  // ─── Computed ───

  const trees = useMemo<TreeNode[]>(() => {
    if (treeData?.trees) return treeData.trees
    if (treeData?.tree) return [treeData.tree]
    return []
  }, [treeData])

  const filteredTrees = useMemo(() => {
    return filterTree(trees, treeSearch)
  }, [trees, treeSearch])

  const patrociniosAtivos = patrociniosAtivosData?.data || []
  const patrociniosAll = patrociniosData?.data || []

  const stats = useMemo(() => {
    const totalAtivos = patrociniosAtivos.length
    const niveis = new Set(patrociniosAtivos.map(p => p.nivelProfundidade))
    const maxNivel = niveis.size > 0 ? Math.max(...niveis) : 0
    const patrocinadoresUnicos = uniquePatrocinadores(patrociniosAtivos).size
    const folhas = trees.length > 0 ? countLeaves(trees) : 0

    return { totalAtivos, maxNivel, patrocinadoresUnicos, folhas }
  }, [patrociniosAtivos, trees])

  // Preview nivel for create patrocínio
  const createNivelPreview = useMemo(() => {
    if (!createPatrocinadorId) return null
    const patrocinioAtivoPatrocinador = patrociniosAtivos.find(
      p => p.revendedor.id === createPatrocinadorId
    )
    if (patrocinioAtivoPatrocinador) {
      return patrocinioAtivoPatrocinador.nivelProfundidade + 1
    }
    // Check if they're a root (patrocinador but not revendedor)
    const isPatrocinador = patrociniosAtivos.some(p => p.patrocinador.id === createPatrocinadorId)
    if (isPatrocinador) return 1
    return null
  }, [createPatrocinadorId, patrociniosAtivos])

  // ─── Handlers ───

  const handleViewSubordinados = useCallback((node: TreeNode) => {
    setSelectedRevendedor(node)
    setSubordinadosPage(1)
    setActiveTab('subordinados')
  }, [])

  const handleViewHistorico = useCallback((node: TreeNode) => {
    setHistoricoRevendedorId(node.revendedorId)
    setActiveTab('historico')
  }, [])

  const handleRealocar = useCallback((node: TreeNode) => {
    setRealocarNode(node)
    setRealocarNovoPatrocinadorId('')
    setRealocarMotivo('')
    setRealocarDialogOpen(true)
  }, [])

  const handleCreateSubmit = useCallback(() => {
    if (!createRevendedorId || !createPatrocinadorId) {
      toast.error('Selecione revendedor e patrocinador')
      return
    }
    setCreateSubmitting(true)
    createPatrocinioMutation.mutate(
      { revendedorId: createRevendedorId, patrocinadorId: createPatrocinadorId },
      { onSettled: () => setCreateSubmitting(false) }
    )
  }, [createRevendedorId, createPatrocinadorId, createPatrocinioMutation])

  const handleRealocarSubmit = useCallback(() => {
    if (!realocarNode || !realocarNovoPatrocinadorId) return
    setRealocarSubmitting(true)
    realocarMutation.mutate(
      {
        revendedor_id: realocarNode.revendedorId,
        novo_patrocinador_id: realocarNovoPatrocinadorId,
        motivo: realocarMotivo,
      },
      { onSettled: () => setRealocarSubmitting(false) }
    )
  }, [realocarNode, realocarNovoPatrocinadorId, realocarMotivo, realocarMutation])

  const handleExportCSV = useCallback(() => {
    let dataToExport = csvExportHistorico ? patrociniosAll : patrociniosAtivos

    if (csvExportNivel !== 'all') {
      const nivelNum = parseInt(csvExportNivel, 10)
      dataToExport = dataToExport.filter(p => p.nivelProfundidade === nivelNum)
    }

    const headers = 'Nível;Revendedor;CPF Revendedor;Patrocinador;CPF Patrocinador;Data Entrada;Data Fim;Status\n'
    const rows = dataToExport.map(p =>
      `${p.nivelProfundidade};${p.revendedor.nomeCompleto};${p.revendedor.cpf || ''};${p.patrocinador.nomeCompleto};${p.patrocinador.cpf || ''};${formatDate(p.dataEntrada)};${p.dataFimVinculo ? formatDate(p.dataFimVinculo) : ''};${p.dataFimVinculo ? 'Inativo' : 'Ativo'}`
    ).join('\n')
    const csv = headers + rows
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rede-patrocinio${csvExportHistorico ? '-completo' : '-ativos'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [csvExportHistorico, csvExportNivel, patrociniosAll, patrociniosAtivos])

  // Available levels for CSV filter
  const availableLevels = useMemo(() => {
    const levels = new Set(patrociniosAtivos.map(p => p.nivelProfundidade))
    return Array.from(levels).sort((a, b) => a - b)
  }, [patrociniosAtivos])

  // ─── Render ───

  return (
    <div className="animate-fade-up">
      {/* ─── Compliance Banner (ADR-03) ─── */}
      <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-state-success/5 border border-state-success/20 text-sm text-state-success">
        <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Compliance:</strong> Este sistema não gerencia metas, horários ou subordinação trabalhista (Air-Gap Funcional ADR-03)
        </span>
      </div>

      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Rede / Patrocínio</h1>
          <p className="text-muted-foreground mt-1">Visualização e gestão da rede de patrocínio</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <Button
              onClick={() => {
                setCreateRevendedorId('')
                setCreatePatrocinadorId('')
                setCreateDialogOpen(true)
              }}
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Adicionar Vínculo
            </Button>
          )}
          <Button variant="outline" onClick={handleExportCSV} size="sm">
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* ─── Stats Dashboard ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">Membros Ativos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {patrociniosLoading ? (
                <span className="inline-block h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                stats.totalAtivos
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">Níveis de Profundidade</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {patrociniosLoading ? (
                <span className="inline-block h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                stats.maxNivel
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-state-success" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">Patrocinadores Únicos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {patrociniosLoading ? (
                <span className="inline-block h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                stats.patrocinadoresUnicos
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="h-4 w-4 text-state-warning" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">Sem Subordinados</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {treeLoading ? (
                <span className="inline-block h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                stats.folhas
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── CSV Export Options (collapsible) ─── */}
      <Card className="border-border/50 mb-6">
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-xs font-medium text-muted-foreground shrink-0">Opções de Exportação:</p>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={csvExportHistorico}
                  onChange={(e) => setCsvExportHistorico(e.target.checked)}
                  className="rounded border-border"
                />
                Incluir inativos/histórico
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Filtrar nível:</Label>
                <Select value={csvExportNivel} onValueChange={setCsvExportNivel}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableLevels.map(l => (
                      <SelectItem key={l} value={String(l)}>Nível {l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="arvore" className="gap-1.5">
            <TreePine className="h-3.5 w-3.5" />
            Árvore
          </TabsTrigger>
          <TabsTrigger value="subordinados" className="gap-1.5" disabled={!selectedRevendedor}>
            <Users className="h-3.5 w-3.5" />
            Subordinados
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5" disabled={!historicoRevendedorId}>
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ─── Árvore Tab ─── */}
        <TabsContent value="arvore">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {treeLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTrees.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-muted-foreground">
                  {treeSearch ? 'Nenhum resultado encontrado para a busca' : 'Nenhum membro na rede'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {treeSearch
                      ? `${countNodes(filteredTrees)} resultado${countNodes(filteredTrees) !== 1 ? 's' : ''} encontrado${countNodes(filteredTrees) !== 1 ? 's' : ''}`
                      : `${countNodes(trees)} membro${countNodes(trees) !== 1 ? 's' : ''} na rede`
                    }
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {availableLevels.map(l => {
                      const countInTree = countAtLevel(trees, l)
                      return countInTree > 0 ? (
                        <Badge key={l} className={`text-[10px] px-1.5 py-0 ${getLevelColor(l)}`}>
                          N{l}: {countInTree}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-0.5" role="tree">
                  {filteredTrees.map((tree) => (
                    <TreeNodeItem
                      key={tree.id}
                      node={tree}
                      isSuperAdmin={isSuperAdmin}
                      onRealocar={handleRealocar}
                      onViewSubordinados={handleViewSubordinados}
                      onViewHistorico={handleViewHistorico}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Subordinados Tab ─── */}
        <TabsContent value="subordinados">
          {selectedRevendedor ? (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      Subordinados de {selectedRevendedor.nomeCompleto}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCPF(selectedRevendedor.cpf || '')} — Nível {selectedRevendedor.nivelProfundidade}
                    </p>
                  </div>
                  <Select value={subordinadosTipo} onValueChange={(v) => { setSubordinadosTipo(v as 'diretos' | 'indiretos' | 'todos'); setSubordinadosPage(1) }}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diretos">Diretos</SelectItem>
                      <SelectItem value="indiretos">Indiretos</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {subordinadosLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !subordinadosData?.data || subordinadosData.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum subordinado encontrado</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                      {subordinadosData.data.map((sub) => (
                        <div
                          key={sub.patrocinioId}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground truncate">{sub.nomeCompleto}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${getLevelColor(sub.nivelProfundidade)}`}>
                                N{sub.nivelProfundidade}
                              </Badge>
                              {sub.relacao === 'direto' ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Direto</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Indireto</Badge>
                              )}
                            </div>
                            {sub.cpf && (
                              <p className="text-xs text-muted-foreground">{formatCPF(sub.cpf)}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatDate(sub.dataEntrada)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {subordinadosData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={subordinadosPage <= 1}
                          onClick={() => setSubordinadosPage(p => p - 1)}
                        >
                          Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {subordinadosPage} / {subordinadosData.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={subordinadosPage >= subordinadosData.pagination.totalPages}
                          onClick={() => setSubordinadosPage(p => p + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-muted-foreground">Selecione um membro na árvore para ver seus subordinados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Histórico Tab ─── */}
        <TabsContent value="historico">
          {historicoRevendedorId ? (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                {historicoData ? (
                  <div>
                    <CardTitle className="text-base">
                      Histórico de {historicoData.revendedor.nomeCompleto}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCPF(historicoData.revendedor.cpf || '')} — {historicoData.total} registro{historicoData.total !== 1 ? 's' : ''} ({historicoData.ativos} ativo{historicoData.ativos !== 1 ? 's' : ''}, {historicoData.realocacoes} realocação{historicoData.realocacoes !== 1 ? 'ões' : ''})
                    </p>
                  </div>
                ) : (
                  <CardTitle className="text-base">Histórico de Patrocínio</CardTitle>
                )}
              </CardHeader>
              <CardContent>
                {historicoLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !historicoData?.historico || historicoData.historico.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum histórico encontrado</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                    {historicoData.historico.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg border ${
                          entry.ativo
                            ? 'bg-state-success/5 border-state-success/20'
                            : 'bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground">
                                Patrocinador: {entry.patrocinadorNome}
                              </span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${getLevelColor(entry.nivelProfundidade)}`}>
                                Nível {entry.nivelProfundidade}
                              </Badge>
                              {entry.ativo ? (
                                <Badge className="text-[10px] px-1.5 py-0 bg-state-success/10 text-state-success">Ativo</Badge>
                              ) : (
                                <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">Inativo</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>Entrada: {formatDate(entry.dataEntrada)}</span>
                              {entry.dataFimVinculo && (
                                <span>Fim: {formatDate(entry.dataFimVinculo)}</span>
                              )}
                            </div>
                            {entry.motivoRealocacao && (
                              <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                                <strong>Motivo:</strong> {entry.motivoRealocacao}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-muted-foreground">Selecione um membro na árvore para ver seu histórico</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Patrocínio Dialog ─── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Vínculo de Patrocínio</DialogTitle>
            <DialogDescription>
              Crie um novo vínculo entre revendedor e patrocinador na rede.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Revendedor */}
            <div className="space-y-2">
              <Label htmlFor="create-revendedor">Revendedor</Label>
              <Select value={createRevendedorId} onValueChange={setCreateRevendedorId}>
                <SelectTrigger id="create-revendedor">
                  <SelectValue placeholder="Selecione o revendedor..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableRevendedores.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Nenhum revendedor disponível (sem vínculo ativo)
                    </div>
                  ) : (
                    availableRevendedores.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nomeCompleto}{p.cpf ? ` — ${formatCPF(p.cpf)}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apenas pessoas sem vínculo ativo na rede
              </p>
            </div>

            {/* Patrocinador */}
            <div className="space-y-2">
              <Label htmlFor="create-patrocinador">Patrocinador</Label>
              <Select value={createPatrocinadorId} onValueChange={setCreatePatrocinadorId}>
                <SelectTrigger id="create-patrocinador">
                  <SelectValue placeholder="Selecione o patrocinador..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availablePatrocinadores
                    .filter(p => p.id !== createRevendedorId)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nomeCompleto}{p.cpf ? ` — ${formatCPF(p.cpf)}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Membros ativos na rede ou raízes
              </p>
            </div>

            {/* Nível Preview */}
            {createNivelPreview !== null && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Badge className={getLevelColor(createNivelPreview)}>
                  Nível {createNivelPreview}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Nível de profundidade que será atribuído
                </span>
              </div>
            )}

            {/* Air-Gap Note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-state-success/5 border border-state-success/20">
              <Shield className="h-4 w-4 text-state-success mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-state-success">
                Este sistema não gerencia metas, horários ou relações de subordinação trabalhista.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!createRevendedorId || !createPatrocinadorId || createSubmitting}
            >
              {createSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Realocação Dialog ─── */}
      <Dialog open={realocarDialogOpen} onOpenChange={setRealocarDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Realocar Membro</DialogTitle>
            <DialogDescription>
              Move {realocarNode?.nomeCompleto || 'o membro'} para um novo patrocinador na rede.
            </DialogDescription>
          </DialogHeader>

          {realocarNode && (
            <div className="space-y-4 py-2">
              {/* Current info */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm font-medium text-foreground">{realocarNode.nomeCompleto}</p>
                {realocarNode.cpf && (
                  <p className="text-xs text-muted-foreground">{formatCPF(realocarNode.cpf)}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-[10px] px-1.5 py-0 ${getLevelColor(realocarNode.nivelProfundidade)}`}>
                    Nível atual: {realocarNode.nivelProfundidade}
                  </Badge>
                  {realocarSubordinadosCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {realocarSubordinadosCount} subordinado{realocarSubordinadosCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>

              {/* New Patrocinador */}
              <div className="space-y-2">
                <Label htmlFor="realocar-patrocinador">Novo Patrocinador</Label>
                <Select value={realocarNovoPatrocinadorId} onValueChange={setRealocarNovoPatrocinadorId}>
                  <SelectTrigger id="realocar-patrocinador">
                    <SelectValue placeholder="Selecione o novo patrocinador..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availablePatrocinadores
                      .filter(p => p.id !== realocarNode.revendedorId)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nomeCompleto}{p.cpf ? ` — ${formatCPF(p.cpf)}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Motivo */}
              <div className="space-y-2">
                <Label htmlFor="realocar-motivo">Motivo da Realocação</Label>
                <Textarea
                  id="realocar-motivo"
                  placeholder="Descreva o motivo da realocação (mín. 10 caracteres)..."
                  value={realocarMotivo}
                  onChange={(e) => setRealocarMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {realocarMotivo.length}/500 caracteres (mínimo 10)
                </p>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-state-warning/5 border border-state-warning/20">
                <AlertTriangle className="h-4 w-4 text-state-warning mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-state-warning">
                  A realocação recalculará automaticamente a profundidade de todos os subordinados em cascata.
                </p>
              </div>

              {/* Air-Gap Note */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-state-success/5 border border-state-success/20">
                <Shield className="h-4 w-4 text-state-success mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-state-success">
                  Este sistema não gerencia metas, horários ou relações de subordinação trabalhista.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRealocarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                !realocarNovoPatrocinadorId ||
                realocarMotivo.length < 10 ||
                realocarSubmitting
              }
              onClick={() => setRealocarConfirmOpen(true)}
            >
              Realocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Realocação Confirmation ─── */}
      <AlertDialog open={realocarConfirmOpen} onOpenChange={setRealocarConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Realocação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação é atômica e afetará{' '}
              <strong>{realocarSubordinadosCount} subordinado{realocarSubordinadosCount !== 1 ? 's' : ''}</strong>.
              A profundidade de todos os membros abaixo será recalculada em cascata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRealocarSubmit}
              disabled={realocarSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {realocarSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Realocação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Utility: count nodes at a specific level ───

function countAtLevel(nodes: TreeNode[], level: number): number {
  let count = 0
  for (const node of nodes) {
    if (node.nivelProfundidade === level) count++
    count += countAtLevel(node.subordinados, level)
  }
  return count
}
