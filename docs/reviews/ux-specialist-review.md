# UX/UI Specialist Review — Frontend & Design System Assessment

**Projeto:** CRM Celular
**Data:** 2026-03-17
**Revisora:** @ux-design-expert (Uma) — Brownfield Discovery Fase 6
**Documento revisado:** `docs/prd/technical-debt-DRAFT.md` (seção Frontend/UX) + `docs/frontend/frontend-spec.md`

---

## Veredicto Geral

**STATUS: ✅ VALIDADO COM AJUSTES SIGNIFICATIVOS**

O @architect identificou corretamente os débitos críticos. Faço ajustes de severidade em 4 itens, adiciono 3 débitos não identificados, e respondo todas as 5 perguntas abertas com análise de impacto real no day-to-day de desenvolvimento.

**Impressão geral:** O frontend está funcional e visualmente coerente para o estágio atual. A arquitetura "vanilla JS + template literals" é simples, mas está chegando ao limite de escala — com 29 views e ~25 padrões duplicados, o custo marginal de cada nova feature já é perceptível.

---

## 1. Débitos Validados

| ID | Débito | Severidade Draft | Severidade Validada | Horas | Notas |
|----|--------|-----------------|--------------------|----|-------|
| UX-01 | Módulo Financeiro Fase 3 — 9 views pendentes | 🔴 Crítico | 🔴 **Crítico — CONFIRMO** | 24-32h | Veja resposta detalhada abaixo |
| A11Y-01 | `user-select: none` global | 🔴 Crítico | 🔴 **Crítico — CONFIRMO (com nuance)** | 1h | Veja resposta detalhada abaixo |
| PERF-01 | Tailwind CSS via CDN (~3MB) | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 3-5h | Veja resposta detalhada abaixo |
| A11Y-02 | Botões de ícone sem `aria-label` | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 2h | Contagem real: ~35 botões afetados em 15+ views |
| A11Y-03 | Sem skip navigation link | 🟠 Alto | 🟢 **Baixo — AJUSTE ↓** | 0.5h | Relevante para screen readers, mas app é mobile-first; impacto real baixo para o perfil de usuário atual |
| A11Y-04 | Modais sem focus trap | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 3h | `openModal()` em 15+ views. Fix em um ponto central resolve tudo |
| A11Y-05 | Sem `role="dialog"` nos modais | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 0.5h | Fix trivial no `openModal()` — 30 min para resolver todos |
| MNT-01 | Sistema de componentes ausente | 🟠 Alto | 🟠 **Alto — AJUSTE ESFORÇO ↑** | 32-40h | Veja resposta detalhada abaixo |
| MNT-02 | Dark mode via `!important` overrides | 🟡 Médio | 🟡 **Médio — CONFIRMO (timing ajustado)** | 8h | Veja resposta detalhada abaixo |
| MNT-03 | `window.openModal` global | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 4h | Bloqueia modais aninhados; impacto direto no módulo financeiro (confirmações dentro de formulários) |
| MNT-04 | Sem skeleton screens | 🟡 Médio | 🟢 **Baixo — AJUSTE ↓** | 2h | Spinners genéricos resolvem 80% dos casos; skeleton só justifica em listagens longas. Prioridade baixa |
| MNT-05 | Tamanhos de texto arbitrários | 🟢 Baixo | 🟢 **Baixo — CONFIRMO** | 1h | Adotar `text-[10px]` → `text-xs`, `text-[13px]` → `text-sm`. Busca + substituição simples |
| PERF-02 | SheetJS carregado globalmente | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 1h | 1.2MB que carrega em todas as páginas. Lazy import em reports.js/ebd-reports.js/finance-reports.js |
| PERF-03 | Chart.js carregado globalmente | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 0.5h | 190KB. Lazy import nas 2-3 views que usam |
| PERF-04 | Sem code splitting | 🟡 Médio | 🟢 **Baixo — AJUSTE ↓** | 4h | Com Vite, `import()` dinâmico resolve. MAS: dependência de PERF-01 primeiro — purge do Tailwind tem 10x mais impacto |

---

## 2. Débitos Adicionados

| ID | Débito | Severidade | Horas | Justificativa |
|----|--------|-----------|-------|--------------|
| **FE-NEW-01** | **`A11Y-07` — Contraste não verificado para `primaryColor` dinâmico** — org pode configurar cor com contraste insuficiente sobre fundo branco | 🟠 Alto | 2h | WCAG 1.4.3: contraste mínimo 4.5:1 para texto. Cor configurável sem validação é risco real. Solução: função `getContrastRatio()` ao salvar `primaryColor` + aviso no admin |
| **FE-NEW-02** | **Sem estados de erro padronizados** — cada view trata erro de forma diferente (algumas `console.error`, outras `toast`, outras nenhuma mensagem) | 🟡 Médio | 3h | Identificado em ~10 views. UX inconsistente: falha silenciosa em algumas ações críticas (ex: deleção). Solução: padrão único de `errorHandler(err, context)` em `ui.js` |
| **FE-NEW-03** | **`A11Y-10` — Alvos de toque abaixo de 44×44px** em sidebar links (`w-8 h-8` = 32px) e botões de ação no header | 🟡 Médio | 2h | WCAG 2.5.5. Especialmente impactante em mobile. Fix: aumentar `padding` em `ui.js` e sidebar sem alterar layout visual |

---

## 3. Respostas às Perguntas do @architect

### Pergunta 1: MNT-01 — Quão crítico é o sistema de componentes? Qual o impacto atual no time?

**Resposta: Alto — mas o momento certo para executar é DEPOIS do módulo financeiro estar completo.**

**Impacto atual no day-to-day:**

Medido em ocorrências na `frontend-spec.md`:

| Padrão duplicado | Ocorrências | Custo por alteração |
|-----------------|-------------|-------------------|
| Loading state | 29 views | Alterar estilo = 29 edits |
| Header sticky | ~25 views | Alterar padding = 25 edits |
| Empty state | ~20 views | Alterar copy/ícone = 20 edits |
| Table list | ~20 views | Bug de layout = 20 investigações |
| Confirm modal | ~15 views | Alterar texto "Confirmar?" = 15 edits |
| KPI card | ~8 views | Alterar cor = 8 edits |

**Cenário concreto:** Se amanhã o designer quiser mudar o `border-radius` dos cards de `rounded-2xl` para `rounded-xl`, são ~25 arquivos para editar manualmente — com risco de esquecer 2-3.

**Por que esperar o módulo financeiro:**
As 9 views financeiras em andamento estão adicionando mais instâncias dos mesmos padrões. Criar o sistema de componentes agora e refatorar as views financeiras *ao mesmo tempo* seria desperdício. **Recomendo:** (1) Concluir as 9 views financeiras → (2) Com 29 views estabilizadas, extrair componentes em uma iniciativa única de ~32-40h.

**Reestimativa de esforço (vs. 24h do DRAFT):**
O DRAFT subestimou. Contando extração + refatoração de 29 views + testes visuais: **32-40h reais**. Pode ser dividido em 3 sprints de ~12h cada (sem alterar funcionalidade, apenas extrair).

---

### Pergunta 2: PERF-01 — Há dependência técnica que impeça migrar Tailwind CDN → instalação local?

**Resposta: NÃO há bloqueio técnico. O projeto JÁ usa Vite, a migração é direta.**

**Por que é simples neste projeto:**
- Vite 7 tem suporte nativo ao Tailwind v4 via plugin (`@tailwindcss/vite`)
- O projeto usa Tailwind v4 (confirmado pela `frontend-spec.md`) — a configuração `v4` elimina o `tailwind.config.js` separado
- O CDN atual (`cdn.tailwindcss.com`) já entrega Tailwind v4 — a migração não muda a versão, apenas o modo de entrega

**Passos concretos (estimativa 3-5h total):**
```bash
# 1. Instalar (10min)
npm install tailwindcss @tailwindcss/vite

# 2. vite.config.js (30min)
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [tailwindcss()] }

# 3. index.css (10min)
@import "tailwindcss";
# + mover o token --color-primary do index.html para aqui

# 4. Remover CDN do index.html (5min)

# 5. Testar todas as views + dark mode (2-3h)
```

**Resultado esperado:** ~3MB → ~30-60KB (CSS purgeado de 29 views). Ganho de ~95% no tamanho do CSS.

**Risco único:** As `@apply` directives ou classes dinâmicas geradas via JS (ex: `bg-${color}-500`) podem não ser detectadas pelo purge. Verificar se há classes construídas dinamicamente no código.

**Recomendação:** Executar esta migração em sprint dedicado, antes de criar novas views. **Este é o quick win de maior impacto de performance do sistema.**

---

### Pergunta 3: A11Y-01 — `user-select: none` faz sentido em alguma parte mobile? Pode ser removido completamente?

**Resposta: PODE e DEVE ser removido do `body`. Há exceções legítimas, mas são pontuais.**

**Onde `user-select: none` FAZ sentido (manter pontualmente):**
- Elementos de UI puramente interativos que o usuário não precisa copiar: números de badge, rótulos de status pill (`"Ativo"`, `"Membro"`), botões de ação
- Componentes onde duplo-toque seleciona texto acidentalmente: bottom nav links, sidebar items
- Evitar seleção acidental ao arrastar um slider ou componente de swipe (se existir)

**Onde NÃO faz sentido (e causa dano real):**
- Nomes de membros na lista de pessoas → usuário não pode copiar o nome
- Telefones e e-mails no perfil de membro → não pode copiar para ligar/enviar email
- Endereços → não pode copiar para Maps
- Notas pastorais e textos de oração → não pode copiar
- Qualquer texto de relatório ou export preview

**Fix recomendado (1h):**

```css
/* Remover do body — em index.html ou index.css */
/* ANTES: body { user-select: none; } */

/* DEPOIS: aplicar seletivamente onde faz sentido */
.nav-item, .badge, .pill, .action-btn, .sidebar-link {
  user-select: none;
}
```

Ou com Tailwind: substituir `user-select: none` no body por `select-none` nos componentes específicos (sidebar, bottom nav, botões de ação).

**Conclusão:** **Remover completamente do `body` é a ação correta.** Manter em elementos específicos de navegação como boa prática.

---

### Pergunta 4: UX-01 — As 9 views do módulo financeiro têm designs prontos? Precisam de spec primeiro?

**Resposta: Não precisam de spec separada — o padrão visual já está estabelecido. Mas recomendo um wireframe de referência para o Finance Dashboard.**

**Estado atual identificado (pelo git status):**
Os arquivos já existem como work-in-progress: `finance-dashboard.js`, `finance-reports.js`, `finance-bi.js` estão modificados (M no git status). O padrão de implementação já está em andamento.

**Por que não precisam de spec completa:**
1. O padrão visual do sistema está bem definido nas 20 views existentes
2. As cores do módulo financeiro já estão documentadas (`emerald`/receitas, `red`/despesas, `amber`/alertas, `blue`/info)
3. O padrão de abas já existe em `settings.js` e `ebd-class.js` — pode ser reutilizado para Finance Dashboard
4. Os padrões de KPI card, tabela com filtros e export já existem em `ebd-reports.js`

**Exceção — Finance Dashboard:** Como porta de entrada do módulo, merece atenção especial. Recomendo um wireframe simples (não spec completa) com:
- Layout de KPIs no topo (saldo total, receitas, despesas, pendentes)
- Gráfico de fluxo de caixa (mensal)
- Shortcuts para ações rápidas (lançar transação, registrar doação, pagar conta)
- Alertas de contas vencidas

**Estimativa revisada (vs. 24h do DRAFT):**

| View | Complexidade | Horas estimadas |
|------|-------------|----------------|
| finance-dashboard.js | Alta (múltiplos widgets) | 6h |
| finance-accounts.js | Média | 3h |
| finance-transactions.js | Alta (filtros + paginação) | 5h |
| finance-donations.js | Média | 4h |
| finance-bills.js | Média | 4h |
| finance-funds.js | Baixa | 2h |
| finance-reports.js | Alta (6 relatórios + export) | 6h |
| finance-bi.js | Alta (Chart.js + BI) | 5h |
| finance-chart.js (Plano de Contas) | Média (hierárquico) | 3h |
| **TOTAL** | | **~38h** |

**Observação:** O DRAFT estimou 24h mas listou só 7 views. Com as 9 views reais (finance-bi.js e finance-chart.js adicionais), 38h é mais realista.

---

### Pergunta 5: MNT-02 — Dark mode via `!important` overrides: o custo de refatorar justifica agora?

**Resposta: NÃO justifica isoladamente agora. Mas justifica JUNTO com a migração PERF-01 (Tailwind local).**

**O problema atual:**
```css
/* Trecho típico do override atual */
.dark .sidebar { background-color: #1e293b !important; }
.dark .card { background-color: #0f172a !important; border-color: #1e293b !important; }
/* ~40 linhas de overrides desta natureza */
```

**Por que não fazer agora isoladamente:**
- Refatorar `!important` overrides → `dark:` variants requer tocar as 20+ views completas e o `index.html`
- Sem a migração do Tailwind para local, os `dark:` variants do CDN funcionam, mas há limitações de JIT
- Risco de regressão visual alto se feito apressadamente
- Custo real: **8h** (vs. 6h do DRAFT — mais views do que estimado)

**Por que fazer JUNTO com PERF-01:**
Quando a migração Tailwind CDN → local for executada, o CSS será reprocessado de qualquer forma. Esse é o momento natural para:
1. Mover `--color-primary` do `index.html` para `index.css`
2. Substituir os `!important` overrides por `dark:` variants do Tailwind
3. Consolidar em ~2h adicional ao sprint de migração

**Recomendação:** Marcar MNT-02 como **dependência de PERF-01**. Resolver os dois juntos em 1 sprint (~10-12h total), não separadamente.

---

## 4. Ordem de Resolução Recomendada (perspectiva UX)

### Sprint 0 — Desbloqueantes Imediatos (2h total)

1. **A11Y-01** — Remover `user-select: none` do body (1h) — impacto direto em usabilidade básica
2. **A11Y-05** — `role="dialog"` nos modais (0.5h) — fix em `ui.js`, resolve tudo de uma vez
3. **MNT-05** — Padronizar `text-[10px]`→`text-xs` etc (0.5h) — limpeza rápida

### Sprint 1 — Módulo Financeiro + Acessibilidade Crítica (48h)

4. **UX-01** — Completar 9 views do módulo financeiro (~38h) — bloqueante de produto
5. **A11Y-02** — `aria-label` em botões de ícone (2h) — alta densidade de impacto
6. **A11Y-04** — Focus trap em modais (3h) — resolver em `openModal()` centralmente
7. **FE-NEW-03** — Alvos de toque ≥ 44px (2h) — impacto direto no mobile

### Sprint 2 — Performance + Dark Mode (12h)

8. **PERF-01** — Migrar Tailwind CDN → local (3-5h) — maior ganho de performance
9. **MNT-02** — Dark mode `dark:` variants (dependente de PERF-01, ~8h junto)
10. **PERF-02/03** — Lazy load SheetJS e Chart.js (1.5h) — quick wins de bundle

### Sprint 3 — Sistema de Componentes (36-40h — iniciativa dedicada)

11. **MNT-01** — Extrair componentes atômicos após módulo financeiro estabilizado
12. **FE-NEW-01** — Validação de contraste para `primaryColor` (2h) — dentro do sprint de componentes
13. **FE-NEW-02** — Padronizar estados de erro (3h) — `errorHandler()` centralizado em `ui.js`
14. **MNT-03** — `window.openModal` → stack de modais (4h) — necessário para módulo financeiro avançado

### Sprint 4 — Qualidade & Polimento (backlog)

15. **PERF-04** — Code splitting por módulo (4h, após PERF-01)
16. **A11Y-03** — Skip navigation (0.5h)
17. **MNT-04** — Skeleton screens para listagens longas (2h — seletivo, não global)
18. **A11Y-11** — `prefers-reduced-motion` (2h)
19. **FE-NEW-03** — Alvos de toque (2h)

---

## 5. Riscos Específicos de UX/Frontend

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|----------|
| Cor primária configurada com baixo contraste por admin de igreja | 🟡 Média | Texto ilegível para alguns usuários | FE-NEW-01: validação ao salvar `primaryColor` |
| Classes dinâmicas JS "purgeadas" após PERF-01 | 🟡 Média | Estilos quebrados em prod | Listar classes dinâmicas antes da migração; usar `safelist` no config |
| Módulo financeiro com modais aninhados (confirm dentro de form) | 🟠 Alta | UX quebrada com `window.openModal` | MNT-03 antes de features avançadas do financeiro |
| Crescimento de views sem componentes → inconsistência visual acumulada | 🔴 Alta (longo prazo) | Manutenção cara | MNT-01 após estabilização do financeiro |
| Dark mode com bugs após migração de `!important` → `dark:` | 🟡 Média | Regressões visuais | Screenshots antes/depois + teste manual das 29 views |

---

## 6. Nota sobre o Módulo Financeiro em Andamento

Pelo `git status`, os arquivos `finance-dashboard.js`, `finance-reports.js` e `finance-bi.js` já têm modificações não commitadas. Isso indica que o desenvolvimento já está em progresso — **não está em estado "a iniciar"**.

**Recomendação:** Antes de criar qualquer nova view financeira, verificar:
- O `src/store.js` foi atualizado com `financeAccounts[]`, `financeFunds[]`?
- O `src/app.js` tem as rotas e o `financeGuard`?
- O módulo está integrado ao sidebar/bottomNav?

Se essas integrações já foram feitas, o esforço residual para as 9 views pode ser menor que 38h. Se não, elas são pré-requisito e devem ser feitas primeiro.

---

*Revisão concluída por @ux-design-expert — Brownfield Discovery Fase 6*
*Próximo: @qa faz review geral de qualidade e riscos cruzados (Fase 7)*
