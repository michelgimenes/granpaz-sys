'use client'

import { Shield, Info } from 'lucide-react'
import copy from '@/lib/copy.json'

export function ComplianceFooter() {
  // Substitui o placeholder {year} pelo ano corrente
  const copyrightText = copy.footer.copyright.replace('{year}', String(new Date().getFullYear()))

  return (
    <footer className="border-t border-border/50 bg-muted/20" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Quadro de Compliance - OBRIGATÓRIO */}
        <div className="mb-8 p-4 sm:p-6 rounded-xl bg-card border border-border/50">
          <div className="flex items-start gap-3 mb-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <h3 className="font-semibold text-foreground text-sm sm:text-base">
              {copy.footer.complianceTitle}
            </h3>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
            {copy.footer.compliance.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* Rodapé inferior */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-serif font-bold text-foreground">{copy.footer.brand}</span>
            <span className="text-xs text-muted-foreground">{copy.footer.brandSubtitle}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            {copyrightText}
          </p>
        </div>
      </div>
    </footer>
  )
}
