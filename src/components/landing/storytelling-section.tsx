'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export function StorytellingSection() {
  return (
    <section className="py-16 sm:py-24 bg-muted/30" aria-label="Comparação de cenários">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            Duas histórias, dois destinos
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Imagine duas famílias enfrentando o mesmo momento de dor. A diferença? A preparação.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Unprepared Family */}
          <div className="rounded-xl border-2 border-state-warning/30 bg-card p-6 sm:p-8 animate-fade-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-state-warning/10">
                <AlertTriangle className="h-5 w-5 text-state-warning" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                Família Despreparada
              </h3>
            </div>
            <ul className="space-y-3" role="list">
              {[
                'Despesas de R$ 5.000 a R$ 15.000 com funeral, do nada',
                'Família endividada para cobrir custos imediatos',
                'Burocracia e demora para acessar direitos',
                'Filhos sem amparo financeiro garantido',
                'Estresse e incerteza no pior momento',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 text-state-warning text-lg leading-none" aria-hidden="true">×</span>
                  <span className="text-sm sm:text-base text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Protected Family */}
          <div className="rounded-xl border-2 border-state-success/30 bg-card p-6 sm:p-8 animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-state-success/10">
                <CheckCircle2 className="h-5 w-5 text-state-success" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                Família Protegida
              </h3>
            </div>
            <ul className="space-y-3" role="list">
              {[
                'Assistência funeral coberta, sem custo adicional na hora',
                'Indenização por morte para amparar a família',
                'Atendimento nacional, rápido e sem burocracia',
                'Proteção em vida para toda a família',
                'Tranquilidade e dignidade no momento mais difícil',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-state-success shrink-0" aria-hidden="true" />
                  <span className="text-sm sm:text-base text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="font-serif text-lg sm:text-xl md:text-2xl font-semibold text-foreground italic">
            &ldquo;Qual dessas histórias você quer deixar para quem você mais ama?&rdquo;
          </p>
        </div>
      </div>
    </section>
  )
}
