import { create } from 'zustand'

export type View = 'landing' | 'checkout' | 'login' | 'dashboard'
export type DashboardTab = 'overview' | 'approval' | 'contracts' | 'financial' | 'network' | 'claims' | 'config' | 'audit'

export interface User {
  id: string
  nome: string
  email: string
  role: 'SUPERADMIN' | 'SUPERVISOR' | 'FINANCEIRO' | 'SUPORTE' | 'CLIENTE'
  pessoaFisicaId?: string | null
  ativo: boolean
}

interface AppStore {
  // Navigation
  currentView: View
  currentDashboardTab: DashboardTab
  checkoutStep: number
  
  // User
  user: User | null
  
  // Actions
  setView: (view: View) => void
  setDashboardTab: (tab: DashboardTab) => void
  setCheckoutStep: (step: number) => void
  setUser: (user: User | null) => void
  logout: () => void
  
  // Checkout data
  selectedPlanId: string | null
  setSelectedPlanId: (id: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'landing',
  currentDashboardTab: 'overview',
  checkoutStep: 0,
  user: null,
  selectedPlanId: null,
  
  setView: (view) => set({ currentView: view }),
  setDashboardTab: (tab) => set({ currentDashboardTab: tab }),
  setCheckoutStep: (step) => set({ checkoutStep: step }),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, currentView: 'landing', currentDashboardTab: 'overview' }),
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
}))
