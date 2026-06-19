'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Isso não é para mim, deve ser muito caro...',
    answer:
      'O Granpaz foi pensado para ser acessível a todas as famílias brasileiras. Nosso plano individual começa a partir de R$ 29,90/mês — menos do que um café por dia. Proteger quem você ama não precisa pesar no orçamento.',
  },
  {
    question: 'Como minha família vai acionar isso na hora da dor?',
    answer:
      'Basta ligar para a central de atendimento 24h. Nossa equipe cuida de tudo: documentação, transporte, cerimônia e todos os trâmites. Sua família só precisa se despedir — o resto fica por nossa conta, com apoio integral da Seguradora Parceira.',
  },
  {
    question: 'O plano só vale na minha cidade?',
    answer:
      'Não! O Granpaz oferece cobertura em todo o território nacional. Não importa se você está em São Paulo, no interior do Maranhão ou em qualquer outro estado — sua proteção vai com você.',
  },
  {
    question: 'Posso confiar na Saúde & Proteção?',
    answer:
      'A Saúde & Proteção Administração de Benefícios atua como Estipulante de seguros coletivos, seguindo todas as normas da SUSEP. A garantia de risco, o pagamento de indenizações e a prestação da assistência funeral são de responsabilidade integral das Seguradoras Parceiras, que são empresas reguladas e autorizadas pela SUSEP.',
  },
]

export function FaqSection() {
  return (
    <section className="py-16 sm:py-24 bg-muted/30" aria-label="Perguntas frequentes">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            Perguntas Frequentes
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            Tire suas dúvidas sobre o plano Granpaz
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-sm transition-shadow"
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
