/**
 * Analytics & Marketing script manager (LGPD-compliant).
 * 
 * Respects user consent stored in localStorage by CookieConsent component.
 * Scripts are loaded dynamically only after explicit user consent.
 * 
 * SPEC-07 §5.4: Consentimento de Cookies
 */

export interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  timestamp: number
}

const CONSENT_KEY = 'granpaz_cookie_consent'

/**
 * Read current consent preferences from localStorage.
 */
export function getConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Check if analytics scripts are allowed.
 */
export function analyticsAllowed(): boolean {
  return getConsent()?.analytics === true
}

/**
 * Check if marketing scripts are allowed.
 */
export function marketingAllowed(): boolean {
  return getConsent()?.marketing === true
}

/**
 * Load Google Analytics 4 (gtag) — only if consent granted.
 */
export function loadGA4(measurementId?: string): void {
  if (!measurementId || !analyticsAllowed()) return
  if (document.getElementById('ga4-script')) return

  const script = document.createElement('script')
  script.id = 'ga4-script'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: unknown[]) { window.dataLayer.push(args) }
  gtag('js', new Date())
  gtag('config', measurementId, { anonymize_ip: true })
}

/**
 * Load Meta Pixel — only if consent granted.
 */
export function loadMetaPixel(pixelId?: string): void {
  if (!pixelId || !marketingAllowed()) return
  if (document.getElementById('meta-pixel-script')) return

  const script = document.createElement('script')
  script.id = 'meta-pixel-script'
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `
  document.head.appendChild(script)
}

/**
 * Unload GA4 — removes script and resets dataLayer.
 */
export function unloadGA4(): void {
  const script = document.getElementById('ga4-script')
  script?.remove()
  window.dataLayer = []
}

/**
 * Unload Meta Pixel — removes script.
 */
export function unloadMetaPixel(): void {
  const script = document.getElementById('meta-pixel-script')
  script?.remove()
}

// Augment window type
declare global {
  interface Window {
    dataLayer: unknown[]
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}
