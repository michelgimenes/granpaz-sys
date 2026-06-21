import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Adesão | Granpaz',
  description: 'Termos de Adesão do Plano de Proteção Granpaz.',
}

export default function TermosDeAdesaoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 sm:px-6 h-16">
          <Link href="/" className="font-serif text-lg font-bold text-foreground">
            Granpaz
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-8">
          Termos de Adesão do Plano de Proteção
        </h1>

        <div className="prose prose-sm sm:prose-base max-w-none text-muted-foreground space-y-4">
          <p>
            Este documento será disponibilizado em breve conforme a aprovação da seguradora parceira.
            Os Termos de Adesão estabelecem as condições gerais do Plano de Proteção Granpaz,
            incluindo direitos, deveres e obrigações das partes.
          </p>

          <p>
            Enquanto o documento oficial não é publicado, recomendamos consultar as
            Condições Gerais do plano disponíveis na Área do Cliente ou entrar em contato
            com nosso suporte para mais informações.
          </p>

          <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-2 mt-6">
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground leading-relaxed">
                Atuamos exclusivamente como <strong className="text-foreground">Estipulante</strong> de proteção coletiva.
                A garantia de risco e o pagamento de indenizações são de responsabilidade integral das Seguradoras Parceiras.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground leading-relaxed">
                O registro deste plano na SUSEP não implica, por parte da Autarquia, incentivo ou recomendação a sua comercialização.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground leading-relaxed">
                Seus dados pessoais são tratados conforme a LGPD e serão utilizados exclusivamente para a contratação e gestão do benefício.
              </span>
            </div>
          </div>

          <div className="border-t border-border/50 pt-6 mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 underline underline-offset-4"
            >
              Voltar para página inicial
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
