'use client'

import { useAppStore, type DashboardTab } from '@/lib/store'
import { ProfileSwitcher } from './profile-switcher'
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Wallet,
  Network,
  AlertTriangle,
  Settings,
  ScrollText,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserCircle,
  Home,
  HandCoins,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

const navItems: Array<{ id: DashboardTab; label: string; icon: React.ElementType; roles: string[] }> = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard, roles: ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE', 'CLIENTE'] },
  { id: 'approval', label: 'Aprovações', icon: CheckSquare, roles: ['SUPERADMIN', 'SUPERVISOR'] },
  { id: 'contracts', label: 'Contratos', icon: FileText, roles: ['SUPERADMIN', 'SUPERVISOR', 'SUPORTE'] },
  { id: 'financial', label: 'Financeiro', icon: Wallet, roles: ['SUPERADMIN', 'FINANCEIRO'] },
  { id: 'network', label: 'Rede / Patrocínio', icon: Network, roles: ['SUPERADMIN', 'SUPERVISOR'] },
  { id: 'claims', label: 'Sinistros', icon: AlertTriangle, roles: ['SUPERADMIN', 'SUPERVISOR', 'SUPORTE'] },
  { id: 'config', label: 'Configurações', icon: Settings, roles: ['SUPERADMIN'] },
  { id: 'seguradoras', label: 'Seguradoras', icon: Building2, roles: ['SUPERADMIN'] },
  { id: 'audit', label: 'Auditoria', icon: ScrollText, roles: ['SUPERADMIN'] },
  // ─── Itens exclusivos do perfil CLIENTE ───
  { id: 'meus-dados', label: 'Meus Dados', icon: UserCircle, roles: ['CLIENTE'] },
  { id: 'meu-plano', label: 'Meu Plano', icon: Home, roles: ['CLIENTE'] },
  { id: 'minha-carteira', label: 'Minha Carteira', icon: HandCoins, roles: ['CLIENTE'] },
  { id: 'minhas-indicacoes', label: 'Minhas Indicações', icon: UserPlus, roles: ['CLIENTE'] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, activeProfile, currentDashboardTab, setDashboardTab, logout } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)

  const profile = activeProfile ?? user?.role
  const filteredNav = navItems.filter(item =>
    profile && item.roles.includes(profile)
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-gran-sidebar text-primary-foreground flex flex-col transition-all duration-300 shrink-0`}
        role="navigation"
        aria-label="Menu principal"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-primary-foreground/10">
          <Shield className="h-6 w-6 text-gran-accent shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="font-serif text-lg font-bold text-primary-foreground tracking-tight">Granpaz</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <ul className="space-y-1 px-2">
            {filteredNav.map((item) => {
              const Icon = item.icon
              const isActive = currentDashboardTab === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setDashboardTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gran-sidebar-active text-primary-foreground sidebar-active-indicator'
                        : 'text-primary-foreground/70 hover:bg-gran-sidebar-hover hover:text-primary-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profile Switcher (dev only — SUPERADMIN) */}
        <ProfileSwitcher />

        {/* Collapse toggle */}
        <div className="px-2 py-2 border-t border-primary-foreground/10">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-primary-foreground/50 hover:text-primary-foreground hover:bg-gran-sidebar-hover transition-colors"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>

        {/* User info & Logout */}
        <div className="px-2 py-3 border-t border-primary-foreground/10">
          {!collapsed && user && (
            <div className="px-3 mb-2">
              <p className="text-sm font-medium text-primary-foreground truncate">{user.nome}</p>
              <p className="text-xs text-primary-foreground/50 truncate">{user.email}</p>
              <p className="text-xs text-gran-accent mt-0.5">{activeProfile ?? user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-foreground/50 hover:text-state-error hover:bg-gran-sidebar-hover transition-colors"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
