# Modelo de Cores Para Referencia de Layout

## 1. Cores do Modo Claro (Light Mode) — Brand Blue

Definidas em `:root` no arquivo `src/app/globals.css`.

| Token            | OKLCH                         | HEX       | Amostra |
|------------------|-------------------------------|-----------|---------|
| `--background`   | `oklch(0.985 0.002 260)`      | `#F5F8FC` | Fundo geral claro, quase branco azulado |
| `--foreground`   | `oklch(0.15 0.02 260)`        | `#0A1929` | Texto principal (azul petróleo escuro) |
| `--card`         | `oklch(0.99 0.003 260)`       | `#F8FAFF` | Fundo de cards |
| `--card-foreground` | `oklch(0.15 0.02 260)`     | `#0A1929` | Texto em cards |
| `--primary`      | `oklch(0.52 0.18 260)`        | `#0073F1` | **Brand Blue (logo cruz)** — botões, links, CTAs |
| `--primary-foreground` | `oklch(0.98 0.005 260)`  | `#FFFFFF` | Texto sobre fundo primary |
| `--secondary`    | `oklch(0.96 0.008 260)`       | `#EDF2F7` | Fundo secondary (azul claro neutro) |
| `--secondary-foreground` | `oklch(0.18 0.02 260)`  | `#122240` | Texto sobre secondary |
| `--muted`        | `oklch(0.96 0.005 260)`       | `#F0F4F8` | Fundo muted |
| `--muted-foreground` | `oklch(0.45 0.015 260)`   | `#64748B` | Texto muted |
| `--accent`       | `oklch(0.94 0.01 260)`        | `#E8EEF8` | Fundo accent |
| `--accent-foreground` | `oklch(0.18 0.02 260)`   | `#122240` | Texto sobre accent |
| `--destructive`  | `oklch(0.577 0.245 27.325)`   | `#E53935` | Vermelho (ações destrutivas, erros) |
| `--border`       | `oklch(0.9 0.01 260)`         | `#D6DFE8` | Bordas de elementos |
| `--input`        | `oklch(0.9 0.01 260)`         | `#D6DFE8` | Bordas de inputs |
| `--ring`         | `oklch(0.52 0.18 260)`        | `#0073F1` | Anel de foco (brand blue) |

---

## 2. Cores do Modo Escuro (Dark Mode)

Definidas em `.dark` no arquivo `src/app/globals.css`.

| Token            | OKLCH                         | HEX       | Amostra |
|------------------|-------------------------------|-----------|---------|
| `--background`   | `oklch(0.13 0.015 260)`       | `#0A1628` | Fundo geral escuro (azul petróleo profundo) |
| `--foreground`   | `oklch(0.95 0.005 260)`       | `#E8F0FC` | Texto principal (branco azulado) |
| `--card`         | `oklch(0.17 0.015 260)`       | `#111E33` | Fundo de cards |
| `--card-foreground` | `oklch(0.95 0.005 260)`    | `#E8F0FC` | Texto em cards |
| `--primary`      | `oklch(0.6 0.16 260)`         | `#3B8CFF` | Brand blue (mais claro para dark mode) |
| `--primary-foreground` | `oklch(0.13 0.01 260)`   | `#0A1628` | Texto sobre primary |
| `--secondary`    | `oklch(0.22 0.02 260)`       | `#1A2D45` | Fundo secondary escuro |
| `--secondary-foreground` | `oklch(0.95 0.005 260)` | `#E8F0FC` | Texto sobre secondary |
| `--muted`        | `oklch(0.22 0.02 260)`       | `#1A2D45` | Fundo muted escuro |
| `--muted-foreground` | `oklch(0.6 0.02 260)`      | `#8BA1BC` | Texto muted |
| `--accent`       | `oklch(0.25 0.03 260)`       | `#1E3350` | Fundo accent escuro |
| `--accent-foreground` | `oklch(0.95 0.005 260)`   | `#E8F0FC` | Texto sobre accent |
| `--destructive`  | `oklch(0.704 0.191 22.216)`   | `#EF5350` | Vermelho (erros em dark mode) |
| `--border`       | `oklch(1 0 0 / 10%)`          | `#FFFFFF` opac. 10% | Bordas escuras |
| `--input`        | `oklch(1 0 0 / 15%)`          | `#FFFFFF` opac. 15% | Bordas de inputs |
| `--ring`         | `oklch(0.6 0.16 260)`         | `#3B8CFF` | Anel de foco (brand blue) |

---

## 3. Design Tokens GranSaúde

Definidos como variáveis CSS em `src/app/globals.css` (`--gran-*`).

| Token                    | HEX       | Descrição |
|--------------------------|-----------|-----------|
| `--gran-primary`         | `#0073F1` | **Brand Blue** (cruz da logo) — botões, links, CTAs, active states |
| `--gran-primary-light`   | `#E0ECFF` | Azul claro — hover, badges, backgrounds suaves |
| `--gran-primary-foreground` | `#FFFFFF` | Texto sobre primary |
| `--gran-accent`          | `#00EACD` | **Brand Cyan** (contorno do escudo) — acentos, dark mode destaques |
| `--gran-accent-foreground` | `#003840` | Texto sobre accent |
| `--gran-success`         | `#16A34A` | Verde — sucesso, confirmação |
| `--gran-warning`         | `#D97706` | Âmbar — alerta, overage, soft limit |
| `--gran-danger`          | `#DC2626` | Vermelho — erro, destrutivo, cancelamento |
| `--gran-info`            | `#0073F1` | Azul informativo (mesmo do brand blue) |
| `--gran-surface`         | `#F5F8FC` | Superfície clara (fundos alternativos) |
| `--gran-surface-alt`     | `#EDF2F7` | Superfície escura (headers de tabela, etc.) |
| `--gran-sidebar`         | `#0F1929` | Sidebar fundo (navy escuro) |
| `--gran-sidebar-hover`   | `#1A2940` | Sidebar hover state |
| `--gran-sidebar-active`  | `#0073F1` | Sidebar active state |

---

## 4. Cores da Logo (SVG)

Arquivo: `public/logo.svg`

A logo utiliza 3 cores definidas em classes CSS internas:

| Classe | HEX       | Descrição | Elemento |
|--------|-----------|-----------|----------|
| `.st0` | `#FFFFFF` | Branco | Parte central do escudo/coração |
| `.st1` | `#00EACD` | Ciano/turquesa claro | Contorno externo do escudo |
| `.st2` | `#0073F1` | Azul forte | Símbolo "+" central (cruz de saúde) |

Esta mesma logo é usada como favicon (`<link rel="icon" type="image/svg+xml" href="/logo.svg" />`), ícone PWA e splash screen iOS.

O `theme-color` definido no `<head>` do `index.html` é `#0073F1` — o azul da cruz central da logo.

---

## 5. Cores Adicionais no Layout

| Elemento          | Cor                           | HEX / Token          | Onde |
|-------------------|-------------------------------|----------------------|------|
| Header fundo      | bg-background/80 + backdrop-blur | `--background`     | `header.tsx` |
| Sidebar fundo     | navy escuro                   | `--gran-sidebar`     | `sidebar.tsx` |
| Sidebar active    | brand blue bg + cyan text     | `--gran-primary` / `--gran-accent` | `sidebar.tsx` |
| Login icon bg     | brand blue                    | `--gran-primary`     | `login/page.tsx` |
| Portal gradient   | blue-50 → white → cyan-50     | `#EFF6FF` / `#ECFEFF` | `portal/page.tsx` |
| Breadcrumb hover  | brand blue                    | `--gran-primary`     | `header.tsx` |
| Avatar fallback   | brand blue light + text       | `--gran-primary-light` | `header.tsx` |

---

## 6. Resumo da Identidade Visual

- **Cor primária (marca)**: `#0073F1` (Brand Blue) — âncora da logo (cruz de saúde). Usada em botões, links, CTAs, active states, focus ring.
- **Cor de destaque (marca)**: `#00EACD` (Brand Cyan) — contorno do escudo da logo. Usada em acentos na sidebar, dark mode, badges decorativos.
- **Light mode**: neutros tintados com azul (hue 260°) — fundo `#F5F8FC`, textos `#0A1929`.
- **Dark mode**: navy profundo (hue 260°) — fundo `#0A1628`, primary `#3B8CFF`.
- **Sidebar**: navy escuro `#0F1929` com active state em brand blue e ícones em brand cyan.
- **Alerta**: `#E53935` (destrutivo), `#D97706` (warning), `#16A34A` (success).
- **Perfis (RBAC)**: cores específicas não-bloqueantes — purple (superadmin), amber (admin), emerald (médico), sky (recepcionista), violet (técnico), rose (parceiro).

