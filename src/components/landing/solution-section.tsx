'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, MapPin, DollarSign, ShieldCheck } from 'lucide-react'

const benefits = [
  {
    icon: Heart,
    title: 'Custo Zero na Despedida',
    description:
      'Assistência funeral completa sem custo adicional no momento da dor. Sua família não precisa se preocupar com despesas.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: MapPin,
    title: 'Cobertura em Todo o Brasil',
    description:
      'Proteção nacional. Não importa onde você esteja, sua família está amparada em qualquer cidade do país.',
    color: 'text-brand-accent',
    bgColor: 'bg-brand-accent/10',
  },
  {
    icon: DollarSign,
    title: 'Apoio Financeiro (Indenização)',
    description:
      'Indenização por morte que oferece amparo financeiro para os familiares em um momento de vulnerabilidade.',
    color: 'text-state-success',
    bgColor: 'bg-state-success/10',
  },
  {
    icon: ShieldCheck,
    title: 'Proteção em Vida',
    description:
      'Benefícios que vão além: você e sua família têm acesso a vantagens e proteção enquanto estão vivos.',
    color: 'text-state-warning',
    bgColor: 'bg-state-warning/10',
  },
]

export function SolutionSection() {
  const { setView } = useAppStore()

  return (
    <section id="solution-section" className="py-16 sm:py-24" aria-label="Benefícios do plano">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            Tudo o que sua família precisa em um único plano
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            O Granpaz reúne os principais benefícios para proteger quem você ama, com valores acessíveis e sem burocracia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon
            return (
              <Card
                key={i}
                className="group hover:shadow-md transition-shadow duration-300 border-border/50 animate-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${benefit.bgColor} mb-4 group-hover:scale-105 transition-transform duration-300`}>
                    <Icon className={`h-6 w-6 ${benefit.color}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <Button
            onClick={() => setView('checkout')}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base px-8 py-6 h-auto"
          >
            Quero Proteger Minha Família
          </Button>
        </div>
      </div>
    </section>
  )
}
