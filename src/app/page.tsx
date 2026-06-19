'use client'

import { useAppStore } from '@/lib/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

// Landing
import { Header } from '@/components/landing/header'
import { HeroSection } from '@/components/landing/hero-section'
import { StorytellingSection } from '@/components/landing/storytelling-section'
import { SolutionSection } from '@/components/landing/solution-section'
import { FaqSection } from '@/components/landing/faq-section'
import { UrgencySection } from '@/components/landing/urgency-section'
import { ComplianceFooter } from '@/components/landing/compliance-footer'
import dynamic from 'next/dynamic'

// CookieConsent carregado sem SSR para evitar hydration mismatch (localStorage)
const CookieConsent = dynamic(
  () => import('@/components/landing/cookie-consent').then(mod => ({ default: mod.CookieConsent })),
  { ssr: false }
)

// Checkout
import { CheckoutFlow } from '@/components/checkout/checkout-flow'

// Auth
import { LoginModal } from '@/components/auth/login-modal'

// Dashboard
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { OverviewTab } from '@/components/dashboard/overview-tab'
import { ApprovalTab } from '@/components/dashboard/approval-tab'
import { ContractsTab } from '@/components/dashboard/contracts-tab'
import { FinancialTab } from '@/components/dashboard/financial-tab'
import { NetworkTab } from '@/components/dashboard/network-tab'
import { ClaimsTab } from '@/components/dashboard/claims-tab'
import { ConfigTab } from '@/components/dashboard/config-tab'
import { AuditTab } from '@/components/dashboard/audit-tab'
import { SeguradorasTab } from '@/components/dashboard/seguradoras-tab'

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Link para pular para o conteúdo principal (acessibilidade) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Pular para o conteúdo principal
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        <noscript>
          <div className="bg-state-warning/10 border border-state-warning/30 text-foreground p-4 text-center text-sm">
            Habilite o JavaScript para contratar o Plano Granpaz.
          </div>
        </noscript>
        <HeroSection />
        <StorytellingSection />
        <SolutionSection />
        <FaqSection />
        <UrgencySection />
      </main>
      <ComplianceFooter />
    </div>
  )
}

function DashboardContent() {
  const { currentDashboardTab } = useAppStore()

  const tabs: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    approval: <ApprovalTab />,
    contracts: <ContractsTab />,
    financial: <FinancialTab />,
    network: <NetworkTab />,
    claims: <ClaimsTab />,
    config: <ConfigTab />,
    seguradoras: <SeguradorasTab />,
    audit: <AuditTab />,
  }

  return (
    <DashboardLayout>
      {tabs[currentDashboardTab] || <OverviewTab />}
    </DashboardLayout>
  )
}

function AppContent() {
  const { currentView } = useAppStore()

  switch (currentView) {
    case 'landing':
      return <LandingPage />
    case 'checkout':
      return <CheckoutFlow />
    case 'login':
      return <LoginModal />
    case 'dashboard':
      return <DashboardContent />
    default:
      return <LandingPage />
  }
}

export default function Home() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <CookieConsent />
    </QueryClientProvider>
  )
}
