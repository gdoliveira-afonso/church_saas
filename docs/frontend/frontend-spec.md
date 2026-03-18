# CRM Celular — Frontend Specification

**Projeto:** CRM Celular — SaaS multi-tenant
**Data:** 2026-03-17
**Versão:** 1.0
**Autor:** @ux-design-expert (Brownfield Discovery — Fase 3)

---

## 1. Arquitetura Frontend

### Stack Real

| Camada | Tecnologia | Versão | Modo de Uso |
|--------|-----------|--------|-------------|
| **Build** | Vite | ^7.3.1 | Dev server + bundler |
| **UI** | Vanilla JavaScript | ES Modules | Sem framework (React/Vue/etc) |
| **CSS** | Tailwind CSS | 4.x | **via CDN** (`cdn.tailwindcss.com`) |
| **Icons** | Material Symbols Outlined | — | Google Fonts CDN |
| **Fontes** | Inter | 300-800 | Google Fonts CDN |
| **Gráficos** | Chart.js | — | CDN, carregado globalmente |
| **Planilhas** | SheetJS/XLSX | 0.18.5 | CDN, carregado globalmente |
| **Router** | Custom hash-based | — | `src/router.js` — implementação própria |
| **Estado** | Custom Store class | — | `src/store.js` — sem Redux/Zustand |
| **PWA** | Service Worker | — | `public/sw.js` |

### Estrutura de Renderização

Cada view é uma **função assíncrona** que injeta HTML via `innerHTML`:

```javascript
export async function myView(params) {
  const app = document.getElementById('app');
  app.innerHTML = `<div>...</div>`;
  // Adiciona event listeners após render
}
```

**Não há Virtual DOM, diffing ou componentes reutilizáveis no sentido tradicional.**

---

## 2. Design System — Estado Atual

### Tokens de Cor (definidos em `index.html`)

```css
:root {
  --color-primary: 19 91 236; /* #135bec — azul padrão */
}
```

O `primaryColor` é **dinâmico por organização** — sobrescrito via `localStorage('system-settings')` ao inicializar.

| Token | Valor Padrão | Uso |
|-------|-------------|-----|
| `primary` | `rgb(19 91 236)` | Botões, links, destaques |
| `primary/10` | Azul 10% opacidade | Backgrounds de badges, avatars |
| `success` | `#22c55e` | Confirmações (fixo, não configurable) |
| `warning` | `#f59e0b` | Alertas (fixo) |
| `danger` | `#ef4444` | Erros, exclusões (fixo) |

**Paleta de suporte (Tailwind slate):**
- Texto: `slate-900`, `slate-700`, `slate-600`, `slate-500`, `slate-400`
- Backgrounds: `white`, `slate-50`, `slate-100`, `slate-900` (dark)
- Borders: `slate-100`, `slate-200`

**Cores por módulo:**
| Módulo | Cor Principal |
|--------|-------------|
| Receitas/Positivo (Financeiro) | `emerald` |
| Despesas/Negativo (Financeiro) | `red` |
| Alertas (Financeiro) | `amber` |
| Info (Financeiro) | `blue` |
| EBD | `amber` |
| Células | `indigo` |
| Membros | `blue` |

### Tipografia

| Elemento | Classes | Tamanho |
|---------|---------|---------|
| H1 (page title) | `text-lg font-bold` | 18px |
| H2 (section) | `text-base font-bold` | 16px |
| H3 (sub-section) | `text-sm font-bold` | 14px |
| Body | `text-sm` | 14px |
| Caption/Meta | `text-xs`, `text-[11px]`, `text-[10px]` | 12px, 11px, 10px |
| Code/Badge | `text-xs font-medium` | 12px |

**Nota:** Há uso de tamanhos arbitrários (`text-[11px]`, `text-[10px]`, `text-[13px]`) que fogem do sistema tipográfico padrão do Tailwind.

### Espaçamento e Layout

| Padrão | Classe | Uso |
|--------|--------|-----|
| Page padding mobile | `px-4 py-5 pb-24` | pb-24 reserva espaço para bottom nav |
| Page padding desktop | `md:px-6 lg:px-10` | Expansão progressiva |
| Page max-width | `max-w-7xl mx-auto` | Container máximo |
| Card | `rounded-2xl border border-slate-100 shadow-sm bg-white` | Padrão consistente |
| Header height | `h-[calc(3.5rem+env(safe-area-inset-top))]` | Safe area iOS |
| Gap grid | `gap-3` | Maioria dos grids |

### Bordas e Sombras

| Padrão | Classe |
|--------|--------|
| Card | `rounded-2xl` |
| Button | `rounded-xl` ou `rounded-lg` |
| Badge/Tag | `rounded-full` ou `rounded-lg` |
| Avatar | `rounded-full` |
| Modal | `rounded-2xl` |
| Input | `rounded-xl` |

---

## 3. Componentes Identificados

### Componentes Globais (`src/components/ui.js`)

| Componente | Função | Padrão de Uso |
|-----------|--------|--------------|
| `toast(msg, type)` | Notificação temporária (3s) | Chamado inline via import |
| `openModal(html)` | Modal global único | `window.openModal` (global) |
| `closeModal()` | Fecha modal | `window.closeModal` (global) |
| `updateSidebar(active)` | Atualiza nav desktop | Chamado por cada view |
| `bottomNav(active)` | Nav mobile + desktop | Chamado por cada view |
| `toggleTheme()` | Dark/light mode | Event listener |
| `isDark()` | Check dark mode | Helper |
| `badge(text, color)` | Pill badge | Template literal inline |
| `impersonationBanner()` | Banner SUPERADMIN | Condicional |

**Problema identificado:** `window.openModal` e `window.closeModal` poluem o escopo global. Modais não suportam múltiplas instâncias simultaneamente.

### Padrões Recorrentes por View

Cada uma das 29 views implementa independentemente:

| Padrão | Implementação | Ocorrências |
|--------|--------------|-------------|
| Loading state | `innerHTML = '...<span>Carregando...</span>...'` | 29 views |
| Header sticky | Template literal com classes idênticas | ~25 views |
| Empty state | Template inline com ícone + mensagem | ~20 views |
| Search/filter bar | Input + botões inline | ~15 views |
| KPI card | Função helper `kpi()` local em cada view | ~8 views |
| Table list | `<div>` com mapeamento de array | ~20 views |
| FAB (mobile action) | Botão fixo bottom-right | ~10 views |
| Confirm delete modal | `openModal()` com confirm/cancel | ~15 views |

**Nota Brad:** Esses padrões são altamente repetitivos. O mesmo "header sticky" é re-implementado ~25x. O mesmo "loading state" é escrito ~29x. Potencial de redução de 60-70% de código duplicado com componentes atômicos.

---

## 4. Layout e Navegação

### Layout Shell (`index.html`)

```
#app-shell
├── #sidebar (desktop: 260px, hidden mobile)
│   ├── brand-logo-container
│   ├── #sidebar-links (dinamicamente populado)
│   └── #sidebar-user (avatar, theme toggle, logout)
└── #app (main content area)
    ├── [sticky header — por view]
    ├── [content area — por view]
    └── [bottom nav — por view, mobile only]
```

### Breakpoints

| Breakpoint | Behavior |
|-----------|---------|
| `< 768px` | Bottom navigation bar, sidebar hidden |
| `768px+` | Sidebar lateral visível, sem bottom nav |
| `1280px+` | Sidebar com 280px (vs 260px default) |

### Fluxos de Navegação por Role

| Role | Rota inicial | Acesso |
|------|-------------|--------|
| SUPERADMIN | `/organizations` | Gestão multi-org |
| USER (EBD) | `/ebd` | Apenas módulo EBD |
| AGENTE_FINANCEIRO (sem role pastoral) | `/finance` | Apenas módulo financeiro |
| ADMIN/SUPERVISOR/etc | `/dashboard` | Completo |

---

## 5. Acessibilidade — Auditoria

### 🔴 Crítico

| ID | Issue | Local | WCAG |
|----|-------|-------|------|
| A11Y-01 | **`user-select: none` global no `body`** — impede seleção de qualquer texto | `index.html` global CSS | 1.3.1 |
| A11Y-02 | **Botões de ícone sem `aria-label`** — apenas `title` attribute | sidebar, header buttons | 4.1.2 |
| A11Y-03 | **Sem skip navigation link** | Todas as páginas | 2.4.1 |

### 🟠 Alto

| ID | Issue | Local | WCAG |
|----|-------|-------|------|
| A11Y-04 | **Handlers `onclick` inline** — dificulta keyboard navigation testing | Múltiplas views | 4.1.2 |
| A11Y-05 | **Modais sem trap de foco** — Tab navega fora do modal aberto | `openModal()` global | 2.1.2 |
| A11Y-06 | **Sem `role="dialog"` nos modais** | `#modal-content` | 4.1.2 |
| A11Y-07 | **Contraste de texto não verificado** para cores customizadas por org | `primaryColor` dinâmico | 1.4.3 |

### 🟡 Médio

| ID | Issue | Local | WCAG |
|----|-------|-------|------|
| A11Y-08 | **Sem `focus-visible` styles** definidos — foco invisível em alguns elementos | Global CSS | 2.4.7 |
| A11Y-09 | **Ícones sem texto alternativo** em badges e status indicators | Múltiplas views | 1.1.1 |
| A11Y-10 | **Tamanhos de toque abaixo de 44x44px** em alguns botões (`w-8 h-8` = 32px) | Sidebar, header | 2.5.5 |
| A11Y-11 | **Animações sem `prefers-reduced-motion`** — spinner, toast, splash | `index.html` CSS | 2.3.3 |

---

## 6. Performance Frontend

### Carregamento Inicial

| Resource | Tamanho Estimado | Problema |
|---------|-----------------|---------|
| Tailwind CDN | ~3MB (não purgeado) | 🔴 Crítico — todo CSS do Tailwind |
| Chart.js CDN | ~190KB | 🟡 Carregado em todas as páginas |
| SheetJS CDN | ~1.2MB | 🟡 Carregado globalmente (só usado em reports) |
| Inter font | ~100KB | 🟢 Preconnect configurado |
| Material Symbols | ~200KB (initial) | 🟢 Lazy loading nativo |

**Total estimado primeiro carregamento:** ~4.7MB+ em assets de terceiros (sem o app bundle)

### Problemas de Performance

| ID | Issue | Impacto |
|----|-------|---------|
| PERF-01 | **Tailwind CDN não purgeado** — 3MB de CSS desnecessário | 🔴 LCP, CLS |
| PERF-02 | **SheetJS carregado globalmente** — necessário só em relatórios | 🟡 TTI |
| PERF-03 | **Chart.js carregado globalmente** — só usado em finance/reports | 🟡 TTI |
| PERF-04 | **Sem code splitting** — todo app bundlado num arquivo | 🟡 FCP |
| PERF-05 | **Sem lazy loading de views** — todas importadas em `app.js` | 🟡 Bundle size |
| PERF-06 | **`innerHTML` completo a cada navegação** — sem diffing ou reutilização de DOM | 🟢 Runtime perf |

---

## 7. Débitos de UX/UI Identificados

### 🔴 Crítico

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| UX-01 | **Módulo Financeiro Fase 3 incompleto** — 9 views pendentes | Financeiro | Funcionalidade não entregue |
| UX-02 | **`user-select: none` global** — usuário não consegue copiar textos | Global | Usabilidade básica |

### 🟠 Alto

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| UX-03 | **Tailwind via CDN** — performance ruim em conexões lentas | Performance | First paint delay |
| UX-04 | **Nenhum sistema de componentes** — 29 views com código duplicado | Manutenibilidade | Inconsistências visuais crescentes |
| UX-05 | **Modal sem gestão de foco** — acessibilidade e teclado | Modais | Experiência de teclado quebrada |
| UX-06 | **Sem estados de erro padronizados** — cada view trata erro diferente | Global | Inconsistência na recuperação de erros |
| UX-07 | **Dark mode via `!important` overrides** — ~40 linhas de overrides globais | Global CSS | Manutenção cara, bugs visuais |

### 🟡 Médio

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| UX-08 | **Tamanhos de texto arbitrários** (`text-[11px]`, `text-[10px]`) | Tipografia | Fora do sistema de escala |
| UX-09 | **Sem skeleton screens** — apenas spinners genéricos | Loading states | UX de carregamento degradada |
| UX-10 | **SheetJS e Chart.js globais** — carregados mesmo quando não usados | Performance | 1.4MB extra em páginas simples |
| UX-11 | **Sem animações de transição entre páginas** | Navegação | Sensação de app menos polido |
| UX-12 | **`window.openModal` global** — não suporta modais aninhados | Modais | Limitação funcional |
| UX-13 | **Bottom nav sem indicador de estado de loading** | Mobile UX | Feedback visual ausente |

### 🟢 Baixo

| ID | Débito | Área |
|----|--------|------|
| UX-14 | **Sem favicon customizado** — apenas logo via localStorage | Branding |
| UX-15 | **PWA manifest via API** (`/api/public/settings/manifest.json`) — dependência de backend para manifest | PWA |
| UX-16 | **Nenhum teste de UI automatizado** | Qualidade |

---

## 8. Inventário de Views

| View | Arquivo | Módulo | Status |
|------|---------|--------|--------|
| Login | `login.js` | Core | ✅ |
| Dashboard | `dashboard.js` | Core | ✅ |
| Pessoas (lista) | `people.js` | Core | ✅ |
| Perfil | `profile.js` | Core | ✅ |
| Células | `cells.js` | Celular | ✅ |
| Frequência | `attendance.js` | Celular | ✅ |
| Relatórios | `reports.js` | Core | ✅ |
| Configurações | `settings.js` | Core | ✅ |
| Calendário | `calendar.js` | Core | ✅ |
| Gerações | `generations.js` | Celular | ✅ |
| Formulários | `form-builder.js` | Forms | ✅ |
| Triagem | `settings.js` (triageView) | Forms | ✅ |
| API Keys | `api-keys.js` | Integrações | ✅ |
| Webhooks | `webhooks.js` | Integrações | ✅ |
| Docs API | `api-docs.js` | Integrações | ✅ |
| Organizações | `organizations.js` | SUPERADMIN | ✅ |
| EBD Lista | `ebd.js` | EBD | ✅ |
| EBD Classe | `ebd-class.js` | EBD | ✅ |
| EBD Relatórios | `ebd-reports.js` | EBD | ✅ |
| Form Público | `public-form.js` | Público | ✅ |
| Finance Dashboard | `finance-dashboard.js` | Financeiro | 🔄 Em andamento |
| Finance Contas | `finance-accounts.js` | Financeiro | 🔄 Em andamento |
| Finance Transações | `finance-transactions.js` | Financeiro | 🔄 Em andamento |
| Finance Doações | `finance-donations.js` | Financeiro | 🔄 Em andamento |
| Finance Contas a Pagar | `finance-bills.js` | Financeiro | 🔄 Em andamento |
| Finance Fundos | `finance-funds.js` | Financeiro | 🔄 Em andamento |
| Finance Relatórios | `finance-reports.js` | Financeiro | 🔄 Em andamento |
| Finance BI | `finance-bi.js` | Financeiro | 🔄 Em andamento |
| Finance Plano de Contas | `finance-chart.js` | Financeiro | 🔄 Em andamento |

**Total:** 29 views (20 completas + 9 em andamento)

---

## 9. Recomendações Prioritárias

### Imediato (bloqueante)

1. **UX-01:** Completar Módulo Financeiro Fase 3 (9 views)
2. **UX-02:** Remover `user-select: none` do body (limitar a elementos específicos)
3. **A11Y-02:** Adicionar `aria-label` nos botões de ícone

### Curto prazo

4. **PERF-01:** Migrar Tailwind CDN → instalação local com purge
5. **PERF-02/03:** Lazy load de SheetJS e Chart.js apenas nas views que precisam
6. **A11Y-05/06:** Implementar focus trap e `role="dialog"` nos modais
7. **UX-07:** Refatorar dark mode para usar `dark:` variants nativas do Tailwind

### Médio prazo

8. **UX-04:** Criar biblioteca de componentes reutilizáveis (substituir template literals repetidos)
9. **UX-09:** Adicionar skeleton screens para loading states
10. **A11Y-11:** Adicionar `prefers-reduced-motion` nas animações
11. **PERF-04/05:** Code splitting por módulo (Celular, EBD, Financeiro)

---

## 10. Resumo de Débitos para o Assessment Final

| ID | Débito | Área | Severidade | Esforço |
|----|--------|------|-----------|---------|
| UX-01 | Módulo Financeiro Fase 3 | Feature | 🔴 Crítico | 16h |
| PERF-01 | Tailwind CDN → local | Performance | 🟠 Alto | 4h |
| A11Y-01 | user-select global | Acessibilidade | 🔴 Crítico | 1h |
| A11Y-02 | aria-label em botões | Acessibilidade | 🟠 Alto | 3h |
| A11Y-05/06 | Focus trap modais | Acessibilidade | 🟠 Alto | 4h |
| UX-04 | Sistema de componentes | Manutenibilidade | 🟠 Alto | 20h+ |
| UX-07 | Dark mode refactor | CSS debt | 🟡 Médio | 6h |
| PERF-02/03 | Lazy load libs externas | Performance | 🟡 Médio | 4h |
| UX-09 | Skeleton screens | UX | 🟡 Médio | 8h |
| UX-12 | Modal system upgrade | UX | 🟡 Médio | 6h |

**Esforço total estimado:** ~72h (sem o módulo financeiro que é feature nova)

---

*Documento gerado por @ux-design-expert em execução do Brownfield Discovery Workflow — Fase 3*
