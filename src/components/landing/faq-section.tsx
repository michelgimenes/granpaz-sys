'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import copy from '@/lib/copy.json'

export function FaqSection() {
  return (
    <section className="py-16 sm:py-24 bg-muted/30" aria-label="Perguntas frequentes">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground animate-fade-up">
            Perguntas Frequentes
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Tire suas dúvidas sobre o plano Granpaz
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {copy.faq.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-sm transition-shadow animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline text-sm sm:text-base py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
