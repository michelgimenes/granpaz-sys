'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Shield, CheckCircle2, Smartphone, ClipboardList, HeartPulse } from 'lucide-react'
import copy from '@/lib/copy.json'

// Ícones para cada benefício da seção de urgência
const urgencyIcons = [Smartphone, ClipboardList, HeartPulse]

export function UrgencySection() {
  const { setView } = useAppStore()

  return (
    <section className="py-16 sm:py-24" aria-label="Inversão de risco e fechamento">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Título */}
        <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground animate-fade-up">
          {copy.urgency.title}
        </h2>

        {/* Corpo do texto */}
        <p className="mt-6 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {copy.urgency.body}
        </p>

        {/* Lista de benefícios */}
        <ul className="mt-8 space-y-4 max-w-lg mx-auto text-left" role="list">
          {copy.urgency.benefits.map((benefit, i) => {
            const Icon = urgencyIcons[i] || CheckCircle2
            return (
              <li key={i} className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                <Icon className="mt-0.5 h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <span className="text-sm sm:text-base text-muted-foreground">{benefit}</span>
              </li>
            )
          })}
        </ul>

        {/* Caixa de garantia Risco Zero */}
        <div className="mt-10 p-6 sm:p-8 rounded-xl bg-state-success/10 border-2 border-state-success/30 animate-fade-up" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-6 w-6 text-state-success" aria-hidden="true" />
            <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground">
              Risco Zero
            </h3>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {copy.urgency.guarantee}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 animate-fade-up" style={{ animationDelay: '0.6s' }}>
          <Button
            onClick={() => setView('checkout')}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 h-auto"
          >
            <Shield className="mr-2 h-5 w-5" aria-hidden="true" />
            {copy.urgency.cta}
          </Button>
        </div>
      </div>
    </section>
  )
}
