# Task 9-11: Frontend Architect — Fix all SPEC-02 Frontend Lacunas

## Summary
All 9 frontend lacunas for SPEC-02 Module 2 (Gestão de Contratos e Aprovação) have been fixed.

## Files Modified
- `src/lib/store.ts` — Added `'seguradoras'` to `DashboardTab` type union
- `src/components/dashboard/approval-tab.tsx` — Complete rewrite with L21-L25 fixes
- `src/components/dashboard/contracts-tab.tsx` — Complete rewrite with L26-L28 fixes
- `src/components/dashboard/dashboard-layout.tsx` — Added Building2 icon + seguradoras nav item
- `src/app/page.tsx` — Added SeguradorasTab import and tab mapping
- `worklog.md` — Appended task log

## Files Created
- `src/components/dashboard/seguradoras-tab.tsx` — New Seguradoras CRUD management tab (SuperAdmin)

## Lacunas Addressed

### Approval Tab (L21-L25)
- **L21**: `data_inicio` date field added (defaults to today), sent as `dataInicio` in approve body
- **L22**: CPF Confirmation Dialog — admin must type titular's CPF to confirm approval (SPEC-02 §7.3 risk mitigation)
- **L23**: Rejection Modal with `motivo` textarea (10-1000 chars, character count, validation)
- **L24**: isSubmitting state, Loader2 spinners on buttons, API error parsing, toast notifications (auto-dismiss 3.5s)
- **L25**: Vínculos tree display — fetches full contract details via useQuery when selected, shows parentesco/tipoVinculo
- Approve request includes `dataInicio` and `adminAprovadorId` from `useAppStore.getState().user`

### Contracts Tab (L26-L28)
- **L26**: Fixed `formatCurrency(0)` → `formatCurrency(contrato.valorTaxaAdesao)`; added `valorTaxaAdesao` to Contrato interface
- **L27**: Dados de aprovação section for APROVADO contracts (capital segurado, código seguradora, data aprovação, admin aprovador, observações)
- **L28**: Endosso actions — "Alterar Capital" dialog (validation: >0 and <=10M), "Excluir Vínculo" dialog with active vínculos list + confirmation
- Pagination: handles both `{data, pagination}` and array API responses, Previous/Next buttons

### Seguradoras Tab (L29)
- Full CRUD for seguradoras (SuperAdmin only)
- Card layout with nome, CNPJ (formatted), código, telefone sinistro, ativa status
- Add/Edit Dialog with auto-formatting (CNPJ, phone), uppercase código, markdown preview for cláusulas
- Delete confirmation dialog
- Role check: restricted to SUPERADMIN

## Quality
- ESLint: 0 errors
- Dev server: running normally, no compilation errors
