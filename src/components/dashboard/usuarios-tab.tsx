'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Loader2,
  AlertTriangle,
  UserCircle,
  KeyRound,
  Power,
  PowerOff,
  Search,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface UserRecord {
  id: string
  nome: string
  email: string
  role: 'SUPERADMIN' | 'SUPERVISOR' | 'FINANCEIRO' | 'SUPORTE' | 'CLIENTE'
  ativo: boolean
  pessoaFisicaId: string | null
  createdAt: string
}

const ROLES = ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE', 'CLIENTE'] as const

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'SuperAdmin',
  SUPERVISOR: 'Supervisor',
  FINANCEIRO: 'Financeiro',
  SUPORTE: 'Suporte',
  CLIENTE: 'Cliente',
}

const emptyForm = { nome: '', email: '', role: 'SUPORTE' as UserRecord['role'], senha: '' }

export function UsuariosTab() {
  const queryClient = useQueryClient()
  const user = useAppStore((s) => s.user)
  const activeProfile = useAppStore((s) => s.activeProfile)
  const profile = activeProfile ?? user?.role

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetUserName, setResetUserName] = useState('')
  const [novaSenha, setNovaSenha] = useState<string | null>(null)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const queryParams = new URLSearchParams()
  if (search) queryParams.set('search', search)
  if (roleFilter) queryParams.set('role', roleFilter)
  if (statusFilter) queryParams.set('ativo', statusFilter)

  const { data: usuarios = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ['usuarios-admin', search, roleFilter, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/usuarios?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar usuários')
      return res.json()
    },
  })

  if (profile !== 'SUPERADMIN') {
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
    setFormOpen(true)
  }

  const openEdit = (u: UserRecord) => {
    setEditingId(u.id)
    setForm({ nome: u.nome, email: u.email, role: u.role, senha: '' })
    setFormError('')
    setFormOpen(true)
  }

  const openReset = (u: UserRecord) => {
    setResetUserId(u.id)
    setResetUserName(u.nome)
    setNovaSenha(null)
    setResetOpen(true)
  }

  const validateForm = (): boolean => {
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      setFormError('Nome deve ter entre 2 e 100 caracteres.')
      return false
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('Email inválido.')
      return false
    }
    if (!form.role || !ROLES.includes(form.role)) {
      setFormError('Selecione um perfil válido.')
      return false
    }
    if (!editingId && (!form.senha || form.senha.length < 4)) {
      setFormError('Senha deve ter no mínimo 4 caracteres.')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    setFormError('')
    try {
      const url = editingId ? `/api/usuarios/${editingId}` : '/api/usuarios'
      const method = editingId ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
      }
      if (!editingId) body.senha = form.senha

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] })
        setFormOpen(false)
        setForm(emptyForm)
        setToast({
          message: editingId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!',
          type: 'success',
        })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao salvar usuário' }))
        setFormError(errData.error || 'Erro ao salvar usuário')
      }
    } catch {
      setFormError('Erro de conexão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (u: UserRecord) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] })
        setToast({
          message: u.ativo ? 'Usuário desativado.' : 'Usuário ativado.',
          type: 'success',
        })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao alterar status' }))
        setToast({ message: errData.error || 'Erro ao alterar status', type: 'error' })
      }
    } catch {
      setToast({ message: 'Erro de conexão', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUserId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/usuarios/${resetUserId}/reset-senha`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setNovaSenha(data.novaSenha)
        setToast({ message: 'Senha resetada com sucesso!', type: 'success' })
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro ao resetar senha' }))
        setToast({ message: errData.error || 'Erro ao resetar senha', type: 'error' })
        setResetOpen(false)
      }
    } catch {
      setToast({ message: 'Erro de conexão', type: 'error' })
      setResetOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de usuários e perfis do sistema</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filtrar por perfil"
        >
          <option value="">Todos os perfis</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : usuarios.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <UserCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Nome</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Perfil</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Criado em</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        u.role === 'SUPERADMIN' ? 'bg-brand-primary/10 text-brand-primary' :
                        u.role === 'FINANCEIRO' ? 'bg-state-warning/10 text-state-warning' :
                        'bg-muted text-muted-foreground'
                      }>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={
                        u.ativo ? 'bg-state-success/10 text-state-success' : 'bg-state-error/10 text-state-error'
                      }>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => openEdit(u)}
                          aria-label={`Editar ${u.nome}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => openReset(u)}
                          aria-label={`Resetar senha de ${u.nome}`}
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 px-2 ${!u.ativo ? 'text-state-success' : 'text-state-error'}`}
                          onClick={() => handleToggleActive(u)}
                          disabled={isSubmitting || u.id === user?.id}
                          aria-label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
                          title={u.id === user?.id ? 'Você não pode desativar seu próprio usuário' : undefined}
                        >
                          {u.ativo ? <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados do usuário' : 'Preencha os dados do novo usuário'}
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
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Perfil *</label>
              <select
                value={form.role}
                onChange={(e) => setForm(f => ({ ...f, role: e.target.value as UserRecord['role'] }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {!editingId && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Senha *</label>
                <input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm(f => ({ ...f, senha: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Mínimo 4 caracteres"
                />
              </div>
            )}

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
              {editingId ? 'Salvar Alterações' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => { if (!v) { setResetOpen(false); setNovaSenha(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
          </DialogHeader>
          {novaSenha ? (
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Senha gerada para <span className="font-semibold text-foreground">{resetUserName}</span>:
              </p>
              <div className="flex items-center justify-center p-3 rounded-md bg-muted">
                <code className="text-lg font-mono font-bold tracking-wider text-brand-primary">{novaSenha}</code>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Copie esta senha e compartilhe com o usuário. Esta é a única oportunidade de visualizá-la.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(novaSenha)
                  setToast({ message: 'Senha copiada!', type: 'success' })
                }}
              >
                Copiar Senha
              </Button>
            </div>
          ) : (
            <>
              <DialogDescription className="py-2">
                Uma nova senha será gerada para <span className="font-semibold text-foreground">{resetUserName}</span>.
                Deseja continuar?
              </DialogDescription>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleResetPassword} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-state-success text-primary-foreground' : 'bg-state-error text-primary-foreground'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
