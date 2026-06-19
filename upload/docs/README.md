# Granpaz / Saúde & Proteção — SPF

**Sistema de Proteção Familiar** — Plataforma SaaS para administração de Planos de Proteção Familiar (clube de benefícios com cobertura funeral e proteção financeira).

Atuamos como **Estipulante** conforme diretrizes SUSEP, conectando titulares a Seguradoras Parceiras.

---

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js 14+ (App Router), React Server Components, Tailwind CSS |
| Backend | Node.js 20 LTS + TypeScript + NestJS |
| ORM | Prisma 5.x |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 |
| Mensageria | BullMQ |
| Storage | AWS S3 (IAM restrito) |
| Infra | Vercel/Cloudflare Edge |

---

## Módulos

| Módulo | Descrição |
| :--- | :--- |
| **01** — Contratação e Cadastro | Fluxo multi-step com `PessoaFisicaForm` reutilizável, identificação por CPF, hierarquia Titular → Dependentes → Agregados → Sub-dependentes |
| **02** — Gestão de Contratos e Aprovação | Underwriting manual (SuperAdmin), definição de capital segurado, liberação atômica de bonificação |
| **03** — Financeiro e Bonificação | Carteira digital multinível, abatimento de parcelas, saques com retenção IRRF/INSS, recorrência automática |
| **04** — Sinistro, Carência e Compliance | Air-Gap de dados clínicos (S3 + hash), validação de carência (Art. 798 CC), régua de inadimplência, remissão, LGPD |
| **05** — Rede e Patrocínio | Grafo hierárquico, realocação atômica, anti-fraude cross-tree, Air-Gap funcional (anti-CLT) |
| **06** — Configurações e Auditoria | 16 chaves obrigatórias tipadas, cache Redis + SW, logs WORM (S3 Object Lock), diagnóstico de integridade |
| **07** — Institucional e Vendas | Landing Page SSG/ISR, copy com compliance SUSEP, checkout público com Air-Gap de seguradora |

---

## Documentação

### Raiz

| Arquivo | Conteúdo |
| :--- | :--- |
| `AGENTS.md` | Diretrizes comportamentais do agente de IA e visão do projeto |
| `Protocolo de Otimização Documental.txt` | Padrão de formatação: notação em árvore, checklists, tags visuais (🚨🛡️⚠️🔒💰) |

### `00-core/` — Fundamentos do Negócio

| Arquivo | Conteúdo |
| :--- | :--- |
| `SPF Sistema de Gestão (Documentação Técnica e Regras de Negócio).txt` | Verdade Absoluta do sistema — modelo de dados completo (17 tabelas), constraints SQL, regras de componente frontend, fluxos de contratação, validação etária, hierarquia de vínculos |
| `Grapaz (Regras de Negócio e Diretrizes).txt` | 50 regras imutáveis em checklist — compliance SUSEP, validação etária, idempotência financeira, gestão de sinistro, régua de inadimplência, blindagem tributária, anti-fraude, ciclo de vida CDC, resiliência operacional |
| `Grapaz (Briefing Estratégico e Avatar de Marketing).txt` | Identidade corporativa, missão, persona (35-65 anos, provedores), matriz de dores/desejos, proposta de valor, diferenciais competitivos, hardening de comunicação SUSEP/CDC |
| `Grapaz (MANUAL DE CONFORMIDADE).txt` | Diretrizes jurídicas para Produto, Marketing, CS e Financeiro — termos proibidos vs. aprovados, disclaimer obrigatório, red flags, checklist de lançamento |
| `Grapaz (prompt master).txt` | Orquestrador de desenvolvimento com 4 agentes especializados (Frontend, Backend, Compliance, QA), workflow de desenvolvimento, skills por módulo, checklist master de deploy |
| `Grapaz (PRD).md` | Product Requirements Document completo — visão geral, arquitetura, compliance, KPIs, riscos |
| `relatorio-cores.md` | Modelo de cores OKLCH — paleta completa light/dark, design tokens GranSaúde, cores da logo, cores adicionais do layout |

### `03-functional-specs/` — Especificações Funcionais

| Arquivo | Conteúdo |
| :--- | :--- |
| `SPEC-01 (Módulo de Contratação e Cadastro).txt` | Fluxo de entrada: `PessoaFisicaForm` multi-step, identificação unificada (CPF), validação etária, hierarquia Titular→Dependentes→Agregados→Sub-dependentes, ADRs, contratos de API, DDL financeiro harmonizado |
| `SPEC-02 (Módulo de Gestão de Contratos e Aprovação).txt` | Backoffice: fila de aprovação manual, atomicidade (aprovação + liberação de bonificação), gestão de endossos, CRUD de seguradoras, sanitização de markdown, geração assíncrona de PDF |
| `SPEC-03 (Módulo Financeiro e de Bonificação).txt` | Carteira digital, bonificação multinível (percentuais por nível), abatimento de parcelas, saques com retenção IRRF/INSS, recorrência automática, idempotência financeira, concorrência, estorno com saldo devedor |
| `SPEC-04 (Módulo de Sinistro, Carência e Compliance Legal).txt` | Air-Gap de dados clínicos (S3 + hash), validação de carência (acidental/natural/suicídio Art. 798 CC), suspensão por inadimplência, remissão automática, arrependimento CDC, expulsão por maioridade, anonimização LGPD |
| `SPEC-05 (Módulo de Rede e Patrocínio).txt` | Grafo hierárquico multinível, realocação atômica com recálculo em cascata, anti-fraude cross-tree, Air-Gap funcional anti-CLT, exportação CSV via streaming, prevenção de ciclos |
| `SPEC-06 (Módulo de Configurações e Auditoria).txt` | 16 chaves obrigatórias tipadas, cache Redis + Service Worker, trilha de auditoria imutável (WORM S3), jobs de diagnóstico (órfãos, ciclos, duplicidade, saldo devedor), detecção de termos CLT |
| `SPEC-07 (Módulo Institucional e Vendas).txt` | Landing Page SSG/ISR (Next.js), copywriting com compliance SUSEP, Air-Gap de seguradora no checkout, SEO (schema.org), Core Web Vitals, validação de termos proibidos em build time |

### `05-frontend-ux/` — Interface e Experiência

| Arquivo | Conteúdo |
| :--- | :--- |
| `Grapaz (Design System UI).txt` | Tokens OKLCH (zero preto/branco puros), tipografia fluida (Fraunces/Manrope/JetBrains), spacing grid 8px, sombras tintadas, componentes (Button, FormField, PessoaFisicaForm, ComplianceBanner, WalletCard), mapeamento de telas, acessibilidade WCAG AA, naming convention |
| `Grapaz (COPY PARA PÁGINA INSTITUCIONAL).txt` | Copy pronta para Landing Page — Hero, storytelling comparativo, solução/benefícios, FAQ estratégico, inversão de risco (garantia 7 dias), rodapé de compliance com CNPJ e aviso SUSEP |

---

## Compliance

- **SUSEP:** Sistema atua como Estipulante. Underwriting manual. Bonificação nunca sobre prêmio.
- **LGPD:** Air-Gap de dados clínicos. Anonimização 5 anos pós-evento. Criptografia AES-256.
- **CDC:** Arrependimento 7 dias (status `CANCELADO_CDC`). Notificação prévia de suspensão.
- **Anti-CLT:** Air-Gap funcional — sem metas, horários, ponto ou subordinação.

---

## RBAC

| Perfil | Acesso |
| :--- | :--- |
| SuperAdmin | Tudo (aprovação, config, rede, financeiro) |
| Supervisor | Visão hierárquica + auxílio cadastral |
| Financeiro | Contas, inadimplência, aprovação de saques |
| Suporte | Correção cadastral, logs, diagnóstico |
| Cliente/Revendedor | Dashboard, autogestão, indicações |

---

## Início Rápido

```bash
# Frontend
cd apps/web
npm install
npm run dev

# Backend
cd apps/api
npm install
npx prisma migrate dev
npm run start:dev
```
