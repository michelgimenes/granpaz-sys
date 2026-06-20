# Task 3-8: Backend Engineer — Fix all SPEC-02 Backend Lacunas

## Summary
All 20 backend lacunas for SPEC-02 (Módulo 2 — Gestão de Contratos e Aprovação) have been fixed.

## Files Created
1. `/src/lib/auth-helpers.ts` — SuperAdmin role check (`checkSuperAdmin`) and request metadata extraction (`extractRequestMeta`)
2. `/src/app/api/seguradoras/route.ts` — GET (list) + POST (create) seguradoras
3. `/src/app/api/seguradoras/[id]/route.ts` — GET + PUT + DELETE seguradoras
4. `/src/app/api/seguradoras/[id]/testar-pdf/route.ts` — POST mock PDF generation
5. `/src/app/api/contratos/[id]/endosso/route.ts` — POST endosso (ALTERACAO_CAPITAL, EXCLUSAO_VINCULO, UPGRADE/DOWNGRADE_PLANO)

## Files Modified
1. `/src/lib/sanitization.ts` — Added `sanitizeMarkdown()` for RN-04
2. `/src/app/api/contratos/[id]/aprovar/route.ts` — Complete rewrite with L1,L2,L7,L8,L9,L12,L30,L31,L32
3. `/src/app/api/contratos/[id]/rejeitar/route.ts` — Complete rewrite with L3,L4,L10,L30,L31,L32
4. `/src/app/api/contratos/[id]/route.ts` — L5/RN-03 immutability + GET includes vinculos/dadosAprovacao
5. `/src/app/api/contratos/route.ts` — L16 pagination + filters

## Lacuna Coverage
- L1: capitalSegurado > 0 validation ✅
- L2: Bonificação liberation on approval ✅
- L3: motivo validation for rejeição ✅
- L4: Cascade estorno of bonificações ✅
- L5/RN-03: Financial field immutability post-approval ✅
- L6/RN-04: Markdown sanitization ✅
- L7: capitalSegurado <= 10M ✅
- L8: codigoSeguradora regex ✅
- L9: dataInicio >= today ✅
- L10: motivo min 10 chars ✅
- L11: >20% sanitization warning ✅
- L12: Optimistic locking (updatedAt) ✅
- L15: EXCLUSAO_VINCULO vinculo already inactive check ✅
- L16: Pagination + filters ✅
- L17: Seguradoras listing ✅
- L18: Mock PDF test ✅
- L19: Endosso creation ✅
- L20: SuperAdmin role check ✅
- L30: Audit log with atorId + ipAddress ✅
- L31: SuperAdmin role check ✅
- L32: Audit acao = APROVACAO/REJEICAO ✅

## Lint Status
- `bun run lint` — No errors, no warnings
- Dev server running normally
