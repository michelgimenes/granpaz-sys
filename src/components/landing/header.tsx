'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Shield, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { setView } = useAppStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => setView('landing')}
          className="flex items-center gap-2 focus-ring rounded-md"
          aria-label="Granpaz - Página inicial"
        >
          <Shield className="h-7 w-7 text-primary" aria-hidden="true" />
          <span className="font-serif text-xl font-bold text-foreground tracking-tight">
            Granpaz
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4" aria-label="Navegação principal">
          <button
            onClick={() => setView('login')}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-md px-3 py-2"
          >
            Área do Cliente
          </button>
          <Button
            onClick={() => setView('checkout')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            size="default"
          >
            Contratar
          </Button>
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden focus-ring rounded-md p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background animate-fade-down">
          <div className="flex flex-col gap-2 px-4 py-4">
            <button
              onClick={() => { setView('login'); setMobileMenuOpen(false) }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md text-left"
            >
              Área do Cliente
            </button>
            <Button
              onClick={() => { setView('checkout'); setMobileMenuOpen(false) }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full"
            >
              Contratar
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
