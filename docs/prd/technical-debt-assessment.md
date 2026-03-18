# Technical Debt Assessment — Documento Final
## CRM Celular — SaaS Multi-tenant para Igrejas

**Projeto:** CRM Celular
**Data:** 2026-03-17
**Versão:** 1.0 — Final
**Consolidado por:** @architect (Brownfield Discovery — Fase 8)
**Status:** ✅ APROVADO pelo QA Gate (Fase 7)

**Contribuidores:**
- @architect (Aria) — Fases 1, 4, 8
- @data-engineer (Dara) — Fases 2, 5
- @ux-design-expert (Uma) — Fases 3, 6
- @qa (Quinn) — Fase 7

---

## Sumário Executivo

| Área | Débitos | Críticos | Altos | Médios | Baixos |
|------|---------|---------|-------|--------|--------|
| Sistema / Backend | 10 | 0 | 4 | 4 | 2 |
| Segurança | 9 | 2 | 4 | 3 | 0 |
| Database — Índices | 8 | 1 | 3 | 3 | 1 |
| Database — Design | 8 | 0 | 1 | 5 | 2 |
| Frontend / UX / Performance | 19 | 2 | 6 | 8 | 3 |
| **TOTAL** | **54** | **5** | **18** | **23** | **8** |

**Esforço total estimado:** ~170-195 horas

**Observação crítica do @qa:** SYS-01 (zero testes) é um **débito multiplicador** — eleva o risco de todos os outros. Deve ser tratado como P1 sistêmico, não como débito isolado.

---

## Gates Obrigatórios Antes de Produção

> Estes itens BLOQUEIAM qualquer deploy em produção até serem resolvidos.

| Gate | Débito | Por quê bloqueia |
|------|--------|-----------------|
| 🔴 **Gate 1** | SEC-01 — financeGuard fail-open | Qualquer instabilidade de banco libera acesso financeiro indevido. Risco imediato com módulo financeiro em desenvolvimento ativo |
| 🟠 **Gate 2** | IDX-01 — Person sem índices | Full table scan em toda listagem de membros. Com 1.000+ membros, degradação severa de performance |
| 🟠 **Gate 3** | OPS-01 — Processo de rollback | Sem rollback scripts, uma migration falhada em produção não tem recovery controlado |

---

## 1. Débitos de Sistema (Backend + Infraestrutura)

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| SYS-01 | **Zero testes automatizados** — `"test": "echo Error"` no package.json | 🔴 Alto | 20h+ | ⚠️ Multiplicador de risco sistêmico. Sem cobertura mínima, qualquer correção de débito pode introduzir regressão |
| SYS-02 | **Jobs com `setInterval`** — sem cron real, sem persistência de estado | 🟡 Médio | 4h | Timer reseta ao reiniciar o server. Birthday checks e lembretes de eventos falham silenciosamente |
| SYS-03 | **Scripts de debug na raiz** — `check-*.js`, `debug-db.js` | 🟡 Médio | 1h | Poluição do repositório; risco de exposição acidental |
| SYS-04 | **Express 5 (beta) em produção** — `^5.2.1` | 🟡 Médio | 2h | Fixar versão (`"express": "5.2.1"` sem `^`) para evitar breaking changes silenciosos |
| SYS-05 | **Datas como String** em 15+ campos do schema | 🟡 Médio | — | Coberto por DES-01. Manter String por ora (recomendação @data-engineer) |
| SYS-06 | **JSON serializado como String** — 6 campos | 🟡 Médio | — | Coberto por DES-02 |
| SYS-07 | **Ausência de TypeScript** | 🟡 Médio | 40h+ | P4 — iniciativa estratégica de longo prazo |
| SYS-08 | **Troca de provider SQLite↔PG manual** | 🟢 Baixo | 2h | Script de switch pode automatizar |
| SYS-09 | **`tmp_test_db.js` na raiz** | 🟢 Baixo | 0.5h | Limpeza simples |
| SYS-10 | **`migrate.log` commitado** | 🟢 Baixo | 0.5h | Adicionar ao `.gitignore` |

---

## 2. Débitos de Segurança

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| SEC-01 | **`financeGuard` fail-open** — chama `next()` se DB falhar | 🔴 Crítico | 0.5h | **GATE 1.** Fix: `return res.status(500).json(...)` no catch. Auditar também relação com `hasFinanceAccess()` |
| SEC-02 | **Multi-tenancy apenas na aplicação** — sem RLS no PostgreSQL | 🟠 Alto | 20-40h | Não recomendado como P1 (Prisma connection pool dificulta RLS). Mitigar com testes de isolamento cross-tenant ao resolver SYS-01 |
| SEC-03 | **Sem CHECK constraints** em `User.role`, `Organization.plan`, `Bill.status` etc. | 🟠 Alto | 3h | Valores inválidos inseríveis por acesso direto ao banco |
| SEC-04 | **`Cell.leaderId/viceLeaderId` sem FK formal** | 🟠 Alto | 4h | Verificar dados órfãos antes de adicionar FK em produção |
| SEC-05 | **`secondaryRoles` como JSON String** — sem validação no DB | 🟡 Médio | 2h | Roles inválidos silenciosamente ignorados |
| SEC-06 | **Sem índice em `ActivityLog.action`** — dificulta análise de brute-force | 🟡 Médio | 1h | Adicionar índice simples |
| SEC-07 | **Soft-delete inconsistente** — apenas 4 modelos com `deletedAt` | 🟡 Médio | 6h | Decisão estratégica necessária antes de implementar |
| SEC-08 | **Sem 2FA/MFA** | 🟡 Médio | 16h | P3 — feature, não débito urgente |
| SEC-09 | **JWT sem refresh token** — expira em 24h | 🟢 Baixo | 8h | UX: logout involuntário após 24h |

---

## 3. Débitos de Database

### 3.1 Índices

| ID | Tabela | Campo(s) | Severidade | Esforço | SQL Recomendado |
|----|--------|----------|-----------|---------|----------------|
| IDX-01 | `Person` | `organizationId`, `cellId` | 🔴 Crítico | 1h | `CREATE INDEX CONCURRENTLY idx_person_org ON "Person"("organizationId"); CREATE INDEX CONCURRENTLY idx_person_cell ON "Person"("cellId");` |
| IDX-02 | `AttendanceRecord` | `personId` | 🟠 Alto | 0.5h | `CREATE INDEX CONCURRENTLY idx_att_record_person ON "AttendanceRecord"("personId");` |
| IDX-03 | `Notification` | `organizationId`, `userId`, `read` | 🟠 Alto | 0.5h | Índice composto — carregado a cada login |
| IDX-04 | `EbdStudent` | `ebdClassId` | 🟠 Alto | 0.5h | `CREATE INDEX CONCURRENTLY idx_ebd_student_class ON "EbdStudent"("ebdClassId");` |
| IDX-05 | `Attendance` | `date`, `organizationId` | 🟡 Médio | 0.5h | Índice composto para relatórios por período |
| IDX-06 | `Event` | `organizationId`, `date` | 🟡 Médio | 0.5h | Job diário de lembretes faz scan |
| IDX-07 | `PersonMilestone` | `personId` | 🟡 Médio | 0.5h | Perfil do membro carrega devagar |
| IDX-08 | `EbdClass` | `organizationId` | 🟢 Baixo | 0.5h | `@@unique([name, org])` cobre parcialmente — impacto menor |

> **Nota @data-engineer:** IDX-01 deve ser criado com `CONCURRENTLY` para não bloquear a tabela em produção.

### 3.2 Design e Integridade

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| DB-NEW-01 | **`AttendanceRecord` sem `organizationId`** — único modelo sem campo de isolamento | 🟠 Alto | 3h | Impossibilita queries de frequência por org sem JOIN obrigatório. Vetor de leak cross-tenant (risco cruzado com SEC-02) |
| DES-01 | **Datas como String** em 15+ campos | 🟡 Médio | — | @data-engineer recomenda **manter** — ISO 8601 funciona para range queries no PG. Usar `DateTime` apenas em campos novos |
| DES-02 | **6 campos JSON como String** | 🟡 Médio | 6h | Migrar para tipo `Json` do Prisma, começar por `secondaryRoles` |
| DES-04 | **`Person.status` como String livre** | 🟡 Médio | 1h | CHECK constraint é adição não-breaking |
| DES-05 | **`EbdOffering.valor` como Float** | 🟢 Baixo | 1h | Risco real baixo para valores de igrejas; inconsistente com demais campos em centavos. Migrar para Int quando conveniente |
| DES-06 | **`Consolidation` sem `updatedAt`** | 🟢 Baixo | 0.5h | Único model sem timestamps completos |

### 3.3 Operações

| ID | Débito | Severidade | Esforço | Abordagem |
|----|--------|-----------|---------|-----------|
| OPS-01 | **Zero rollback scripts** para as 13 migrations | 🟠 Alto | 4h | **GATE 3.** Etapa 1: `pg_dump --schema-only > backup/schema-$(date).sql` (30min). Etapa 2: scripts retroativos para últimas 3 migrations. Etapa 3: processo obrigatório em PRs futuros |
| DB-NEW-02 | **`ActivityLog` sem política de retenção** — cresce ilimitadamente | 🟡 Médio | 4h | Com múltiplos tenants em produção, será a maior tabela em 6-12 meses. Implementar TTL ou particionamento antes do 6º mês |

---

## 4. Débitos de Frontend / UX / Performance

### 4.1 Features Pendentes

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| UX-01 | **Módulo Financeiro Fase 3 — 9 views pendentes** | 🔴 Crítico | 38h | finance-dashboard, accounts, transactions, donations, bills, funds, reports, bi, chart. 3 arquivos já em andamento no git |

### 4.2 Acessibilidade

| ID | Débito | Severidade | Esforço | WCAG | Fix |
|----|--------|-----------|---------|------|-----|
| A11Y-01 | **`user-select: none` global no `body`** — impede copiar nomes, telefones, endereços | 🔴 Crítico | 1h | 1.3.1 | Remover do body; aplicar `select-none` seletivamente em nav/badges |
| A11Y-02 | **Botões de ícone sem `aria-label`** — ~35 botões em 15+ views | 🟠 Alto | 2h | 4.1.2 | Adicionar `aria-label` em cada botão |
| A11Y-04 | **Modais sem focus trap** | 🟠 Alto | 3h | 2.1.2 | Fix centralizado em `openModal()` — resolve todos de uma vez |
| A11Y-05 | **Sem `role="dialog"` nos modais** | 🟠 Alto | 0.5h | 4.1.2 | Fix trivial no `openModal()` |
| FE-NEW-01 | **`primaryColor` configurável sem validação de contraste** — org pode configurar cor ilegível | 🟠 Alto | 2h | 1.4.3 | Função `getContrastRatio()` ao salvar nas settings |
| FE-NEW-03 | **Alvos de toque <44×44px** em sidebar e header mobile | 🟡 Médio | 2h | 2.5.5 | Aumentar padding em `ui.js` sem alterar layout |
| A11Y-03 | **Sem skip navigation link** | 🟢 Baixo | 0.5h | 2.4.1 | App é mobile-first; impacto real baixo |

### 4.3 Performance

| ID | Débito | Severidade | Esforço | Impacto |
|----|--------|-----------|---------|---------|
| PERF-01 | **Tailwind CSS via CDN (~3MB não purgeado)** | 🟠 Alto | 3-5h | Migrar para `@tailwindcss/vite` — ganho esperado ~95% (3MB → 50KB) |
| PERF-02 | **SheetJS (1.2MB) carregado globalmente** | 🟡 Médio | 1h | Lazy import em reports.js, ebd-reports.js, finance-reports.js |
| PERF-03 | **Chart.js (190KB) carregado globalmente** | 🟡 Médio | 0.5h | Lazy import nas 2-3 views que usam |
| PERF-04 | **Sem code splitting** | 🟢 Baixo | 4h | Depende de PERF-01 primeiro; Vite `import()` dinâmico |

### 4.4 Manutenibilidade

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| MNT-01 | **Sistema de componentes ausente** — 29 views com padrões duplicados | 🟠 Alto | 32-40h | Loading state (29×), header (25×), empty state (20×), table (20×). Executar APÓS módulo financeiro estabilizar |
| MNT-02 | **Dark mode via `!important` overrides** — ~40 linhas | 🟡 Médio | 8h | Dependência de PERF-01. Resolver juntos no mesmo sprint |
| MNT-03 | **`window.openModal` global** — sem suporte a modais aninhados | 🟡 Médio | 4h | Bloqueia fluxos financeiros avançados (confirmação dentro de formulário) |
| FE-NEW-02 | **Estados de erro inconsistentes** — ~10 views com tratamento diferente | 🟡 Médio | 3h | Padronizar `errorHandler(err, context)` em `ui.js` |
| MNT-04 | **Sem skeleton screens** | 🟢 Baixo | 2h | Spinners resolvem 80% dos casos; skeleton só para listagens longas |
| MNT-05 | **Tamanhos de texto arbitrários** (`text-[10px]`, `text-[11px]`) | 🟢 Baixo | 1h | Substituição simples |

### 4.5 Operações / Observabilidade

| ID | Débito | Severidade | Esforço | Notas |
|----|--------|-----------|---------|-------|
| OPS-NEW-01 | **Sem observabilidade de jobs e health** — falhas silenciosas | 🟡 Médio | 4h | Jobs de aniversário/lembretes falham sem notificação; sem `/health` endpoint documentado |
| OPS-NEW-02 | **Sem estratégia de backup documentada** | 🟠 Alto | 2h | Dados sensíveis (membros, doações, notas pastorais) sem procedimento de backup/restore |

---

## 5. Riscos Cruzados (Identificados pelo @qa)

| # | Risco | Débitos envolvidos | Severidade | Ação |
|---|-------|--------------------|-----------|------|
| R1 | Zero testes amplifica todos os outros débitos | SYS-01 × todos | 🔴 | Priorizar SYS-01 em Sprint 1 |
| R2 | financeGuard fail-open + módulo financeiro em dev | SEC-01 × UX-01 | 🔴 | Gate 1 obrigatório |
| R3 | Multi-tenancy app-only + AttendanceRecord sem orgId | SEC-02 × DB-NEW-01 | 🟠 | DB-NEW-01 resolve vetor específico |
| R4 | Express 5 beta + zero rollback scripts | SYS-04 × OPS-01 | 🟠 | Fixar versão Express + Gate 3 |
| R5 | Modal único global bloqueia views financeiras avançadas | MNT-03 × UX-01 | 🟡 | MNT-03 antes de finance-bills/transactions |
| R6 | ActivityLog sem retenção em SaaS multi-tenant | DB-NEW-02 × escala | 🟡 | Prazo: 6º mês em produção |

---

## 6. Plano de Sprints Recomendado

### Sprint 0 — Quick Fixes Imediatos (3h — hoje)

| ID | Ação | Tempo |
|----|------|-------|
| SEC-01 | financeGuard fail-closed + auditar RBAC com `hasFinanceAccess()` | 1h |
| A11Y-01 | Remover `user-select: none` do body | 1h |
| A11Y-05 | `role="dialog"` em `openModal()` | 0.5h |
| SYS-09/10 | Remover `tmp_test_db.js` e `migrate.log` do repo | 0.5h |

---

### Sprint 1 — Fundação de Performance e DB (10h)

| ID | Ação | Tempo |
|----|------|-------|
| IDX-01 | Person indexes (`CONCURRENTLY`) | 1h |
| IDX-02/03/04 | Índices de alta prioridade | 1.5h |
| IDX-05/06/07 | Índices médios | 1.5h |
| PERF-01 | Migrar Tailwind CDN → `@tailwindcss/vite` | 3-5h |
| MNT-02 | Dark mode `dark:` variants (junto com PERF-01) | incluído |
| PERF-02/03 | Lazy load SheetJS e Chart.js | 1.5h |

---

### Sprint 2 — Módulo Financeiro + Acessibilidade (45h)

| ID | Ação | Tempo |
|----|------|-------|
| UX-01 | 9 views do módulo financeiro | 38h |
| A11Y-02 | `aria-label` nos ~35 botões de ícone | 2h |
| A11Y-04 | Focus trap centralizado em `openModal()` | 3h |
| FE-NEW-01 | Validação de contraste para `primaryColor` | 2h |

---

### Sprint 3 — Integridade do Banco + Testes Iniciais (25h)

| ID | Ação | Tempo |
|----|------|-------|
| SYS-01 | Testes de integração para rotas críticas (auth, multi-tenancy, financeGuard) | 12h |
| SEC-03 | CHECK constraints para campos críticos | 3h |
| SEC-04 | FK formal para `Cell.leaderId` (verificar órfãos antes) | 4h |
| DB-NEW-01 | `organizationId` em `AttendanceRecord` | 3h |
| OPS-01 | Rollback scripts — snapshot + últimas 3 migrations + processo | 4h |
| OPS-NEW-02 | Documentar e automatizar estratégia de backup | 2h |

---

### Sprint 4 — Sistema de Componentes (36-40h — iniciativa dedicada)

| ID | Ação | Tempo |
|----|------|-------|
| MNT-01 | Extrair componentes atômicos das 29 views (loading, header, empty state, table, modal confirm) | 32-40h |
| FE-NEW-02 | Padronizar `errorHandler()` em `ui.js` | 3h |
| MNT-03 | Stack de modais (resolver `window.openModal`) | 4h |

---

### Sprint 5 — Estratégico / Backlog (planejamento cuidadoso)

| ID | Ação | Tempo |
|----|------|-------|
| SEC-07 | Soft-delete consistente (decisão estratégica primeiro) | 6h |
| DES-02 | JSON String → Prisma `Json` type (começar por `secondaryRoles`) | 6h |
| DB-NEW-02 | Política de retenção do ActivityLog | 4h |
| OPS-NEW-01 | Health endpoint + alertas de jobs | 4h |
| SEC-02 | RLS PostgreSQL (iniciativa separada, 20-40h, após estabilidade) | 20-40h |
| SYS-07 | TypeScript (iniciativa estratégica) | 40h+ |

---

## 7. Matriz de Priorização Final

| Prioridade | ID | Débito | Esforço | Risco se ignorado |
|-----------|-----|--------|---------|------------------|
| **P0 — Hoje** | SEC-01 | financeGuard fail-closed | 1h | Acesso financeiro indevido |
| **P0 — Hoje** | A11Y-01 | user-select remover do body | 1h | Usabilidade básica quebrada |
| **P0 — Sprint 1** | IDX-01 | Person indexes | 1h | Performance degradada em crescimento |
| **P0 — Sprint 1** | PERF-01 | Tailwind CDN → local | 3-5h | 3MB de CSS em cada carregamento |
| **P1 — Sprint 2** | UX-01 | Módulo Financeiro Fase 3 | 38h | Feature bloqueada para clientes |
| **P1 — Sprint 2** | A11Y-02/04 | Acessibilidade crítica | 5h | WCAG não-conformante |
| **P1 — Sprint 3** | SYS-01 | Testes de integração básicos | 12h | Risco multiplicador sistêmico |
| **P1 — Sprint 3** | OPS-01 | Processo de rollback | 4h | Recovery impossível em incidentes |
| **P2 — Sprint 4** | MNT-01 | Sistema de componentes | 32-40h | Custo marginal de features cresce indefinidamente |
| **P2 — Sprint 3** | SEC-03/04 | CHECK constraints + FK | 7h | Integridade do banco em risco |
| **P3 — Sprint 5** | SEC-07 | Soft-delete consistente | 6h | Perda de histórico ao deletar dados |
| **P3 — Sprint 5** | DES-02 | JSON → tipo nativo | 6h | Sem validação de schema no banco |
| **P4 — Backlog** | SEC-02 | RLS PostgreSQL | 20-40h | Mitigado por testes de isolamento |
| **P4 — Backlog** | SYS-07 | TypeScript | 40h+ | Qualidade de código longo prazo |

---

## 8. Sumário de Esforço por Sprint

| Sprint | Foco | Esforço | Acumulado |
|--------|------|---------|-----------|
| Sprint 0 (hoje) | Quick fixes críticos | 3h | 3h |
| Sprint 1 | Performance + DB indexes | 10h | 13h |
| Sprint 2 | Módulo financeiro + A11Y | 45h | 58h |
| Sprint 3 | Integridade + Testes | 25h | 83h |
| Sprint 4 | Sistema de componentes | 40h | 123h |
| Sprint 5 | Estratégico / Backlog | 80h+ | 200h+ |

**Total sprints 0-4 (recomendados para 2026):** ~123h
**Total com Sprint 5 completo:** ~200-215h

---

*Documento finalizado por @architect — Brownfield Discovery Workflow Fase 8*
*Revisado por: @data-engineer (Fase 5), @ux-design-expert (Fase 6), @qa (Fase 7)*
*Próximo: @analyst gera relatório executivo (Fase 9)*
