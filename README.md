# Granpaz — Plano de Proteção Familiar

SaaS multi-tenant para administração de benefícios coletivos (proteção funeral e auxílio financeiro) da **Saúde & Proteção Administração de Benefícios**, operando como **Estipulante** conforme diretrizes SUSEP.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (standalone) |
| Linguagem | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| State | Zustand, TanStack React Query |
| Banco | SQLite via Prisma ORM |
| Auth | next-auth + RBAC manual |
| Formulários | react-hook-form + Zod |
| Gráficos | Recharts |
| Animação | Framer Motion |
| Build | Bun |

## Estrutura do Projeto

```
src/
├── app/
│   ├── page.tsx                    # Landing page + SPA routing (checkout/login/dashboard)
│   ├── layout.tsx                  # Root layout com fonts, Schema.org, ThemeProvider, Toaster
│   ├── globals.css                 # Design tokens (state-success, state-warning, state-error)
│   └── api/                        # 48 endpoints REST
│       ├── planos/                 # Planos públicos (Air-Gap: sem dados de seguradora)
│       ├── contratos/              # CRUD + aprovar/rejeitar/suspender/cancelar-cdc/endosso
│       ├── pessoas-fisicas/        # Identificação unificada por CPF + estado civil
│       ├── carteiras/              # Carteiras digitais, transações, saques, abatimentos, extratos
│       ├── auth/login/             # Autenticação (dev hash)
│       ├── rede/                   # Árvore de patrocínio, subordinados, realocar, validar CLT, exportar CSV
│       ├── compliance/             # LGPD (anonimização automática/manual), maioridade, suspensão-auto
│       ├── sinistros/              # Criação com validação de carência (RN-01/RN-02)
│       ├── seguradoras/            # Parceiras + testar-pdf
│       ├── patrocinios/            # Gestão de patrocínios
│       ├── planos/                 # Planos ativos
│       ├── contas-a-pagar/         # Contas a pagar
│       ├── configuracoes/          # Regras de negócio dinâmicas
│       ├── admin/saques/           # Maker/Checker com aprovação/rejeição
│       ├── audit-logs/             # Audit trail paginado e filtrável
│       ├── diagnostico/            # Air-Gap CLT, integridade (5 checks)
│       ├── jobs/recorrencia/       # Geração automática de mensalidades
│       ├── viacep/                 # Consulta de CEP
│       └── webhooks/pagamento/     # Webhook idempotente de gateway de pagamento
├── components/
│   ├── landing/                    # Header, Hero, Storytelling, Solution, FAQ, Urgency, ComplianceFooter, CookieConsent
│   ├── checkout/                   # CheckoutFlow (4 etapas), PessoaFisicaForm
│   ├── dashboard/                  # Overview, Contracts, Financial, Network, Claims, Approval, Audit, Config, Seguradoras
│   ├── auth/                       # LoginModal
│   ├── app/                        # DashboardContent
│   └── ui/                         # 44 componentes shadcn/ui personalizados
├── lib/
│   ├── db.ts                       # Singleton PrismaClient
│   ├── store.ts                    # Zustand store (view, user, checkout, feature flags, draft)
│   ├── auth-helpers.ts             # checkSuperAdmin, checkFinanceiroOrAdmin, extractRequestMeta
│   ├── validations.ts              # RN-01 a RN-07: idade, carência, remissão, vínculos
│   ├── sanitization.ts             # Sanitização centralizada (SPEC-01 §5.4)
│   ├── helpers.ts                  # formatCPF, validateCPF, formatCurrency, formatDate, formatPhone, formatCEP
│   ├── rate-limit.ts               # Rate limiting em memória (10 req/min escrita, 100 req/s leitura)
│   ├── inactivity.ts               # Timeout de inatividade no checkout (15 min aviso, 20 min LGPD)
│   └── utils.ts                    # Utilitários (cn, class-variance-authority)
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
```

## Modelo de Dados (Prisma — SQLite)

### Pessoas e Vínculos
- **PessoaFisica** — Cadastro único de pessoas (TITULAR / DEPENDENTE / AGREGADO / SUB_DEPENDENTE), com auto-relacionamento para titular raiz
- **Vinculo** — Hierarquia familiar (CONJUGE, FILHO, PAI_MAE, SOGRO, ENTREADO, NETO, AVO, IRMAO, TIO) com suporte a sub-dependentes

### Planos e Contratos
- **Plano** — Definições de planos INDIVIDUAL ou FAMILIAR com valores, limites de dependentes/agregados
- **Contrato** — Fluxo completo de lifecycle: AGUARDANDO_APROVACAO → APROVADO / REJEITADO / CANCELADO / SUSPENSO / CANCELADO_CDC
- **DadosAprovacaoSeguradora** — Dados da aprovação pela seguradora (1:1 com contrato)
- **Seguradora** — Parceiras com cláusulas em Markdown e dados SUSEP

### Rede de Patrocínios
- **Patrocinio** — Árvore multi-nível com profundidade, suporte a realocação com detecção de ciclos
- **NivelBonificacao** — Percentuais por nível (indicação + fechamento)

### Financeiro
- **CarteiraDigital** — Saldo disponível, bloqueado e devedor por titular
- **TransacaoBonificacao** — Bonificações PENDENTE_APROVACAO → LIBERADO → ESTORNADO
- **TransacaoPagamento** — ABATIMENTO (pagamento de parcelas) e SAQUE (com IRRF + INSS)
- **ContaAPagar** — Parcelas mensais com status PENDENTE / PARCIALMENTE_PAGO / PAGO / VENCIDO / CANCELADO

### Sinistros
- **Sinistro** — OBITO_NATURAL, OBITO_ACIDENTAL, SUICIDIO, INVALIDEZ_TOTAL, INVALIDEZ_PARCIAL com validação de carência e Air-Gap clínico (apenas hash SHA-256)
- **RemissaoContrato** — Remissão de mensalidades pós-óbito

### Compliance e Auditoria
- **AuditLog** — Append-only com entidade, ação, atorID, IP, valores anteriores/novos
- **LogAnonimizacaoLGPD** — Registro de anonimização com hash salted para reconstituição
- **ConfiguracaoRegraNegocio** — 16 chaves dinâmicas (limites de idade, carência, saque, etc.)
- **WebhookRecebido** — Idempotência por transactionId + source

## Regras de Negócio Implementadas

| RN | Descrição | Localização |
|----|-----------|-------------|
| RN-01 | Titular com contrato ativo não pode contratar novamente | `validations.ts:38` |
| RN-02 | Validação de idade por tipo de registro e parentesco | `validations.ts:53` |
| RN-03 | Sub-dependente requer agregado CASADO/UNIAO_ESTAVEL | `validations.ts:119` |
| RN-04 | Air-Gap Semântico (CLT/SUSEP) — proibição de termos trabalhistas | `rede/validar-clt`, `diagnostico/airgap-clt`, `eslint-rules/susep-compliance.js` |
| RN-05 | Limpeza de dados sensíveis ao sair do checkout (LGPD) | `store.ts:76`, `inactivity.ts` |
| RN-06 | "SEM DIREITO À PROTEÇÃO" para dependentes acima da idade de cobertura | `validations.ts:98` |
| RN-07 | Cálculo de meses de remissão (apólice > config padrão) | `validations.ts:275` |
| RN-001 | Bonificação: base de cálculo = taxa de adesão + mensalidade | `contratos/route.ts:518` |
| RN-002 | Idempotência de bonificação (unique constraint contrato+carteira+nível) | schema: `@@unique([origemContratoId, carteiraId, nivelOrigem])` |
| RN-003 | Abatimento: permite parcial se saldo < valor da parcela | `carteiras/abatimentos/route.ts:115` |
| RN-004 | Estorno de bonificação | schema: `TransacaoBonificacao.status` |
| RN-005 | IRRF progressivo 2026 + INSS 11% sobre saques | `carteiras/saques/route.ts:27` |
| RN-006 | Saques acima do limite diário requerem aprovação (Maker/Checker) | `carteiras/saques/route.ts:106` |
| RN-007 | Saldo devedor bloqueia saques e abatimentos | `carteiras/saques/route.ts:88`, `carteiras/abatimentos/route.ts:94` |

## Air-Gap (Segurança por Design)

Três camadas de Air-Gap:
1. **Comercial** — Plano endpoints expõem APENAS dados de plano, nunca `seguradoraId` ou `capitalSegurado` (`planos/route.ts`)
2. **Trabalhista (CLT)** — Scan de termos proibidos em todo o banco + validação em tempo real (`diagnostico/airgap-clt`, `rede/validar-clt`)
3. **Clínico** — Sinistros aceitam apenas hash SHA-256 de documentos, nunca dados clínicos ou Base64 (`sinistros/route.ts`, `validations.ts:186`)

## Componentes de Interface

### Landing Page
- Header com navegação responsiva e CTA
- Hero com indicadores de confiança
- Storytelling comparativo (família preparada vs. despreparada)
- Solution com 4 benefícios principais
- FAQ expansível com 4 perguntas
- Urgency com garantia de 7 dias
- CookieConsent (LGPD) — carregado via `next/dynamic` com `ssr: false`
- ComplianceFooter com disclaimer SUSEP

### Checkout (4 etapas)
1. **Seleção de Plano** — Cards comparativos Individual (R$29,90) vs Familiar (R$49,90)
2. **Dados do Titular** — Formulário completo com endereço obrigatório
3. **Vínculos** — Adição de dependentes, agregados e sub-dependentes via Sheet lateral
4. **Resumo** — Revisão + checkbox de reconhecimento do Clube de Benefícios (EC-06)

Draft salvo no `sessionStorage` com expiração de 20 minutos; timeout de inatividade com aviso aos 15 min.

### Dashboard (Admin/Cliente)
Abas: Overview, Contracts, Financial, Network, Claims, Approval, Audit, Config, Seguradoras

## API Endpoints

### Públicos
- `GET /api/planos` — Lista planos ativos (Air-Gap, rate limited: 100 req/s)
- `GET /api/viacep` — Consulta de CEP
- `GET /api/contratos` — Lista contratos (paginação, filtros, Air-Gap por role)
- `GET /api/contratos/[id]` — Detalhe do contrato com vínculos

### Autenticação
- `POST /api/auth/login` — Login (dev hash)

### Checkout
- `POST /api/contratos` — Cria contrato com validação completa (rate limited: 10 req/min)
- `GET /api/pessoas-fisicas/buscar-por-cpf` — Identificação unificada

### Administrativos (SuperAdmin)
- `POST /api/contratos/[id]/aprovar` — Aprovação com liberação de bonificação
- `POST /api/contratos/[id]/rejeitar` — Rejeição
- `POST /api/contratos/[id]/suspensao` — Suspensão por inadimplência
- `POST /api/contratos/[id]/cancelar-cdc` — Cancelamento
- `POST /api/contratos/[id]/endosso` — Endosso
- `POST /api/admin/saques/[transacaoId]/aprovar` — Maker/Checker

### Rede de Patrocínio
- `GET /api/rede/arvore` — Árvore hierárquica (BFS com limite de profundidade)
- `GET /api/rede/subordinados` — Subordinados diretos/indiretos paginados
- `POST /api/rede/realocar` — Realocação atômica com detecção de ciclos
- `POST /api/rede/validar-clt` — Validação de termos CLT em tempo real
- `GET /api/rede/exportar-csv` — Exportação da rede
- `GET /api/rede/historico` — Histórico da rede

### Financeiro
- `GET /api/carteiras` — Lista carteiras
- `GET /api/carteiras/transacoes` — Transações com filtros
- `POST /api/carteiras/[carteiraId]/saques` — Saque com IRRF/INSS
- `POST /api/carteiras/[carteiraId]/abatimentos` — Abatimento de parcelas
- `GET /api/carteiras/[carteiraId]/extrato` — Extrato
- `GET /api/contas-a-pagar` — Contas a pagar

### Sinistros
- `GET /api/sinistros` — Lista sinistros (paginação, filtros)
- `POST /api/sinistros` — Cria sinistro com validação de carência e Air-Gap

### Compliance
- `POST /api/compliance/lgpd` — Anonimização LGPD (automática 5 anos ou manual)
- `POST /api/compliance/suspensao-auto` — Suspensão automática por inadimplência
- `POST /api/compliance/maioridade` — Verificação de maioridade

### Jobs e Diagnóstico
- `POST /api/jobs/recorrencia` — Geração automática de mensalidades
- `POST /api/diagnostico/integridade` — 5 checks: órfãos, ciclos, CPF duplicado, saldo devedor, Air-Gap clínico
- `POST /api/diagnostico/airgap-clt` — Scan de termos CLT em 8 entidades

### Webhooks
- `POST /api/webhooks/pagamento` — Webhook idempotente de gateway de pagamento

### Auditoria
- `GET /api/audit-logs` — Audit trail paginado (filtros: entidade, ação, data, ator)

## Segurança

- **CSP** configurado no `next.config.ts` com `frame-ancestors 'none'`
- **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**
- **Rate limiting** em memória por IP (escrita: 10 req/min, leitura: 100 req/s)
- **RBAC** 5 papéis: SUPERADMIN, SUPERVISOR, FINANCEIRO, SUPORTE, CLIENTE
- **Sanitização centralizada** no backend (SPEC-01 §5.4)
- **ESLint custom rule** para termos SUSEP proibidos (`susep-compliance.js`)
- **Draft de checkout** expira em 20 min (LGPD §4.3)
- **Logs de auditoria** append-only em todas as operações críticas

## Scripts

```bash
bun run dev            # Desenvolvimento (porta 3000)
bun run build           # Build standalone
bun run start           # Produção
bun run lint            # ESLint
bun run db:push         # Push schema to SQLite
bun run db:generate     # Generate Prisma client
bun run db:migrate      # Migrate dev
bun run db:seed         # Seed (admin@granpaz.com / maria.silva@demo.com)
```

## Infraestrutura

- **Caddyfile** — Proxy reverso na porta 81 com suporte a `XTransformPort`
- **Build standalone** — Next.js standalone output para implantação minimalista
- **SQLite** — Banco de dados local via Prisma (`db/custom.db`)
- **Mini-services** — Diretório preparado para microsserviços auxiliares
