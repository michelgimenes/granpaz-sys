import { create } from 'zustand'

export type View = 'landing' | 'checkout' | 'login' | 'dashboard'
export type DashboardTab = 'overview' | 'approval' | 'contracts' | 'financial' | 'network' | 'claims' | 'config' | 'audit' | 'seguradoras'

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
  checkoutData: {
    titular: Record<string, unknown> | null
    vinculos: Array<Record<string, unknown>>
    selectedPlan: Record<string, unknown> | null
  }
  setCheckoutData: (data: Partial<AppStore['checkoutData']>) => void
  resetCheckout: () => void

  // Feature flags
  featureFlags: {
    newCheckoutFlow: boolean
    marketingPixels: boolean
  }
  setFeatureFlag: (flag: keyof AppStore['featureFlags'], value: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'landing',
  currentDashboardTab: 'overview',
  checkoutStep: 0,
  user: null,
  selectedPlanId: null,
  checkoutData: {
    titular: null,
    vinculos: [],
    selectedPlan: null,
  },
  featureFlags: {
    newCheckoutFlow: true,  // Habilitado por padrão
    marketingPixels: false, // Desabilitado até consentimento de cookies
  },
  
  setView: (view) => set({ currentView: view }),
  setDashboardTab: (tab) => set({ currentDashboardTab: tab }),
  setCheckoutStep: (step) => set({ checkoutStep: step }),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, currentView: 'landing', currentDashboardTab: 'overview' }),
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
  setCheckoutData: (data) => set((state) => ({ checkoutData: { ...state.checkoutData, ...data } })),
  resetCheckout: () => {
    // RN-05: Limpar dados sensíveis do localStorage/sessionStorage
    if (typeof window !== 'undefined') {
      // Preservar parâmetros UTM do sessionStorage
      const utmKeys: Array<string> = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('utm_')) utmKeys.push(key)
      }
      const utmValues: Record<string, string> = {}
      utmKeys.forEach(key => {
        const val = sessionStorage.getItem(key)
        if (val) utmValues[key] = val
      })
      
      // Limpar todo o session storage
      sessionStorage.clear()
      
      // Restaurar parâmetros UTM preservados
      Object.entries(utmValues).forEach(([key, val]) => {
        sessionStorage.setItem(key, val)
      })
      
      // Limpar chaves do localStorage relacionadas ao checkout
      localStorage.removeItem('checkout_titular')
      localStorage.removeItem('checkout_vinculos')
      localStorage.removeItem('checkout_plan')
    }
    
    set({
      checkoutStep: 0,
      selectedPlanId: null,
      checkoutData: {
        titular: null,
        vinculos: [],
        selectedPlan: null,
      },
    })
  },
  setFeatureFlag: (flag, value) => set((state) => ({
    featureFlags: { ...state.featureFlags, [flag]: value }
  })),
}))
