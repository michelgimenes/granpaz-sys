'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Cookie, Settings, Shield } from 'lucide-react'
import { loadGA4, unloadGA4, loadMetaPixel, unloadMetaPixel } from '@/lib/analytics'

const COOKIE_CONSENT_KEY = 'granpaz_cookie_consent'

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  timestamp: number
}

/**
 * Banner de consentimento de cookies LGPD (SPEC-07 §5.4)
 * 
 * Gerencia o carregamento dinâmico de scripts GA4 e Meta Pixel
 * baseado no consentimento explícito do usuário.
 * 
 * Este componente DEVE ser carregado via next/dynamic com { ssr: false }
 * para evitar hydration mismatch (localStorage não existe no servidor).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(COOKIE_CONSENT_KEY)
  })
  const [showDetails, setShowDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  // GA4 Measurement ID from env vars (optional — only loads if defined)
  const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  // Meta Pixel ID from env vars (optional)
  const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

  // Load scripts based on existing consent on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return
    try {
      const prefs: CookiePreferences = JSON.parse(raw)
      if (prefs.analytics) loadGA4(GA4_ID)
      if (prefs.marketing) loadMetaPixel(META_PIXEL_ID)
    } catch { /* ignore */ }
  }, [GA4_ID, META_PIXEL_ID])

  const applyConsent = useCallback((prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs))
    setVisible(false)

    if (prefs.analytics) {
      loadGA4(GA4_ID)
    } else {
      unloadGA4()
    }

    if (prefs.marketing) {
      loadMetaPixel(META_PIXEL_ID)
    } else {
      unloadMetaPixel()
    }
  }, [GA4_ID, META_PIXEL_ID])

  const handleAcceptAll = () => {
    applyConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    })
  }

  const handleAcceptNecessary = () => {
    applyConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    })
  }

  const handleSavePreferences = () => {
    applyConsent({
      necessary: true,
      analytics,
      marketing,
      timestamp: Date.now(),
    })
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border bg-background/95 backdrop-blur-md p-4 sm:p-6 shadow-lg" role="banner" aria-label="Consentimento de Cookies">
      <div className="mx-auto max-w-5xl space-y-3">
        {!showDetails ? (
          <>
            <div className="flex items-start gap-3">
              <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">
                  Utilizamos cookies para melhorar sua experiência
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cookies necessários são obrigatórios para o funcionamento do site. Cookies de análise e marketing são opcionais e só serão ativados com seu consentimento explícito, conforme a LGPD.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDetails(true)} className="gap-2">
                <Settings className="h-3 w-3" />
                Personalizar
              </Button>
              <Button variant="outline" size="sm" onClick={handleAcceptNecessary}>
                Apenas necessários
              </Button>
              <Button size="sm" onClick={handleAcceptAll} className="bg-primary text-primary-foreground">
                Aceitar todos
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Preferências de Cookies</h3>
            </div>
            <div className="space-y-3">
              {/* Necessários — sempre ativo */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <input type="checkbox" checked readOnly disabled className="h-4 w-4 accent-primary" aria-label="Cookies necessários (obrigatório)" />
                <div>
                  <p className="text-xs font-medium text-foreground">Necessários</p>
                  <p className="text-xs text-muted-foreground">Obrigatórios para o funcionamento do site. Não podem ser desativados.</p>
                </div>
              </div>
              {/* Análise */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  aria-label="Cookies de análise (GA4)"
                />
                <div>
                  <p className="text-xs font-medium text-foreground">Análise (GA4)</p>
                  <p className="text-xs text-muted-foreground">Nos ajudam a entender como os visitantes interagem com o site.</p>
                </div>
              </div>
              {/* Marketing */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  aria-label="Cookies de marketing (Meta Pixel)"
                />
                <div>
                  <p className="text-xs font-medium text-foreground">Marketing (Meta Pixel)</p>
                  <p className="text-xs text-muted-foreground">Usados para rastrear conversões e exibir anúncios relevantes.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDetails(false)}>
                Voltar
              </Button>
              <Button size="sm" onClick={handleSavePreferences} className="bg-primary text-primary-foreground">
                Salvar preferências
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
