# Task 5-a: Fix SPEC-07 Backend Gaps

## Agent: Backend Engineer

## Summary
Fixed all 5 SPEC-07 backend gaps: Air-Gap response guard, 503 status code, rate limiting, UUID validation, email validation, and SUSEP ESLint custom rule.

## Files Modified/Created

### Created
| File | Purpose |
|------|---------|
| `src/lib/rate-limit.ts` | In-memory rate limiter with configurable maxRequests/windowMs |
| `eslint-rules/susep-compliance.js` | Custom ESLint rule detecting SUSEP-prohibited terms |

### Modified
| File | Changes |
|------|---------|
| `src/app/api/planos/route.ts` | Air-Gap guard, 503 status, rate limiting (100 req/s) |
| `src/app/api/contratos/route.ts` | Rate limiting (10 req/min), UUID validation, email validation |
| `src/lib/validations.ts` | Added `validateEmail()` (RFC 5322) |
| `eslint.config.mjs` | Added inline SUSEP compliance plugin |

## Gap Coverage

| Gap ID | Description | Status |
|--------|-------------|--------|
| L05/L09/L18 | Air-Gap Response Guard + 503 Status | ✅ Fixed |
| L14 | Rate Limiting Middleware | ✅ Fixed |
| L20 | UUID Validation for planoId | ✅ Fixed |
| L28 | RFC 5322 Email Validation | ✅ Fixed |
| L01 | eslint-plugin-susep Custom Rule | ✅ Fixed |

## Verification
- `bun run lint` passes for all backend files (2 pre-existing frontend errors unrelated)
- Dev server compiles and runs successfully
