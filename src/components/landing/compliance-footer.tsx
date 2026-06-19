'use client'

import { Shield, Info } from 'lucide-react'

export function ComplianceFooter() {
  return (
    <footer className="border-t border-border/50 bg-muted/20" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Compliance Banner - MANDATORY */}
        <div className="mb-8 p-4 sm:p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-start gap-3 mb-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <h3 className="font-semibold text-foreground text-sm sm:text-base">
              Informações Legais
            </h3>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
            <p>
              O Plano Granpaz é um produto da Saúde &amp; Proteção Administração de Benefícios (CNPJ: 35.898.940/0001-24).
            </p>
            <p>
              Atuamos exclusivamente como Estipulante de seguros coletivos.
            </p>
            <p>
              A garantia de risco, o pagamento de indenizações e a prestação da assistência funeral são de responsabilidade integral das Seguradoras Parceiras.
            </p>
            <p>
              O registro deste plano na SUSEP não implica, por parte da Autarquia, incentivo ou recomendação a sua comercialização.
            </p>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-serif font-bold text-foreground">Granpaz</span>
            <span className="text-xs text-muted-foreground">by Saúde &amp; Proteção</span>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} Saúde &amp; Proteção Administração de Benefícios. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
