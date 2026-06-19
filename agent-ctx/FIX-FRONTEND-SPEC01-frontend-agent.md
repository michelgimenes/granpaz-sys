# Task: FIX-FRONTEND-SPEC01 — Fix ALL frontend lacunas for SPEC-01 Módulo de Contratação e Cadastro

## Agent: Frontend Agent
## Status: COMPLETED

## Work Log

### Step 1: Updated Zustand Store (`src/lib/store.ts`)
- Added `checkoutData` state with `titular`, `vinculos`, and `selectedPlan` fields
- Added `setCheckoutData` action with partial merge
- Added `resetCheckout` action that clears all checkout state and resets step to 0

### Step 2: Created ViaCEP API Route (`src/app/api/viacep/route.ts`)
- New GET endpoint that proxies requests to viacep.com.br
- Validates CEP format (8 digits)
- Returns formatted address data (logradouro, bairro, cidade, estado, complemento)
- Handles errors: 400 (invalid CEP), 404 (not found), 503 (service unavailable)
- Uses Next.js revalidate cache for 24h

### Step 3: Created PessoaFisicaForm Component (`src/components/checkout/pessoa-fisica-form.tsx`)
- **ADR-001 compliant**: Agnostic reusable component with `sessionType` prop
- **Session types**: TITULAR, DEPENDENTE, AGREGADO, SUB_DEPENDENTE
- **Config-driven**: SESSION_CONFIG controls which fields are visible/required per type
- **CPF Identification**: Blur → API → modal reuse/block flow
  - Validates CPF using `validateCPF()` from helpers
  - On blur, calls `/api/pessoas-fisicas/buscar-por-cpf`
  - If found, shows reuse modal (auto-fill existing data)
  - If CPF belongs to different person (birth date mismatch), blocks with error
- **RN-02**: Age validation against config API (IDADE_COBERTURA_FILHO, IDADE_LIMITE_DEPENDENTE)
- **RN-06**: Coverage tag "SEM DIREITO À PROTEÇÃO" for overage children
- **Parentesco filtering**: DEPENDENTE gets CONJUGE/FILHO only; AGREGADO gets full list
- **Profissão obrigatória**: Required for TITULAR and AGREGADO
- **ViaCEP auto-fill**: On CEP blur, fetches and auto-fills address fields
- **Email/Telefone/CEP validation** with proper error messages
- **Agregado inherits address**: Checkbox to use titular's address data
- **SUB_DEPENDENTE**: Accepts `agregadoPaiId` prop, adds to output
- Accessible with aria attributes throughout

### Step 4: Rewrote checkout-flow.tsx (`src/components/checkout/checkout-flow.tsx`)
Complete rewrite with all 15 fixes:

1. **PessoaFisicaForm agnóstico** — Reused via `sessionType` prop across all steps
2. **Identificação Unificada** — CPF blur → API → modal/block in PessoaFisicaForm
3. **RN-02: Validação etária** — Age check against config API in PessoaFisicaForm
4. **RN-05: Block dependentes in INDIVIDUAL plan** — Step 2 shows message, disables add buttons
5. **RN-06: Tag "SEM DIREITO À PROTEÇÃO"** — Shown on vinculo cards and in resumo
6. **Sub-dependentes** — RN-03 with agregadoPaiId, only for CASADO/UNIAO_ESTAVEL agregados
7. **Parentesco filtering** — DEPENDENTE=CONJUGE/FILHO only, AGREGADO gets full list
8. **Limits** — Max dependentes/agregados enforced with disabled buttons and badges
9. **Profissão obrigatória** — Enforced in PessoaFisicaForm for TITULAR and AGREGADO
10. **ViaCEP auto-fill** — Integrated in PessoaFisicaForm via blur on CEP field
11. **CPF validation** — Uses validateCPF() from helpers
12. **Email/Telefone/CEP validation** — Full validation with error messages
13. **Agregado inherits address** — Checkbox in PessoaFisicaForm
14. **ComplianceBanner** — In checkout resumo step and success screen
15. **Mobile responsive** — Sheet (drawer) for adding vínculos, responsive grid layouts

### Additional improvements:
- Success screen with compliance banner after submission
- Handle 409 (duplicate contract) with toast message
- Handle 400 with specific error messages
- No seguradora_id displayed (Air-Gap compliance)
- Correct terminology (no "seguro", uses "proteção"/"benefício")
- LGPD notice in ComplianceBanner
- State preserved in Zustand store across steps
- `resetCheckout` clears all state for new contratação

## Files Modified/Created
- `src/lib/store.ts` — Modified (added checkoutData, setCheckoutData, resetCheckout)
- `src/app/api/viacep/route.ts` — Created (ViaCEP proxy endpoint)
- `src/components/checkout/pessoa-fisica-form.tsx` — Created (agnostic form component)
- `src/components/checkout/checkout-flow.tsx` — Rewritten (complete checkout flow)

## Verification
- `bun run lint` — No errors
- Dev server compiles successfully
