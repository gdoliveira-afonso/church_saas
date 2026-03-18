# Story TD-7 — Sistema de Componentes Frontend

**Epic:** EPIC-TD
**Sprint:** Sprint 4
**Esforço:** 40 horas
**Prioridade:** P2
**Assignee:** @dev + @ux-design-expert
**Status:** Blocked (aguarda TD-3 — módulo financeiro estabilizar)

---

## User Story

**Como** desenvolvedor do CRM,
**Quero** ter componentes reutilizáveis para os padrões mais comuns da interface,
**Para** que novas telas sejam desenvolvidas 30-40% mais rápido e com aparência consistente.

---

## Contexto

Com 29 views e ~25 padrões duplicados (loading state 29×, header 25×, empty state 20×, etc.), qualquer alteração visual requer editar dezenas de arquivos. Esta story extrai os padrões mais repetidos em funções centralizadas em `ui.js`, sem alterar o comportamento das views existentes.

**Bloqueante:** Executar APÓS TD-3 concluída — as 9 views financeiras adicionam mais instâncias dos mesmos padrões. Refatorar antes seria desperdício.

**Débitos cobertos:** MNT-01, MNT-03, FE-NEW-02, MNT-05

---

## Acceptance Criteria

### AC-1: Componente loadingState (MNT-01 — 29 ocorrências)
- [ ] `src/components/ui.js` — exportar função `loadingState(message = 'Carregando...')` que retorna HTML do estado de loading
- [ ] Substituir todas as ocorrências inline de loading state nas 29 views pela chamada à função
- [ ] Visual idêntico ao atual (sem alteração de aparência)

### AC-2: Componente emptyState (MNT-01 — ~20 ocorrências)
- [ ] `src/components/ui.js` — exportar função `emptyState({ icon, title, description, actionLabel, actionOnClick })`
- [ ] Substituir implementações inline nas views
- [ ] Suporte a: sem ícone (só texto), com botão de ação, sem botão

### AC-3: Componente pageHeader (MNT-01 — ~25 ocorrências)
- [ ] `src/components/ui.js` — exportar função `pageHeader({ title, subtitle, actions })` que retorna o HTML do header sticky padrão
- [ ] `actions` é array de `{ label, icon, onClick, primary }` para os botões do header
- [ ] Substituir headers inline nas views

### AC-4: Componente confirmModal (MNT-01 — ~15 ocorrências)
- [ ] `src/components/ui.js` — exportar função `confirmModal({ title, message, confirmLabel, onConfirm, danger })`
- [ ] Substitui o padrão `openModal('<div>...<button onclick="...">Confirmar</button>')` repetido nas views
- [ ] `danger: true` aplica cor vermelha ao botão de confirmação

### AC-5: Stack de modais para fluxos aninhados (MNT-03)
- [ ] `src/components/ui.js` — `openModal()` refatorado para suportar stack (múltiplos modais abertos simultaneamente)
- [ ] `closeModal()` fecha o modal mais recente (LIFO)
- [ ] `closeAllModals()` fecha todos
- [ ] Manter retrocompatibilidade: chamadas existentes `openModal(html)` continuam funcionando

### AC-6: Handler de erros padronizado (FE-NEW-02)
- [ ] `src/components/ui.js` — exportar função `handleError(err, context)` que:
  - Exibe `toast(err.message || 'Erro inesperado', 'error')`
  - Faz `console.error(`[${context}]`, err)`
  - Para erros 401: redireciona para `/login`
  - Para erros 403: exibe `toast('Sem permissão para esta ação', 'error')`
- [ ] Substituir tratamentos de erro inconsistentes nas ~10 views afetadas

### AC-7: Padronizar tamanhos de texto (MNT-05)
- [ ] Substituir `text-[10px]` → `text-xs`, `text-[11px]` → `text-xs`, `text-[13px]` → `text-sm` em todas as views
- [ ] Verificar que alteração não quebra layouts que dependem de tamanhos específicos

---

## Estratégia de Execução

**Fase 1 (8h):** Criar os 6 componentes/helpers em `ui.js` sem tocar nas views
**Fase 2 (16h):** Substituir nas 20 views completas (5 views por sessão de trabalho)
**Fase 3 (12h):** Substituir nas 9 views financeiras
**Fase 4 (4h):** Testes visuais e regressão manual em todas as 29 views

---

## Arquivos a Modificar

- `src/components/ui.js` — adicionar 6 novos exports
- Todas as 29 views em `src/views/` — substituir padrões inline

---

## Definition of Done

- [ ] 6 componentes/helpers implementados e exportados
- [ ] Todas as 29 views usando os componentes centralizados
- [ ] Nenhuma alteração visual perceptível (regressão visual = 0)
- [ ] Stack de modais testado com fluxo aninhado no módulo financeiro
- [ ] `handleError()` usado em todas as views que fazem fetch
- [ ] Commit: `refactor: extract reusable UI components, add modal stack, standardize error handling [TD-7]`
