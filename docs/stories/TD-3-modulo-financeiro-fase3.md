# Story TD-3 — Módulo Financeiro Fase 3 (9 Views)

**Epic:** EPIC-TD
**Sprint:** Sprint 2
**Esforço:** 38 horas
**Prioridade:** P0 — Feature bloqueante
**Assignee:** @dev
**Status:** Ready (3 arquivos já em andamento)

---

## User Story

**Como** AGENTE_FINANCEIRO ou ADMIN de uma organização,
**Quero** acessar todas as telas do módulo financeiro,
**Para** registrar transações, controlar doações, gerenciar contas a pagar e visualizar relatórios financeiros da minha organização.

---

## Contexto

O backend do módulo financeiro está 100% completo (Fase 1 + Fase 2). As 9 views frontend precisam ser criadas/completadas. 3 arquivos já têm trabalho em andamento: `finance-dashboard.js`, `finance-reports.js`, `finance-bi.js`.

**Pré-requisitos desta story (devem estar prontos antes de iniciar):**
- TD-1 concluída (SEC-01 corrigido — financeGuard fail-closed)
- `src/store.js` com `financeAccounts[]`, `financeFunds[]`, `financeChartOfAccounts[]`
- `src/app.js` com `financeGuard`, rotas `/finance/*` e redirect para AGENTE_FINANCEIRO
- `src/components/ui.js` com sidebar items do módulo financeiro

**Débitos cobertos:** UX-01, MNT-03 (parcial — modal stack para fluxos de confirmação)

---

## Acceptance Criteria

### AC-1: finance-dashboard.js (`/finance`)
- [ ] KPIs no topo: Saldo Total, Receitas do mês, Despesas do mês, Contas pendentes
- [ ] Gráfico de fluxo de caixa mensal (Chart.js — lazy loaded)
- [ ] Lista das 5 últimas transações
- [ ] Alertas de contas vencidas
- [ ] Shortcuts para ações rápidas (nova transação, registrar doação, pagar conta)
- [ ] Cores: emerald (receitas), red (despesas), amber (alertas), blue (info)

### AC-2: finance-accounts.js (`/finance/accounts`)
- [ ] Lista de contas bancárias/caixas com saldo calculado
- [ ] Criar/editar/desativar conta
- [ ] Modal de extrato com running balance

### AC-3: finance-transactions.js (`/finance/transactions`)
- [ ] Listagem com filtros: conta, tipo (RECEITA/DESPESA), período, fundo, categoria
- [ ] Paginação
- [ ] Export Excel (SheetJS — lazy loaded)
- [ ] Soft-delete (apenas transações MANUAL — BILL e DONATION são imutáveis)

### AC-4: finance-donations.js (`/finance/donations`)
- [ ] Listagem de dízimos e ofertas com filtros (tipo, período, membro, lote)
- [ ] Registrar doação individual (cria FinancialTransaction via backend)
- [ ] Criar/gerenciar lotes (DonationBatch)
- [ ] Export Excel

### AC-5: finance-bills.js (`/finance/bills`)
- [ ] Lista de contas a pagar com status calculado (PENDENTE / VENCIDO / PAGO / CANCELADO)
- [ ] Criar/editar conta a pagar
- [ ] Registrar pagamento (cria Transaction + BillPayment)
- [ ] Filtro por status e período de vencimento

### AC-6: finance-funds.js (`/finance/funds`)
- [ ] Lista de fundos customizáveis com saldo por fundo
- [ ] Criar/editar/desativar fundo
- [ ] Formulário simples (nome, descrição, ativo)

### AC-7: finance-reports.js (`/finance/reports`)
- [ ] 6 relatórios disponíveis via abas ou dropdown:
  1. Dashboard KPIs (resumo do período)
  2. Fluxo de caixa
  3. DRE (Demonstrativo de Resultado)
  4. Dízimos por membro
  5. Por fundo
  6. Resumo do período
- [ ] Filtros de período em todos os relatórios
- [ ] Export Excel e PDF (Puppeteer)
- [ ] Padrão visual: reutilizar estrutura de `ebd-reports.js`

### AC-8: finance-bi.js (`/finance/bi`)
- [ ] Gráficos analíticos (Chart.js — lazy loaded):
  - Evolução mensal de receitas vs despesas
  - Distribuição por categoria (pizza)
  - Crescimento de dízimos por período
- [ ] Filtros de período

### AC-9: finance-chart.js (`/finance/chart`) — Plano de Contas
- [ ] Exibição hierárquica (árvore pai/filho) do ChartOfAccount
- [ ] Toggle ativo/inativo por categoria
- [ ] Apenas ADMIN pode gerenciar

### AC-10: Integração geral
- [ ] Todas as 9 views acessíveis pelo sidebar/bottom-nav com `financeModule: true`
- [ ] `financeGuard` aplicado em todas as rotas `/finance/*` no `src/app.js`
- [ ] AGENTE_FINANCEIRO sem role pastoral é redirecionado para `/finance` no login
- [ ] Todas as views testadas manualmente com dados reais de dev

---

## Notas de Implementação

**Padrão de guard em app.js:**
```javascript
function financeGuard(fn) {
  return async (p) => {
    if (!store.isLoggedIn()) { navigate('/login'); return; }
    if (!store.systemSettings?.financialEnabled) { navigate('/dashboard'); return; }
    const ok = store.hasRole('ADMIN','SUPERVISOR') ||
               store.hasSecondaryRole('AGENTE_FINANCEIRO');
    if (!ok) { navigate('/dashboard'); return; }
    restoreTheme(); await fn(p);
  };
}
```

**Referências de padrão visual:**
- Abas: `src/views/settings.js` e `src/views/ebd-class.js`
- Listagem com filtros: `src/views/ebd-reports.js`
- KPI cards: `src/views/dashboard.js`
- Export Excel: `src/views/reports.js`

**Cores do módulo:**
- Receitas/positivo: `emerald-600`, `bg-emerald-50`
- Despesas/negativo: `red-600`, `bg-red-50`
- Alertas: `amber-600`, `bg-amber-50`
- Informativo: `blue-600`, `bg-blue-50`

---

## Arquivos a Criar/Modificar

**Criar:**
- `src/views/finance-accounts.js`
- `src/views/finance-transactions.js`
- `src/views/finance-donations.js`
- `src/views/finance-bills.js`
- `src/views/finance-funds.js`
- `src/views/finance-chart.js`

**Completar (em andamento):**
- `src/views/finance-dashboard.js`
- `src/views/finance-reports.js`
- `src/views/finance-bi.js`

**Atualizar:**
- `src/store.js` — blocos financeiros em `loadInitialData()`
- `src/app.js` — `financeGuard` + 9 rotas
- `src/components/ui.js` — sidebar items financeiros

---

## Definition of Done

- [ ] Todas as 9 views funcionais e acessíveis
- [ ] Testadas manualmente com dados de dev (SQLite)
- [ ] `financeGuard` bloqueia acesso sem permissão
- [ ] Export funcional em pelo menos finance-reports.js
- [ ] Commit com mensagem: `feat: complete financial module phase 3 (9 views) [TD-3]`
