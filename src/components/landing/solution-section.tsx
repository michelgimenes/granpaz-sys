'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, MapPin, DollarSign, ShieldCheck } from 'lucide-react'
import copy from '@/lib/copy.json'

// Mapeamento de ícones e cores para cada benefício
const benefitMeta = [
  { icon: Heart, color: 'text-primary', bgColor: 'bg-primary/10' },
  { icon: MapPin, color: 'text-brand-accent', bgColor: 'bg-brand-accent/10' },
  { icon: DollarSign, color: 'text-state-success', bgColor: 'bg-state-success/10' },
  { icon: ShieldCheck, color: 'text-state-warning', bgColor: 'bg-state-warning/10' },
]

export function SolutionSection() {
  const { setView } = useAppStore()

  return (
    <section id="solution-section" className="py-16 sm:py-24" aria-label="Benefícios do plano">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground animate-fade-up">
            {copy.solution.title}
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {copy.solution.subtitle}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {copy.solution.benefits.map((benefit, i) => {
            const meta = benefitMeta[i]
            const Icon = meta.icon
            return (
              <Card
                key={i}
                className="group hover:shadow-md transition-shadow duration-300 border-border/50 animate-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${meta.bgColor} mb-4 group-hover:scale-105 transition-transform duration-300`}>
                    <Icon className={`h-6 w-6 ${meta.color}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                  {'footnote' in benefit && benefit.footnote && (
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      *{benefit.footnote}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <Button
            onClick={() => setView('checkout')}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 h-auto"
          >
            {copy.solution.cta}
          </Button>
        </div>
      </div>
    </section>
  )
}
