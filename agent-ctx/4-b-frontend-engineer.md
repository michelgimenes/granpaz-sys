# Task 4-b: Fix Important Design System UI Gaps

## Agent: Frontend Engineer

## Summary
Fixed 6 UI gaps across the Granpaz design system as specified in the documentation.

## Files Modified

### 1. `src/components/landing/solution-section.tsx`
- Changed grid from `lg:grid-cols-4` to `sm:grid-cols-2` for proper 2×2 layout (§3.1)

### 2. `src/components/dashboard/financial-tab.tsx`
- Changed "Saldo Bloqueado" → "A Receber" with muted style (`text-muted-foreground`, `bg-muted/50`) per §3.3
- Made "Saldo Devedor" card conditionally hidden when value is 0 per §3.3
- Added dynamic grid columns (2 or 3 depending on visible cards)
- Added Tooltip on disabled "Solicitar Saque" button when `saldoDevedor > 0`
- Added `disabled={carteira.saldoDevedor > 0}` to Saque button

### 3. `src/components/checkout/pessoa-fisica-form.tsx`
- Added `aria-invalid` and `aria-describedby` to all form fields: cpf, dataNascimento, parentesco, profissao, email, telefone, cep, logradouro, numero, bairro, cidade, estado
- Added matching `id="fieldName-error"` and `aria-live="polite"` to all error messages
- Changed `inputClass()` to `inputClass(errors.fieldName)` for address fields

### 4. `src/app/loading.tsx` (NEW)
- Landing page skeleton loading state with header, hero, benefits, and footer skeletons

### 5. `src/lib/store.ts`
- Added `loadDraft()` action — restores checkout from sessionStorage with 20-min expiry (LGPD §4.3)
- Added `useAppStore.subscribe()` auto-save to sessionStorage on state changes

### 6. `src/components/checkout/checkout-flow.tsx`
- Added `useRef`-based draft restoration on mount with toast notification
- Added `useRef`-based inactivity timer start on mount
- Added `stopInactivityTimer()` calls in handleBack and handleRestart

### 7. `src/lib/inactivity.ts` (NEW)
- Inactivity timeout utility: 15 min warning, 20 min clears sessionStorage (LGPD)
- Resets on user activity (mousedown, keydown, scroll, touchstart)

## Lint Status
✅ `bun run lint` passes with no errors
