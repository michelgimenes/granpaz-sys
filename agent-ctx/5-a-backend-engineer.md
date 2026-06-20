# Task 5-a: Backend Engineer — Fix Critical Core Documentation Gaps

## Summary
All 5 critical backend gaps have been addressed. Lint passes clean. Database in sync.

## Changes Made

### G45/46: Air-Gap Seguradoras (SUSEP CRITICAL)
- **`src/app/api/seguradoras/route.ts`**: GET handler now requires `x-user-id` and `x-user-role` headers, returning 403 for non-SUPERADMIN
- **`src/app/api/seguradoras/[id]/route.ts`**: GET handler now requires SUPERADMIN role (changed `_request` → `request` to access headers)
- **`src/app/api/contratos/route.ts`** GET: Non-SUPERADMIN users now receive only `{ id }` for seguradora field instead of full details

### G47: Validate tipo_registro vs route context
- **`src/app/api/contratos/route.ts`** POST: Added `VALID_VINCULO_TYPES` validation (`DEPENDENTE`, `AGREGADO`, `SUB_DEPENDENTE`)
- Added explicit checks: DEPENDENTE must have parentesco CONJUGE or FILHO; SUB_DEPENDENTE must have parentesco CONJUGE or FILHO

### G69: Preservação Seletiva de Vínculos
- **Created `src/app/api/pessoas-fisicas/[id]/estado-civil/route.ts`**: PATCH endpoint
  - When agregado changes from CASADO/UNIAO_ESTAVEL → SOLTEIRO/DIVORCIADO/VIUVO
  - Only CONJUGE sub-dependentes are desvinculados (dataFimVinculo set)
  - FILHO sub-dependentes remain active
  - Full audit log with counts

### G70: Dual percentage fields for NivelBonificacao
- **`prisma/schema.prisma`**: Added `percentualIndicacao Float @default(0)` and `percentualFechamento Float @default(0)` to NivelBonificacao
- **`prisma/seed.ts`**: Updated with dual values (e.g., nível 1: 7% + 3% = 10%)
- **`src/app/api/contratos/route.ts`** POST: Bonificação now calculates using `percentualTotal = percentualIndicacao + percentualFechamento`

### G82: CDC Notification on Auto-Suspension
- **`src/app/api/compliance/suspensao-auto/route.ts`**: After each contract suspension, creates `NOTIFICACAO_CDC_SUSPENSAO` audit log entry with CDC Art. 39 / SUSEP notification details for consumption by notification service

## Database
- Schema pushed with force-reset, all data re-seeded
- `bun run lint` — 0 errors, 0 warnings
