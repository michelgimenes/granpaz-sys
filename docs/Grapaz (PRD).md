# PRD - Product Requirements Document

## Granpaz / Saúde & Proteção — Plano de Proteção Familiar (SPF)

**Versão:** 1.0.0
**Data:** 19/06/2026
**Autor:** Arquiteto Chefe de Desenvolvimento
**Status:** ✅ Aprovado

---

## 1. Visão Geral do Produto

### 1.1 Propósito

Plataforma SaaS 100% digital para administração de **Planos de Proteção Familiar** (clube de benefícios com cobertura funeral). A empresa atua exclusivamente como **Estipulante** conforme diretrizes SUSEP, conectando titulares a Seguradoras Parceiras — nunca como seguradora ou corretora.

### 1.2 Problema que Resolve

Famílias brasileiras de renda média (2+ salários mínimos) não possuem acesso a proteção funeral e financeira acessível, digital e sem burocracia. O mercado tradicional de seguros é caro, complexo e emocionalmente desgastante. O Granpaz resolve com:
- Mensalidade acessível (menos que um lanche no fim de semana)
- Atendimento 100% digital
- Cobertura nacional
- Acionamento direto via central 24h da Seguradora Parceira

### 1.3 Público-Alvo

| Atributo | Perfil |
| :--- | :--- |
| **Idade** | 35–65 anos (foco 45–65) |
| **Renda** | A partir de 2 salários mínimos |
| **Perfil** | Pais/mães, provedores, casados/união estável, com filhos |
| **Psicografia** | Preventivos, valorizam paz de espírito, legado familiar |

---

## 2. Proposta de Valor e Diferenciais

### 2.1 Proposta de Valor

> Para pais e mães que desejam evitar o endividamento familiar póstumo, o Plano Granpaz é um Plano de Proteção Familiar que garante acesso a uma rede de assistência funeral e proteção financeira. Conectamos sua família a seguradoras parceiras que assumem a burocracia e os custos do adeus em todo o Brasil.

### 2.2 Diferenciais Competitivos

- **Cobertura nacional** com translado em qualquer estado
- **Acionamento direto** — sem intermediários na hora da dor
- **Custo zero no adeus** — seguradora parceira liquida despesas
- **Proteção em vida** — indenização por invalidez acidental
- **App exclusivo** — gestão digital do plano

### 2.3 Coberturas (via Seguradora Parceira)

| Cobertura | Descrição |
| :--- | :--- |
| Assistência Funeral Nacional | Translado, taxas, sepultamento ou cremação |
| Indenização por Morte Acidental | Amparo financeiro à família |
| Invalidez Total/Parcial por Acidente | Proteção em vida para o titular |
| **Não cobre** | Aquisição de jazigo |

---

## 3. Arquitetura do Sistema — 7 Módulos

### 3.1 Módulo 1 — Contratação e Cadastro Unificado

**Componente Core:** `PessoaFisicaForm` (reutilizável via props/contexto)

**Hierarquia de Vínculos:**
```
TITULAR
├── DEPENDENTE (cônjuge/filho — até 8 no plano familiar)
├── AGREGADO (9 parentescos — até 4 por contrato)
│   └── SUB_DEPENDENTE (cônjuge/filho do agregado)
```

**Funcionalidades:**
- [ ] Identificação Unificada (CPF + Data Nascimento) com validação algorítmica e busca assíncrona
- [ ] Seleção de plano (Individual vs. Familiar) com filtro dinâmico
- [ ] Fluxo multi-step: Plano → Titular → Dependentes → Agregados → Resumo
- [ ] Validação etária transiente (idade limite por tipo/parentesco)
- [ ] Tag "SEM DIREITO À PROTEÇÃO" para filhos > idade cobertura
- [ ] Upload de documento/selfie para validação de identidade

🛡️ **Hardening:**
- Backend valida `tipo_registro` vs. Rota (Erro 400 se incompatível)
- Idempotência de submissão (constraint unique de contrato ativo por titular)
- Air-Gap de seguradora no frontend público (proibido exibir dados de seguradora no checkout)

---

### 3.2 Módulo 2 — Gestão de Contratos e Aprovação (Backoffice)

**Domínio exclusivo SuperAdmin.** Garantia de compliance SUSEP (underwriting manual).

**Funcionalidades:**
- [ ] Fila de Aprovação Manual (listagem paginada com filtros)
- [ ] Visualização em Árvore Hierárquica (Titular → Vínculos)
- [ ] Formulário de Aprovação (Capital Segurado + Código Seguradora + Data Início)
- [ ] Ação Atômica: Aprovar (Gera PDF, libera bonificação) ou Rejeitar (estorna cascata)
- [ ] Gestão de Endossos (upgrade/downgrade, exclusão de vínculos, alteração de capital)
- [ ] CRUD de Seguradoras com editor Markdown + sanitização server-side

🚨 **Regras Críticas:**
- Imutabilidade pós-aprovação: campos financeiros read-only via trigger
- Capital segurado editável apenas por SuperAdmin
- Aprovação acoplada transacionalmente à liberação de bonificação

---

### 3.3 Módulo 3 — Financeiro e Bonificação (Multinível)

**Separação estrita:** receita tributável (clube) vs. repasse de risco (seguro).

**Base de Cálculo da Bonificação:**
```
Incidência EXCLUSIVA sobre:
├── Taxa de Adesão (pagamento único inicial)
└── Valor das Parcelas Mensais/Anuais do Plano
🚨 PROIBIDO: Prêmio de Seguro / Capital Segurado / Assistência Funeral
```

**Funcionalidades:**
- [ ] Carteira Digital do Revendedor (saldo disponível, bloqueado, devedor)
- [ ] Abatimento de parcelas via bonificação (com boleto residual se parcial)
- [ ] Saques com retenção IRRF/INSS (quando `SAQUE_PF_ATIVO = true`)
- [ ] Maker/Checker para valores acima do teto
- [ ] Recorrência automática (job diário gera parcelas de contratos ativos)
- [ ] Idempotência absoluta (`idx_bonificacao_unica`: origem_contrato + carteira + nivel)

🛡️ **Hardening:**
- Lock distribuído (Redis) para evitar race conditions em abatimentos
- Saldo devedor explícito — bloqueia novos saques até regularização
- Constraint de idempotência de webhook: `UNIQUE (transaction_id, source)`

---

### 3.4 Módulo 4 — Sinistro, Carência e Compliance Legal

**Air-Gap de dados clínicos:** DB relacional armazena apenas hash SHA-256; documento original em S3 com IAM restrito.

**Funcionalidades:**
- [ ] Acionamento e Análise de Sinistro (upload via Presigned URL → S3)
- [ ] Validação automática de carência (acidental 72h, natural 6 meses, suicídio 24 meses — Art. 798 CC)
- [ ] Régua de Inadimplência e Suspensão (job diário + notificação CDC obrigatória)
- [ ] Fluxo de Récita (reintegração + recálculo de carência proporcional)
- [ ] Remissão Automática (isenção de mensalidades pós-óbito do titular)
- [ ] Cancelamento CDC (7 dias, estorno integral, zero multa)
- [ ] Job de Expulsão por Maioridade (21 anos)
- [ ] Job de Anonimização LGPD (5 anos pós-evento, hash irreversível com salt)

🔒 **Segurança Jurídica:**
- Prevalência da Apólice sobre configurações globais (`PREVALENCIA_APIOLICE_SOBRE_CONFIG`)
- Outbox Pattern: notificação CDC na mesma transação da suspensão
- Logs de anonimização forense (hash + salt)

---

### 3.5 Módulo 5 — Rede e Patrocínio

**Gestão da árvore comercial com prevenção de fraudes.**

**Funcionalidades:**
- [ ] Visualização em Grafo hierárquico de patrocínios ativos
- [ ] Realocação Atômica (recálculo em cascata de `nivel_profundidade` na mesma transação)
- [ ] Exportação CSV da estrutura de rede (streaming, sem estouro de memória)
- [ ] Histórico imutável (INSERT + `data_fim_vinculo`; DELETE e UPDATE proibidos)

⚠️ **Anti-Fraude e AML:**
- [ ] Bloqueio de auto-patrocínio e ciclos familiares diretos
- [ ] Validação Cross-Tree (CPF não pode estar ativo em múltiplas redes)
- [ ] ⚠️ Air-Gap Funcional: ausência total de termos CLT (meta, horário, ponto, chefe)

---

### 3.6 Módulo 6 — Configurações e Auditoria

**Centralização de parâmetros mutáveis e logs imutáveis.**

**16 Chaves Obrigatórias (Seed Inicial):**

| Categoria | Chaves |
| :--- | :--- |
| 🧠 Idades | `IDADE_LIMITE_TITULAR`, `IDADE_LIMITE_CONJUGE`, `IDADE_LIMITE_DEPENDENTE`, `IDADE_COBERTURA_FILHO`, `IDADE_LIMITE_AGREGADO`, `IDADE_LIMITE_SUB_DEPENDENTE`, `IDADE_COBERTURA_SUB_FILHO` |
| ⏳ Carências | `DIAS_CARENCIA_ACIDENTAL`, `MESES_CARENCIA_NATURAL`, `MESES_CARENCIA_SUICIDIO` |
| 💰 Financeiro | `MESES_REMISSAO_OBITO_PADRAO`, `DIAS_SUSPENSAO_INADIMPLENCIA`, `SAQUE_PF_ATIVO`, `LIMITE_SAQUE_DIARIO` |
| 🔒 Segurança | `HASH_ASSINATURA_PDF_SALT`, `PREVALENCIA_APIOLICE_SOBRE_CONFIG` |

**Funcionalidades:**
- [ ] CRUD de chaves tipadas com validação de tipo (INT, DECIMAL, BOOLEAN, VARCHAR)
- [ ] Cache Redis + Frontend Service Worker (TTL 5 min) + invalidação via evento
- [ ] Auditoria WORM (append-only, S3 Object Lock por 5 anos)
- [ ] Ferramentas de Diagnóstico (órfãos, ciclos, duplicidade de CPF, saldo devedor)
- [ ] Detecção de Air-Gap Funcional (regex de termos CLT)

---

### 3.7 Módulo 7 — Institucional e Vendas (Landing Page)

**Frontend público com SSG/ISR (Next.js) para performance máxima.** Essencial para conversão e compliance de marketing.

**Seções da Landing Page:**
1. **Hero:** Promessa + CTA "Quero Proteger Minha Família"
2. **Storytelling:** Comparativo "Família Despreparada" vs. "Família Protegida"
3. **Solução:** 4 cards de benefícios (Custo Zero, Nacional, Indenização, Proteção em Vida)
4. **FAQ:** Accordion de quebra de objeções (preço, confiança, abrangência)
5. **Footer:** ComplianceBanner (Disclaimer SUSEP obrigatório)

🛡️ **Compliance de Copywriting:**
- Termos PROIBIDOS: "nosso seguro", "nós garantimos", "comissão", "corretora"
- Termos OBRIGATÓRIOS: "Acesso a seguro", "proteção garantida pela Seguradora Parceira", "bonificação"
- Script de CI (`eslint-plugin-susep`) bloqueia build se detectar termos proibidos
- Rodapé hardcoded com CNPJ da Administradora + aviso SUSEP

---

### 3.8 Módulo 8 — Autenticação e Gestão de Usuários

**CRUD de usuários do sistema com controle de perfis RBAC.** Essencial para autonomia administrativa sem acesso direto ao banco.

**Funcionalidades:**
- [ ] Listagem de usuários com busca e filtros (perfil, status ativo/inativo)
- [ ] Criação de usuário com atribuição de perfil (SUPERADMIN/SUPERVISOR/FINANCEIRO/SUPORTE/CLIENTE)
- [ ] Edição de dados cadastrais, perfil e status ativo/inativo
- [ ] Reset de senha (geração de senha temporária)
- [ ] Registro de auditoria em todas as operações
- [ ] Bloqueio de auto-desativação do SUPERADMIN

---

## 4. Design System (Frontend)

### 4.1 Cores — Modelo OKLCH

| Token | Light | Dark | Uso |
| :--- | :--- | :--- | :--- |
| `--brand-primary` | `#0073F1` | `#3B8CFF` | Botões, CTAs, links |
| `--brand-accent` | `#00EACD` | `#00EACD` | Destaques, sidebar |
| `--background` | `#F5F8FC` | `#0A1628` | Fundo geral |
| `--state-success` | `#16A34A` | — | Aprovação |
| `--state-warning` | `#D97706` | — | Alerta |
| `--state-error` | `#DC2626` | `#EF5350` | Erro, destrutivo |

🛡️ **Regra Imutável:** Zero preto puro (`#000000`) e zero branco puro (`#FFFFFF`). Todos neutros com tint azul (Hue 260°).

### 4.2 Tipografia

| Contexto | Fonte | Uso |
| :--- | :--- | :--- |
| Display/LP | `Fraunces` (serifada) | Títulos institucionais, empatia |
| UI/Dados | `Manrope` (sans-serif) | Backoffice, formulários, tabelas |
| Mono | `JetBrains Mono` | CPF, hashes, dados técnicos |

### 4.3 Componentes Críticos

| Componente | Descrição |
| :--- | :--- |
| `Button` | 4 variantes (primary, secondary, ghost, destructive), 3 sizes, loading state |
| `FormField` | Wrapper acessível com label, erro, hint, foco visível |
| `PessoaFisicaForm` | Multi-step contextual (sessionType: TITULAR/DEPENDENTE/AGREGADO/SUB_DEPENDENTE) |
| `ComplianceBanner` | Disclaimer SUSEP obrigatório em telas públicas |
| `WalletCard` | Dashboard financeiro do revendedor (3 cards de saldo) |

---

## 5. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14+ (App Router), React Server Components, Tailwind CSS | SSG/ISR, performance, SEO |
| **Backend** | Node.js 20 LTS + TypeScript + NestJS | Modular, DI, type-safe |
| **ORM** | Prisma 5.x | Migrations automáticas |
| **Banco** | PostgreSQL 16 | ACID, JSONB, Recursive CTEs, Partial Unique Indexes |
| **Cache** | Redis 7 | Sessão, cache de config, locks distribuídos |
| **Mensageria** | BullMQ (Redis-based) | Retry, DLQ, job scheduling |
| **Edge/CDN** | Vercel/Cloudflare | LCP < 1.2s |
| **Storage** | AWS S3 (IAM restrito, SSE-KMS) | Air-Gap de documentos clínicos, WORM de auditoria |

---

## 6. Modelos de Dados — Tabelas Core

### `pessoas_fisicas`
| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | UUID PK | Auto |
| `cpf` | VARCHAR(14) | **UNIQUE**, alphanum (futuro-proof) |
| `tipo_registro` | ENUM | TITULAR/DEPENDENTE/AGREGADO/SUB_DEPENDENTE (definido por endpoint) |
| `titular_raiz_id` | FK | Condicional (obrigatório se não for TITULAR) |

### `vinculos`
| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `tipo_vinculo` | ENUM | DEPENDENTE/AGREGADO/SUB_DEPENDENTE |
| `parentesco` | ENUM | CONJUGE, FILHO, PAI_MAE, SOGRO, ENTREADO, NETO, AVO, IRMAO, TIO |
| `agregado_pai_id` | FK | Obrigatório se SUB_DEPENDENTE |
| `data_fim_vinculo` | DATE | Exclusão lógica |

### `contratos`
| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `status` | ENUM | AGUARDANDO_APROVACAO/APROVADO/REJEITADO/CANCELADO/SUSPENSO/CANCELADO_CDC |
| `titular_id` | FK | Unique condicional: apenas 1 contrato ativo (APROVADO/SUSPENSO) por titular |

### `patrocinios`
| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `nivel_profundidade` | INT | Recalculado atomicamente em cascata |
| `data_fim_vinculo` | TIMESTAMP | NULL se ativo. Histórico imutável |
| **Constraint** | Partial Unique Index | `WHERE data_fim_vinculo IS NULL` — apenas 1 vínculo ativo por revendedor |

### `transacoes_bonificacao`
| Constraint | Propósito |
| :--- | :--- |
| `UNIQUE (origem_contrato_id, carteira_id, nivel_origem)` | Idempotência absoluta |

### `webhooks_recebidos`
| Constraint | Propósito |
| :--- | :--- |
| `UNIQUE (transaction_id, source)` | Anti-duplicidade de retry de gateway |

---

## 7. Matriz de Permissões (RBAC)

| Perfil | Acessos |
| :--- | :--- |
| **SuperAdmin** | Fila de Aprovação, CRUD Seguradoras/Regras, Gestão de Rede, Financeiro Global, Logs de Anonimização |
| **Supervisor** | Acesso igual ao Cliente/Revendedor (meus dados, plano, carteira, indicações) + visão hierárquica da rede/patrocínio. Sem acesso a: aprovação, contratos de terceiros, sinistros, financeiro, seguradoras, configurações ou auditoria |
| **Financeiro** | Contas a pagar, inadimplência, reconciliação, aprovação de saques > limite |
| **Suporte** | Correção cadastral, logs, diagnóstico (sem financeiro/aprovação) |
| **Cliente/Revendedor** | Dashboard, autogestão, indicações, abatimento de parcelas, solicitação de saque |

---

## 8. Compliance e Blindagem Jurídica

### 8.1 SUSEP (Circular 666/2022)
- [ ] Sistema atua exclusivamente como **Estipulante** — risco é da Seguradora Parceira
- [ ] Air-Gap de seguradora no frontend público (cliente nunca vê `seguradora_id`)
- [ ] Underwriting manual (capital segurado definido pelo SuperAdmin)
- [ ] Bonificação incide apenas sobre clube, nunca sobre prêmio de seguro
- [ ] Rodapé com CNPJ da Administradora + Declaração de Estipulante + Aviso SUSEP

### 8.2 LGPD (Art. 5º e 15)
- [ ] Dados clínicos em Air-Gap (apenas hash SHA-256 no DB; documento no S3)
- [ ] Anonimização irreversível (hash + salt) após 5 anos do fim do vínculo
- [ ] Criptografia AES-256-GCM para CPF e dados bancários em repouso
- [ ] Logs de auditoria imutáveis (WORM storage, 5 anos de retenção)

### 8.3 CDC (Art. 39 e 49)
- [ ] Arrependimento em 7 dias com estorno integral e zero multa (status `CANCELADO_CDC`)
- [ ] Notificação prévia obrigatória antes de suspensão por inadimplência
- [ ] Anti-Venda Casada: cancelamento da proteção não cancela o clube
- [ ] Fluxo de cancelamento disponível diretamente na plataforma

### 8.4 Código Civil (Art. 798)
- [ ] Carência de 24 meses para suicídio (bloqueio de indenização, manutenção de assistência básica)

### 8.5 Compliance Trabalhista (Anti-CLT)
- [ ] Air-Gap Funcional: proibição absoluta de metas, horários, ponto, chefe, salário
- [ ] Termo usado: "Patrocinador" (não "chefe"), "Objetivo Comercial" (não "meta"), "Saldo" (não "salário")

---

## 9. KPIs e Métricas de Sucesso

| Categoria | Métrica | Alvo |
| :--- | :--- | :--- |
| **Performance** | LCP (Landing Page) | < 1.2s |
| **Performance** | Latência p99 submissão contrato | < 350ms |
| **Performance** | Latência p99 abatimento parcela | < 200ms |
| **Conversão** | Visitante → Submissão de Contrato | > 4.5% |
| **Qualidade** | Cobertura de testes E2E | 100% |
| **Segurança** | Injeção tipo_registro inválido | 0% (bloqueio 400) |
| **Compliance** | Termos proibidos no DOM | 0 (bloqueio em build time) |
| **Financeiro** | Duplicidade de transações | 0 ocorrências |
| **Operacional** | Taxa de estornos manuais | < 0.5% |
| **Disponibilidade** | SLA do sistema | 99.95% |

---

## 10. Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
| :--- | :--- | :--- | :--- |
| Violação de Compliance SUSEP | Baixa | Crítico | Air-Gap + Code Review + Build-time lint |
| Vazamento de dados clínicos | Baixa | Crítico (LGPD) | S3 IAM restrito + hash apenas no DB |
| Multa PROCON (suspensão sem notificação) | Média | Crítico | Outbox Pattern na transação de suspensão |
| Fraude Cross-Tree (CPF em múltiplas redes) | Baixa | Alto | Validação em camada de serviço + job noturno |
| Passivo Trabalhista (vínculo CLT) | Baixa | Crítico | Air-Gap Funcional + regex scan |
| Deadlock em recálculo de árvore | Média | Alto | FOR UPDATE com ORDER BY determinístico |
| Stale Cache no Frontend | Média | Alto | WebSocket + Event Bus + TTL curto (5 min) |

---

## 11. Glossário

| Termo | Definição |
| :--- | :--- |
| **Estipulante** | PJ que contrata seguro coletivo em nome de clientes (Saúde & Proteção) |
| **Air-Gap** | Isolamento lógico de dados sensíveis (seguradora, clínicos, CLT) |
| **Bonificação** | Remuneração comercial (nunca "comissão") |
| **Récita** | Reativação de contrato suspenso + recálculo de carência |
| **Remissão** | Isenção de mensalidades pós-óbito do titular |
| **Saldo Devedor** | Passivo financeiro (estorno > saldo disponível) — bloqueia saques |
| **Sub-dependente** | Dependente vinculado ao agregado (não ao titular) |
