# SPEC-06-FRONTEND — Frontend Architect Work Record

## Task
Rewrite ALL frontend lacunas for SPEC-06 (Módulo de Configurações e Auditoria) of the Granpaz system.

## Files Created/Modified

### New API Routes
1. `/home/z/my-project/src/app/api/diagnostico/integridade/route.ts` — 5 integrity checks
2. `/home/z/my-project/src/app/api/diagnostico/airgap-clt/route.ts` — CLT prohibited term scanner
3. `/home/z/my-project/src/app/api/configuracoes/[chave]/route.ts` — GET/PUT by chave with full validation

### Rewritten Frontend
1. `/home/z/my-project/src/components/dashboard/config-tab.tsx` — Full SPEC-06 config management
2. `/home/z/my-project/src/components/dashboard/audit-tab.tsx` — Full SPEC-06 audit log viewer

## Key Features Implemented

### config-tab.tsx
- Categorized configs (Idades, Carências, Financeiro, Segurança) via Accordion
- Translated labels, tipoParse color badges, formatted display values
- Edit Dialog: type-aware inputs, motivo_alteracao with char counter (20-500), critical key double-confirm
- Old vs New value preview
- PUT /api/configuracoes/{chave} with 409/400 error handling
- SuperAdmin-only edit + diagnostics
- Integrity Diagnostics Dialog: summary grid, expandable details, Air-Gap CLT button
- Loading skeletons, responsive, LGPD note

### audit-tab.tsx
- 6-filter panel: Entity, Action, Date range, Ator ID, Entity ID
- Paginated list (20/page) with page buttons
- Color-coded action badges, truncated IDs with copy, ator/IP display
- Expandable JSON diff viewer
- Export CSV (9 columns, UTF-8 BOM)
- LGPD compliance note
- Loading skeletons, empty state, responsive

## Quality
- ESLint: 0 errors, 0 warnings
- Dev server: Compiles successfully
