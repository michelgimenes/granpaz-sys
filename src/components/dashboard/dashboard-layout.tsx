'use client'

import { useAppStore, type DashboardTab } from '@/lib/store'
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
} from 'lucide-react'
import { useState } from 'react'

const navItems: Array<{ id: DashboardTab; label: string; icon: React.ElementType; roles: string[] }> = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard, roles: ['SUPERADMIN', 'SUPERVISOR', 'FINANCEIRO', 'SUPORTE'] },
  { id: 'approval', label: 'Aprovações', icon: CheckSquare, roles: ['SUPERADMIN', 'SUPERVISOR'] },
  { id: 'contracts', label: 'Contratos', icon: FileText, roles: ['SUPERADMIN', 'SUPERVISOR', 'SUPORTE'] },
  { id: 'financial', label: 'Financeiro', icon: Wallet, roles: ['SUPERADMIN', 'FINANCEIRO'] },
  { id: 'network', label: 'Rede / Patrocínio', icon: Network, roles: ['SUPERADMIN', 'SUPERVISOR'] },
  { id: 'claims', label: 'Sinistros', icon: AlertTriangle, roles: ['SUPERADMIN', 'SUPERVISOR', 'SUPORTE'] },
  { id: 'config', label: 'Configurações', icon: Settings, roles: ['SUPERADMIN'] },
  { id: 'audit', label: 'Auditoria', icon: ScrollText, roles: ['SUPERADMIN'] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, currentDashboardTab, setDashboardTab, logout } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)

  const filteredNav = navItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-[var(--gran-sidebar)] text-white flex flex-col transition-all duration-300 shrink-0`}
        role="navigation"
        aria-label="Menu principal"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
          <Shield className="h-6 w-6 text-[var(--gran-accent)] shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="font-serif text-lg font-bold text-white tracking-tight">Granpaz</span>
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
                        ? 'bg-[var(--gran-sidebar-active)] text-white sidebar-active-indicator'
                        : 'text-white/70 hover:bg-[var(--gran-sidebar-hover)] hover:text-white'
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

        {/* Collapse toggle */}
        <div className="px-2 py-2 border-t border-white/10">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[var(--gran-sidebar-hover)] transition-colors"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>

        {/* User info & Logout */}
        <div className="px-2 py-3 border-t border-white/10">
          {!collapsed && user && (
            <div className="px-3 mb-2">
              <p className="text-sm font-medium text-white truncate">{user.nome}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
              <p className="text-xs text-[var(--gran-accent)] mt-0.5">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-state-error hover:bg-[var(--gran-sidebar-hover)] transition-colors"
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
