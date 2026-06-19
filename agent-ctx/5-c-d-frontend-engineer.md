# Task 5-c/5-d: Fix SPEC-07 Checkout + Infrastructure Gaps

## Agent: Frontend Engineer

## Summary
All 12 gaps from SPEC-07 were addressed across 6 files. Lint passes, dev server compiles (200).

## Changes Made

### 1. `src/components/landing/cookie-consent.tsx` (NEW)
- LGPD cookie consent banner with 3-tier preferences (necessary, analytics, marketing)
- Lazy state initializer to avoid setState-in-effect lint error
- Persists preferences to localStorage
- Appears on all views via page.tsx

### 2. `src/components/checkout/checkout-flow.tsx`
- **EC-06 / L04**: "Proteção Funeral é um benefício intrínseco do Clube de Benefícios" in FAMILIAR plan cards
- **EC-06 / RN-04**: Required checkbox in STEP 3 acknowledging Clube de Benefícios; submit disabled until checked
- **L05**: Maintenance fallback UI when Plans API fails (WhatsApp support, back button)
- **L10**: Dialog modal on 409 conflict instead of toast, with link to Área do Cliente
- **L17**: Success screen clarifies "aguardando aprovação", "Nenhuma apólice emitida", Badge with status
- **L15**: resetCheckout() on handleBack(0→landing); store clears localStorage/sessionStorage preserving UTMs
- **L16**: UTM capture on mount, UTM data in submission payload

### 3. `src/lib/store.ts`
- resetCheckout() clears sessionStorage (preserves utm_*) + removes checkout localStorage keys
- Added featureFlags (newCheckoutFlow, marketingPixels) with setFeatureFlag action

### 4. `src/app/layout.tsx`
- Product schema.org markup (SPEC-07 §6.3) alongside Organization
- metadataBase + alternates.canonical

### 5. `src/app/page.tsx`
- CookieConsent component inside QueryClientProvider

### 6. `next.config.ts`
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, CSP, Permissions-Policy
