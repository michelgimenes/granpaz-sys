'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Building2,
  Phone,
  FileText,
  Eye,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface Seguradora {
  id: string
  nome: string
  cnpj: string
  codigoSeguradora: string
  telefoneSinistro: string
  processoSusep: string | null
  clausulasMarkdown: string | null
  ativa: boolean
  createdAt: string
}

const emptyForm = {
  nome: '',
  cnpj: '',
  codigoSeguradora: '',
  telefoneSinistro: '',
  processoSusep: '',
  clausulasMarkdown: '',
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/** Basic markdown renderer: headers, bold, lists */
function renderMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-foreground mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-foreground mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-foreground">• $1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-sm text-foreground list-decimal">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '<br/><br/>')
    // Single newline
    .replace(/\n/g, '<br/>')

  return html
}

export function SeguradorasTab() {
  const queryClient = useQueryClient()
  const user = useAppStore((s) => s.user)

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNome, setDeleteNome] = useState('')

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const { data: seguradoras = [], isLoading } = useQuery<Seguradora[]>({
    queryKey: ['seguradoras-admin'],
    queryFn: async () => {
      const res = await fetch('/api/seguradoras')
      if (!res.ok) throw new Error('Erro ao carregar seguradoras')
      return res.json()
    },
  })

  // SuperAdmin check
  if (user?.role !== 'SUPERADMIN') {
    return (
      <div className="animate-fade-up">
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-state-error mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Acesso restrito a SuperAdmin</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowPreview(false)
    setFormOpen(true)
  }

  const openEdit = (seg: Seguradora) => {
    setEditingId(seg.id)
    setForm({
      nome: seg.nome,
      cnpj: seg.cnpj,
      codigoSeguradora: seg.codigoSeguradora,
      telefoneSinistro: seg.telefoneSinistro,
      processoSusep: seg.processoSusep || '',
      clausulasMarkdown: seg.clausulasMarkdown || '',
    })
    setFormError('')
    setShowPreview(false)
    setFormOpen(true)
  }

  const openDelete = (seg: Seguradora) => {
    setDeleteId(seg.id)
    setDeleteNome(seg.nome)
    setDeleteOpen(true)
  }

  const validateForm = (): boolean => {
    if (!form.nome.trim()) {
      setFormError('Nome é obrigatório.')
      return false
    }
    const cnpjDigits = form.cnpj.replace(/\D/g, '')
    if (cnpjDigits.length !== 14) {
      setFormError('CNPJ deve ter 14 dígitos.')
      return false
    }
    if (!form.codigoSeguradora.trim()) {
      setFormError('Código da Seguradora é obrigatório.')
      return false
    }
    if (!/^[A-Z0-9]+$/.test(form.codigoSeguradora.toUpperCase())) {
      setFormError('Código da Seguradora deve ser alfanumérico (maiúsculas e números).')
      return false
    }
    const phoneDigits = form.telefoneSinistro.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setFormError('Telefone deve ter 10 ou 11 dígitos.')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    setFormError('')
    try {
      const body = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.replace(/\D/g, ''),
        codigoSeguradora: form.codigoSeguradora.toUpperCase().trim(),
        telefoneSinistro: form.telefoneSinistro.replace(/\D/g, ''),
        processoSusep: form.processoSusep.trim() || null,
        clausulasMarkdown: form.clausulasMarkdown.trim() || null,
      }

      const url = editingId ? `/api/seguradoras/${editingId}` : '/api/seguradoras'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['seguradoras-admin'] })
        setFormOpen(false)
        setForm(emptyForm)
        setToast({
          message: editingId ? 'Seguradora atualizada com sucesso!' : 'Seguradora criada com sucesso!',
          type: 'success',
        })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao salvar seguradora' }))
        setFormError(errData.error || 'Erro ao salvar seguradora')
      }
    } catch {
      setFormError('Erro de conexão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/seguradoras/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['seguradoras-admin'] })
        setDeleteOpen(false)
        setDeleteId(null)
        setToast({ message: 'Seguradora removida com sucesso!', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao remover seguradora' }))
        setToast({ message: errData.error || 'Erro ao remover seguradora', type: 'error' })
      }
    } catch {
      setToast({ message: 'Erro de conexão', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Seguradoras</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de seguradoras parceiras</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Adicionar Seguradora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : seguradoras.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhuma seguradora cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {seguradoras.map((seg) => (
            <Card key={seg.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <CardTitle className="text-sm">{seg.nome}</CardTitle>
                  </div>
                  <Badge className={seg.ativa ? 'bg-state-success/10 text-state-success' : 'bg-muted text-muted-foreground'}>
                    {seg.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">CNPJ:</span>
                    <span className="font-mono text-foreground">{formatCNPJ(seg.cnpj)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Código:</span>
                    <span className="font-mono text-foreground">{seg.codigoSeguradora}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="text-foreground">{formatPhoneDisplay(seg.telefoneSinistro)}</span>
                  </div>
                  {seg.processoSusep && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">SUSEP:</span>
                      <span className="font-mono text-foreground">{seg.processoSusep}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(seg)}>
                    <Pencil className="h-3 w-3 mr-1" aria-hidden="true" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-state-error hover:text-state-error"
                    onClick={() => openDelete(seg)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Seguradora' : 'Nova Seguradora'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados da seguradora' : 'Preencha os dados da nova seguradora'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Nome da seguradora"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">CNPJ *</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                  setForm(f => ({ ...f, cnpj: formatCNPJ(digits) }))
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Código Seguradora *</label>
              <input
                type="text"
                value={form.codigoSeguradora}
                onChange={(e) => setForm(f => ({ ...f, codigoSeguradora: e.target.value.toUpperCase() }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="COD001"
              />
              <p className="text-xs text-muted-foreground mt-0.5">Alfanumérico maiúsculo</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Telefone Sinistro *</label>
              <input
                type="text"
                value={form.telefoneSinistro}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                  setForm(f => ({ ...f, telefoneSinistro: formatPhoneDisplay(digits) }))
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Processo SUSEP</label>
              <input
                type="text"
                value={form.processoSusep}
                onChange={(e) => setForm(f => ({ ...f, processoSusep: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Opcional"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Cláusulas (Markdown)</label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <><FileText className="h-3 w-3 mr-1" aria-hidden="true" /> Editar</>
                  ) : (
                    <><Eye className="h-3 w-3 mr-1" aria-hidden="true" /> Visualizar</>
                  )}
                </Button>
              </div>
              {showPreview ? (
                <div
                  className="min-h-[100px] p-3 rounded-md border border-input bg-muted/30 text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: form.clausulasMarkdown
                      ? renderMarkdown(form.clausulasMarkdown)
                      : '<p class="text-muted-foreground">Nenhuma cláusula informada</p>'
                  }}
                />
              ) : (
                <Textarea
                  value={form.clausulasMarkdown}
                  onChange={(e) => setForm(f => ({ ...f, clausulasMarkdown: e.target.value }))}
                  placeholder="## Cláusulas do Seguro&#10;&#10;**Importante:** Descreva as cláusulas aqui...&#10;&#10;- Item 1&#10;- Item 2"
                  className="min-h-[120px] font-mono text-sm"
                />
              )}
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-state-error bg-state-error/10 p-2 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              )}
              {editingId ? 'Salvar Alterações' : 'Criar Seguradora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a seguradora <span className="font-semibold text-foreground">{deleteNome}</span>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
              )}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-state-success text-white' : 'bg-state-error text-white'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
