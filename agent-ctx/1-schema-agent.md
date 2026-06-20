# Work Log — Task 1: Prisma Schema Setup

## Date: 2025-01-01

## Task
Set up the Prisma schema for the Granpaz (Saúde & Proteção) system — a SaaS multi-tenant platform for administration of collective benefits (life insurance and funeral coverage).

## What was done

### 1. Prisma Schema (`prisma/schema.prisma`)
Created all 19 models with SQLite provider:

| # | Model | Table Name | Key Details |
|---|-------|-----------|-------------|
| 1 | PessoaFisica | pessoas_fisicas | Self-referential (titularRaizId), CPF unique |
| 2 | Vinculo | vinculos | 3-way relation: titular, vinculada, agregadoPai |
| 3 | Plano | planos | INDIVIDUAL/FAMILIAR types |
| 4 | Seguradora | seguradoras | clausulasMarkdown field |
| 5 | Contrato | contratos | Status lifecycle, FK to titular/plano/seguradora/patrocinador |
| 6 | DadosAprovacaoSeguradora | dados_aprovacao_seguradora | 1:1 with Contrato (unique contratoId) |
| 7 | Patrocinio | patrocinios | Network tree with nivelProfundidade |
| 8 | CarteiraDigital | carteiras_digitais | 1:1 with PessoaFisica (unique titularId) |
| 9 | TransacaoBonificacao | transacoes_bonificacao | FK to Contrato (origin) + CarteiraDigital |
| 10 | TransacaoPagamento | transacoes_pagamento | ABATIMENTO/SAQUE, IRRF/INSS retention |
| 11 | ContaAPagar | contas_a_pagar | Bill with gateway tracking |
| 12 | WebhookRecebido | webhooks_recebidos | Anti-duplication: @@unique([transactionId, source]) |
| 13 | Sinistro | sinistros | Claims with S3 hash (air-gap) |
| 14 | RemissaoContrato | remissoes_contrato | 1:1 with Contrato (unique contratoId) |
| 15 | LogAnonimizacaoLGPD | logs_anonimizacao_lgpd | LGPD compliance |
| 16 | ConfiguracaoRegraNegocio | configuracoes_regras_negocio | 16 mandatory keys |
| 17 | AuditLog | audit_logs | Append-only, JSON before/after values |
| 18 | User | users | RBAC: SUPERADMIN/SUPERVISOR/FINANCEIRO/SUPORTE/CLIENTE |
| 19 | NivelBonificacao | niveis_bonificacao | 5 levels with decreasing percentages |

**Note**: SQLite doesn't support `@db.Text` — removed the annotation from `clausulasMarkdown` in Seguradora. All JSON fields stored as String (SQLite has no native JSON type).

### 2. Seed File (`prisma/seed.ts`)
- 16 business configuration keys with proper types (INT/DECIMAL/BOOLEAN/VARCHAR)
- 2 plans: Individual (R$29.90) and Familiar (R$49.90)
- 2 insurance companies: Seguradora Alpha and Seguradora Beta
- 5 bonus levels: 10%, 5%, 3%, 2%, 1%
- SuperAdmin user: admin@granpaz.com
- Demo Cliente user: maria.silva@demo.com (with PessoaFisica + CarteiraDigital)

### 3. Package.json
Added `"db:seed": "bun run prisma/seed.ts"` script.

### 4. Database
- `bun run db:push` executed successfully
- `bun run db:seed` executed successfully — all seed data inserted

## Decisions
- Used `@default(cuid())` for all ID fields (SQLite-compatible)
- JSON fields stored as `String` type since SQLite doesn't have a native JSON type; service layer handles parsing
- Used upsert in seed file for idempotency
- Simple hash strings for dev passwords (production should use bcrypt/argon2)
