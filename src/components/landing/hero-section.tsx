'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Shield, ArrowRight } from 'lucide-react'

export function HeroSection() {
  const { setView } = useAppStore()

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden" aria-label="Seção principal">
      {/* Background gradient overlay */}
      <div className="hero-gradient absolute inset-0" aria-hidden="true" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-3xl">
          {/* Pre-headline */}
          <p className="text-sm sm:text-base font-semibold tracking-widest text-primary uppercase mb-4 animate-fade-up">
            Para pais e mães que pensam no futuro da família
          </p>

          {/* Headline */}
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            A dor de uma perda não avisa quando vai chegar.{' '}
            <span className="text-primary">
              Mas a proteção da sua família pode começar hoje.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
            O <strong className="text-foreground">Granpaz</strong> é o plano de proteção familiar que oferece
            assistência funeral em todo o Brasil, indenização por morte e proteção em vida
            — com valores acessíveis para você cuidar de quem mais ama.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Button
              onClick={() => setView('checkout')}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 h-auto"
            >
              <Shield className="mr-2 h-5 w-5" aria-hidden="true" />
              Quero Proteger Minha Família Agora
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
              Conhecer o Plano
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-border/50 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-state-success" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Cobertura nacional</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-state-success" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Sem burocracia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-state-success" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">A partir de R$ 29,90/mês</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
