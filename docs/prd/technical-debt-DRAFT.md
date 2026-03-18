# Technical Debt Assessment — DRAFT
## Para Revisão dos Especialistas

**Projeto:** CRM Celular — SaaS multi-tenant para igrejas
**Data:** 2026-03-17
**Versão:** DRAFT 1.0
**Consolidado por:** @architect (Brownfield Discovery — Fase 4)
**Status:** ⚠️ PENDENTE revisão de @data-engineer e @ux-design-expert

---

## Sumário Executivo Preliminar

| Área | Débitos Identificados | Críticos | Altos | Médios |
|------|----------------------|---------|-------|--------|
| Sistema / Backend | 10 | 0 | 4 | 4 |
| Segurança | 9 | 2 | 4 | 3 |
| Database | 14 | 1 | 5 | 5 |
| Frontend / UX | 16 | 2 | 5 | 7 |
| **TOTAL** | **49** | **5** | **18** | **19** |

**Esforço total estimado (preliminar):** ~160-180 horas

---

## 1. Débitos de Sistema (Backend + Infraestrutura)

*Fonte: `docs/architecture/system-architecture.md`*

| ID | Débito | Severidade | Esforço Est. | Observações |
|----|--------|-----------|-------------|-------------|
| SYS-01 | **Zero testes automatizados** — backend sem qualquer suite de testes | 🔴 Alto | 20h | `"test": "echo Error"` no package.json |
| SYS-02 | **Jobs com `setInterval` simples** — sem cron real, sem persistência | 🟡 Médio | 4h | Timer reseta ao reiniciar o server |
| SYS-03 | **Scripts de debug na raiz do server** — `check-*.js`, `debug-db.js`, etc. | 🟡 Médio | 1h | Poluição do repositório |
| SYS-04 | **Express 5 (beta) em produção** | 🟡 Médio | 2h | Possíveis breaking changes sem aviso |
| SYS-05 | **Datas como String** — `date: String "YYYY-MM-DD"` em 15+ campos | 🟡 Médio | 8h+ | Dificulta queries nativas de data |
| SYS-06 | **JSON serializado como String** — 6 campos (`secondaryRoles`, `extraData`, etc.) | 🟡 Médio | 6h | Sem validação de schema no DB |
| SYS-07 | **Ausência de TypeScript** — frontend e backend em JS puro | 🟡 Médio | 40h+ | Sem type safety cross-stack |
| SYS-08 | **Troca de provider SQLite↔PG manual** — edição de schema.prisma | 🟢 Baixo | 2h | Propenso a erro humano em dev |
| SYS-09 | **`tmp_test_db.js` na raiz** — arquivo temporário commitado | 🟢 Baixo | 0.5h | Limpeza simples |
| SYS-10 | **`migrate.log` commitado** | 🟢 Baixo | 0.5h | Limpeza simples |

⚠️ **PENDENTE:** Revisão do @data-engineer para SYS-05 e SYS-06 (impacto real no banco)

---

## 2. Débitos de Segurança

*Fonte: `docs/architecture/system-architecture.md` + `server/prisma/docs/DB-AUDIT.md`*

| ID | Débito | Severidade | Esforço Est. | Observações |
|----|--------|-----------|-------------|-------------|
| SEC-01 | **`financeGuard` fail-open** — chama `next()` se DB falhar, liberando acesso ao módulo financeiro | 🔴 Crítico | 0.5h | `financeGuard.js` linha 25-27 |
| SEC-02 | **Multi-tenancy apenas na camada de aplicação** — sem RLS no PostgreSQL | 🟠 Alto | 12h | Bug em qualquer rota pode vazar dados entre igrejas |
| SEC-03 | **Sem CHECK constraints** em campos críticos (`User.role`, `Organization.plan`, etc.) | 🟠 Alto | 2h | Valores inválidos por acesso direto ao banco |
| SEC-04 | **`Cell.leaderId/viceLeaderId` sem FK formal** — Strings sem `@relation` | 🟠 Alto | 3h | Sem integridade referencial no banco |
| SEC-05 | **`secondaryRoles` como JSON String** — sem validação de schema no DB | 🟡 Médio | 2h | Roles inválidos silenciosamente ignorados |
| SEC-06 | **Sem auditoria de LOGIN_FAIL por análise** — ActivityLog sem índice em `action` | 🟡 Médio | 1h | Difícil detectar ataques de força bruta |
| SEC-07 | **Soft-delete inconsistente** — apenas 4 modelos têm `deletedAt` | 🟡 Médio | 6h | Perda de histórico ao deletar Person, Cell, etc. |
| SEC-08 | **Sem 2FA/MFA** | 🟡 Médio | 16h | Apenas usuário/senha |
| SEC-09 | **JWT sem refresh token** — expira em 24h sem renovação silenciosa | 🟢 Baixo | 8h | UX: logout involuntário |

⚠️ **PERGUNTA para @data-engineer:** SEC-02 (RLS no PG) — qual o esforço real para implementar RLS no PostgreSQL via Prisma? Há suporte nativo?

---

## 3. Débitos de Database

*Fonte: `server/prisma/docs/SCHEMA.md` + `server/prisma/docs/DB-AUDIT.md`*

### 3.1 Índices Faltando

| ID | Débito | Severidade | Esforço Est. | Tabela / Campo |
|----|--------|-----------|-------------|---------------|
| IDX-01 | **`Person` sem índice em `organizationId` e `cellId`** | 🔴 Crítico | 1h | Tabela mais acessada do sistema |
| IDX-02 | **`AttendanceRecord.personId`** sem índice isolado | 🟠 Alto | 0.5h | Histórico de frequência por pessoa |
| IDX-03 | **`Notification` sem índice em `organizationId`, `userId`, `read`** | 🟠 Alto | 0.5h | Carregado a cada login |
| IDX-04 | **`EbdStudent.ebdClassId`** sem índice isolado | 🟠 Alto | 0.5h | Listagem de alunos por classe |
| IDX-05 | **`Attendance.date`** sem índice por período | 🟡 Médio | 0.5h | Relatórios de frequência |
| IDX-06 | **`Event.organizationId` + `date`** sem índice composto | 🟡 Médio | 0.5h | Calendário e lembretes |
| IDX-07 | **`PersonMilestone.personId`** sem índice | 🟡 Médio | 0.5h | Perfil do membro |
| IDX-08 | **`EbdClass.organizationId`** sem índice simples | 🟡 Médio | 0.5h | Listagem de classes |

### 3.2 Design e Integridade

| ID | Débito | Severidade | Esforço Est. |
|----|--------|-----------|-------------|
| DES-01 | **Datas como String** em 15+ campos do schema | 🟠 Alto | 8h+ (breaking) |
| DES-02 | **6 campos JSON serializados como String** sem tipo nativo | 🟡 Médio | 6h |
| DES-03 | **`Cell.leaderId` sem FK formal** | 🟡 Médio | 2h |
| DES-04 | **`Person.status` como String livre** — sem enum/CHECK | 🟡 Médio | 1h |
| DES-05 | **`EbdOffering.valor` como Float** — único campo monetário não em centavos | 🟡 Médio | 2h |

### 3.3 Operações

| ID | Débito | Severidade | Esforço Est. |
|----|--------|-----------|-------------|
| OPS-01 | **Zero rollback scripts** para as 13 migrations existentes | 🟠 Alto | 4h |

⚠️ **PERGUNTA para @data-engineer:**
1. DES-01 (datas como String) — qual o impacto real nas queries? Vale migrar para DateTime?
2. DES-05 (EbdOffering.valor Float) — confirmar se há risco real de arredondamento com os valores usados?
3. OPS-01 — existe abordagem pragmática para criar rollback scripts retroativamente?

---

## 4. Débitos de Frontend / UX

*Fonte: `docs/frontend/frontend-spec.md`*

### 4.1 Features Pendentes

| ID | Débito | Severidade | Esforço Est. |
|----|--------|-----------|-------------|
| UX-01 | **Módulo Financeiro Fase 3 — 9 views pendentes** | 🔴 Crítico | 24h |

### 4.2 Performance

| ID | Débito | Severidade | Esforço Est. |
|----|--------|-----------|-------------|
| PERF-01 | **Tailwind CSS via CDN** — ~3MB não purgeado | 🟠 Alto | 4h |
| PERF-02 | **SheetJS carregado globalmente** — 1.2MB desnecessário em páginas simples | 🟡 Médio | 2h |
| PERF-03 | **Chart.js carregado globalmente** — 190KB desnecessário | 🟡 Médio | 2h |
| PERF-04 | **Sem code splitting** — todo app em um bundle | 🟡 Médio | 8h |

### 4.3 Acessibilidade

| ID | Débito | Severidade | Esforço Est. | WCAG |
|----|--------|-----------|-------------|------|
| A11Y-01 | **`user-select: none` global** — usuário não consegue selecionar texto | 🔴 Crítico | 1h | 1.3.1 |
| A11Y-02 | **Botões de ícone sem `aria-label`** | 🟠 Alto | 3h | 4.1.2 |
| A11Y-03 | **Sem skip navigation link** | 🟠 Alto | 1h | 2.4.1 |
| A11Y-04 | **Modais sem focus trap** | 🟠 Alto | 4h | 2.1.2 |
| A11Y-05 | **Sem `role="dialog"` nos modais** | 🟠 Alto | 1h | 4.1.2 |

### 4.4 Manutenibilidade

| ID | Débito | Severidade | Esforço Est. |
|----|--------|-----------|-------------|
| MNT-01 | **Sistema de componentes ausente** — padrões duplicados em 29 views | 🟠 Alto | 24h |
| MNT-02 | **Dark mode via `!important` overrides** — ~40 linhas de overrides globais | 🟡 Médio | 6h |
| MNT-03 | **`window.openModal` global** — sem suporte a modais aninhados | 🟡 Médio | 4h |
| MNT-04 | **Sem skeleton screens** — apenas spinners genéricos | 🟡 Médio | 8h |
| MNT-05 | **Tamanhos de texto arbitrários** (`text-[11px]`, `text-[10px]`) | 🟢 Baixo | 2h |

⚠️ **PERGUNTAS para @ux-design-expert:**
1. MNT-01 — qual a prioridade real de um sistema de componentes? Afeta o day-to-day de desenvolvimento?
2. PERF-01 (Tailwind CDN) — já há plano de migração ou dependência técnica que impeça a migração local?
3. A11Y-01 (`user-select: none`) — há partes da UI onde essa restrição faz sentido (ex: evitar zoom acidental mobile)?

---

## 5. Matriz Preliminar de Priorização

| ID | Débito | Área | Impacto | Esforço | Prioridade |
|----|--------|------|---------|---------|-----------|
| UX-01 | Módulo Financeiro Fase 3 | Feature | 🔴 Crítico | 24h | P0 — Bloqueante |
| SEC-01 | financeGuard fail-open | Segurança | 🔴 Crítico | 0.5h | P0 — Quick fix |
| A11Y-01 | user-select global | UX | 🔴 Crítico | 1h | P0 — Quick fix |
| IDX-01 | Person sem índices | DB Perf | 🔴 Crítico | 1h | P0 — Quick fix |
| SYS-01 | Zero testes | Qualidade | 🔴 Alto | 20h | P1 — Sprint dedicado |
| IDX-02..04 | Índices de alta prioridade | DB Perf | 🟠 Alto | 1.5h | P1 — Quick wins |
| PERF-01 | Tailwind CDN | Performance | 🟠 Alto | 4h | P1 — Sprint |
| MNT-01 | Sistema de componentes | DX | 🟠 Alto | 24h | P2 — Iniciativa maior |
| SEC-02 | Multi-tenancy sem RLS | Segurança | 🟠 Alto | 12h | P2 — Planejamento cuidadoso |
| A11Y-02..05 | Acessibilidade crítica | A11Y | 🟠 Alto | 9h | P1 — Sprint |
| OPS-01 | Sem rollback scripts | Ops | 🟠 Alto | 4h | P1 — Process |
| DES-01 | Datas como String | DB Design | 🟠 Alto | 8h+ | P3 — Breaking change |
| SYS-05 | Datas String no schema | Sistema | 🟡 Médio | 8h | P3 — Junto com DES-01 |
| SEC-07 | Soft-delete inconsistente | Dados | 🟡 Médio | 6h | P2 — Antes de features |
| SYS-07 | Sem TypeScript | DX | 🟡 Médio | 40h+ | P4 — Iniciativa estratégica |

---

## 6. Perguntas Abertas para Revisão dos Especialistas

### Para @data-engineer (Dara):
1. **SEC-02** — Implementar RLS no PostgreSQL com Prisma é viável? Qual o esforço real e os riscos?
2. **DES-01** — Migrar campos `date: String` para `DateTime` no Prisma: qual o impacto nas queries existentes? Vale o custo?
3. **DES-05** — `EbdOffering.valor: Float` — há risco real de arredondamento? Os valores registrados são grandes o suficiente para importar?
4. **IDX-01** — Confirmar que `Person` realmente não tem nenhum índice em `organizationId` além do schema atual, e validar o impacto estimado.
5. **OPS-01** — Abordagem recomendada para rollback scripts retroativos no Prisma?

### Para @ux-design-expert (Uma):
1. **MNT-01** — Quão crítico é o sistema de componentes do ponto de vista de manutenção? Qual o impacto atual no time?
2. **PERF-01** — Há dependência técnica que impeça migrar Tailwind do CDN para instalação local?
3. **A11Y-01** — `user-select: none` no body faz sentido para alguma parte da UI mobile? Ou pode ser removido completamente?
4. **UX-01** — As 9 views do módulo financeiro têm designs prontos ou precisam de spec primeiro?
5. **MNT-02** — Dark mode via `!important` overrides: o custo de refatorar para `dark:` variants do Tailwind justifica o benefício agora?

---

## 7. Próximos Passos

1. ⏳ **Fase 5** — @data-engineer revisa seção de Database (itens 3.x + perguntas acima)
2. ⏳ **Fase 6** — @ux-design-expert revisa seção de Frontend/UX (itens 4.x + perguntas acima)
3. ⏳ **Fase 7** — @qa faz review geral de qualidade e riscos cruzados
4. ⏳ **Fase 8** — @architect finaliza assessment incorporando todos os inputs

---

*Documento gerado por @architect em execução do Brownfield Discovery Workflow — Fase 4*
*Status: RASCUNHO — aguardando validação dos especialistas nas Fases 5 e 6*
