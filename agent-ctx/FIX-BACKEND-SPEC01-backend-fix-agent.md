# FIX-BACKEND-SPEC01 — Backend Fix Agent

## Task
Fix ALL backend lacunas for SPEC-01 Módulo de Contratação e Cadastro

## Previous Agent Context
- Schema Agent (Task 1): Created Prisma schema with 19 models, seeded 16 config keys, 2 plans
- Frontend Agent (Task 2-8): Built complete frontend with landing page, checkout flow, dashboard, 13 API routes

## Work Completed

### Files Created
1. `/src/lib/sanitization.ts` — Centralized sanitization per SPEC-01 Section 5.4
   - sanitizeCPF, sanitizePhone, sanitizeCEP, sanitizeString, sanitizeEmail, sanitizePessoaFisica

2. `/src/lib/validations.ts` — Business rule validations (RN-01 through RN-06)
   - checkContratoAtivoPorTitular (RN-01)
   - validateAge with coverage tag (RN-02/RN-06)
   - validateSubDependenteEligibility (RN-03)
   - validatePlanoPermiteDependentes (RN-05)
   - validateParentescoPorTipo
   - validateFieldFormats
   - getConfigValue/getConfigInt/getConfigBool

3. `/src/app/api/viacep/route.ts` — ViaCEP proxy with 2s timeout, Air-Gap filtering

### Files Modified
4. `/src/app/api/contratos/route.ts` — Major rewrite with full validation pipeline
5. `/src/app/api/pessoas-fisicas/buscar-por-cpf/route.ts` — Enhanced with sanitization + LGPD minimization
6. `/src/lib/helpers.ts` — Added re-exports from sanitization module

### Test Results
- All API routes verified working via curl
- RN-01: Duplicate contract blocked (409)
- RN-05: INDIVIDUAL plan blocks dependents
- Parentesco validation working
- Profissão required for TITULAR and AGREGADO
- Invalid CPF rejected
- ViaCEP proxy returns address data
- CPF lookup returns { found: true/false }
- ESLint: No errors
- db:push: Schema in sync
