'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Shield, ArrowRight } from 'lucide-react'
import copy from '@/lib/copy.json'

export function HeroSection() {
  const { setView } = useAppStore()

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden" aria-label="Seção principal">
      {/* Gradiente de fundo overlay */}
      <div className="hero-gradient absolute inset-0" aria-hidden="true" />

      {/* Elementos decorativos */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-3xl">
          {/* Pre-headline */}
          <p className="text-sm sm:text-base font-semibold tracking-widest text-primary uppercase mb-4 animate-fade-up">
            {copy.hero.preHeadline}
          </p>

          {/* Headline */}
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {copy.hero.headline}{' '}
            <span className="text-primary">
              {copy.hero.headlineHighlight}
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Com o <strong className="text-foreground">Plano Granpaz</strong>, você garante assistência funeral completa em todo o Brasil e amparo financeiro em caso de fatalidades. Tudo sem burocracia e por um valor que cabe perfeitamente no seu bolso.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Button
              onClick={() => setView('checkout')}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 h-auto"
            >
              <Shield className="mr-2 h-5 w-5" aria-hidden="true" />
              {copy.hero.ctaPrimary}
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="font-medium text-base px-8 py-6 h-auto"
              onClick={() => {
                const el = document.getElementById('solution-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {copy.hero.ctaSecondary}
            </Button>
          </div>

          {/* Indicadores de confiança */}
          <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-border/50 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            {copy.hero.trustIndicators.map((indicator, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-state-success" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{indicator}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
