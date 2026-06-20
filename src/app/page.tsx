'use client'

import { useAppStore } from '@/lib/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import dynamic from 'next/dynamic'

import { Header } from '@/components/landing/header'
import { HeroSection } from '@/components/landing/hero-section'
import { StorytellingSection } from '@/components/landing/storytelling-section'
import { SolutionSection } from '@/components/landing/solution-section'
import { FaqSection } from '@/components/landing/faq-section'
import { UrgencySection } from '@/components/landing/urgency-section'
import { ComplianceFooter } from '@/components/landing/compliance-footer'

const CookieConsent = dynamic(
  () => import('@/components/landing/cookie-consent').then(mod => ({ default: mod.CookieConsent })),
  { ssr: false }
)
const CheckoutFlow = dynamic(
  () => import('@/components/checkout/checkout-flow').then(mod => ({ default: mod.CheckoutFlow })),
  { ssr: false }
)
const LoginModal = dynamic(
  () => import('@/components/auth/login-modal').then(mod => ({ default: mod.LoginModal })),
  { ssr: false }
)
const DashboardContent = dynamic(
  () => import('@/components/app/dashboard-content').then(mod => ({ default: mod.DashboardContent })),
  { ssr: false }
)

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
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

function AppContent() {
  const { currentView } = useAppStore()
  switch (currentView) {
    case 'checkout': return <CheckoutFlow />
    case 'login': return <LoginModal />
    case 'dashboard': return <DashboardContent />
    default: return <LandingPage />
  }
}

export default function Home() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  }))
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <CookieConsent />
    </QueryClientProvider>
  )
}
