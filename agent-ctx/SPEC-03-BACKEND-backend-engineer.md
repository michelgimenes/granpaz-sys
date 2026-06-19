# SPEC-03-BACKEND — Backend Engineer Work Record

## Task
Fix ALL backend lacunas for SPEC-03 (Módulo Financeiro e de Bonificação) of the Granpaz system.

## Summary
All 13 files created/updated. Every business rule, validation, and endpoint specified in SPEC-03 has been implemented.

## Files Created (6 new endpoints)

1. **`/src/app/api/carteiras/[carteiraId]/abatimentos/route.ts`** — POST abatimento
   - RN-003: saldo_disponivel checks (full + partial)
   - RN-007: saldo_devedor block
   - EC-008: valor_abatido > 0
   - EC-009: conta_a_pagar not CANCELADO
   - Partial abatimento → PARCIALMENTE_PAGO status

2. **`/src/app/api/carteiras/[carteiraId]/saques/route.ts`** — POST saque
   - RN-005: SAQUE_PF_ATIVO config check
   - RN-005: IRRF progressive calculation (2026 brackets)
   - RN-005: INSS 11% capped at R$908.85
   - RN-006: PENDENTE_APROVACAO when over LIMITE_SAQUE_DIARIO
   - RN-007: saldo_devedor block

3. **`/src/app/api/carteiras/[carteiraId]/extrato/route.ts`** — GET extrato
   - Combined bonificação + pagamento listing
   - Filters: tipo, date range
   - Pagination

4. **`/src/app/api/admin/saques/[transacaoId]/aprovar/route.ts`** — POST Maker/Checker
   - SuperAdmin/FINANCEIRO role check
   - Approve: deduct from saldoBloqueado, CONCLUIDO
   - Reject: return to saldoDisponivel, ESTORNADO, motivoRejeicao required

5. **`/src/app/api/webhooks/pagamento/route.ts`** — POST webhook
   - EC-003: Idempotency via webhooks_recebidos
   - Update conta_a_pagar to PAGO

6. **`/src/app/api/admin/saques/route.ts`** — GET pending saques
   - SuperAdmin/FINANCEIRO role check
   - Pagination, status filter

## Files Updated (7 existing files)

1. **`/src/lib/auth-helpers.ts`** — Added checkFinanceiroOrAdmin()
2. **`/src/app/api/contratos/[id]/aprovar/route.ts`** — dataLiberacao, EC-004 wallet before bonificação
3. **`/src/app/api/contratos/[id]/rejeitar/route.ts`** — dataEstorno on ESTORNADO
4. **`/src/app/api/contratos/route.ts`** — Bonificação tree creation (RN-001, niveis_bonificacao, saldoBloqueado)
5. **`/src/app/api/patrocinios/route.ts`** — POST handler (RN-009, RN-010)
6. **`/src/app/api/carteiras/route.ts`** — Pagination + titularId filter
7. **`/src/app/api/carteiras/transacoes/route.ts`** — Pagination + tipo/status/date filters
8. **`/src/app/api/contas-a-pagar/route.ts`** — Pagination + contratoId/status/date filters

## Quality
- ESLint: 0 errors
- DB: In sync (db:push verified)
- Dev server: Running normally
