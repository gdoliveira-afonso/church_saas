# QA Review — Brownfield Discovery Quality Gate

**Projeto:** CRM Celular
**Data:** 2026-03-17
**Revisor:** @qa (Quinn) — Brownfield Discovery Fase 7
**Escopo:** Cross-review de todos os artefatos das Fases 1-6 + análise de riscos cruzados

---

## Veredicto do QA Gate

**STATUS: ✅ APROVADO COM RESSALVAS**

O assessment está tecnicamente sólido. Os especialistas @data-engineer e @ux-design-expert identificaram e ajustaram débitos com precisão. Não há gaps críticos não documentados que bloqueiem o prosseguimento.

**Ressalvas obrigatórias (devem constar no documento final):**
1. SYS-01 (zero testes) deve ser tratado como P1 independente de qualquer priorização — é o risco multiplicador de todos os outros débitos
2. SEC-01 (financeGuard fail-open) deve ser corrigido ANTES de qualquer deploy do módulo financeiro em produção
3. O inventário de débitos cruzados desta revisão deve ser incorporado ao `technical-debt-assessment.md` final

---

## 1. Validação de Consistência Entre Fases

### Checklist de Completude

| Item | Status | Observação |
|------|--------|-----------|
| Fase 1 — System Architecture documentada | ✅ | `docs/architecture/system-architecture.md` |
| Fase 2 — Schema + DB Audit documentados | ✅ | `server/prisma/docs/SCHEMA.md` + `DB-AUDIT.md` |
| Fase 3 — Frontend Spec documentada | ✅ | `docs/frontend/frontend-spec.md` |
| Fase 4 — Draft consolidado | ✅ | `docs/prd/technical-debt-DRAFT.md` |
| Fase 5 — DB review com respostas às 5 perguntas | ✅ | `docs/reviews/db-specialist-review.md` |
| Fase 6 — UX review com respostas às 5 perguntas | ✅ | `docs/reviews/ux-specialist-review.md` |
| Contagem total de débitos consistente entre docs | ⚠️ | DRAFT: 49 débitos; com adições dos specialists: ~56. Ver seção 3 |
| Estimativas de esforço revisadas pelos specialists | ✅ | DB e UX ajustaram 6+ estimativas |
| Perguntas abertas do @architect todas respondidas | ✅ | 10/10 perguntas respondidas |
| Dependências entre débitos documentadas | ⚠️ | Parcial — ver seção 4 |

---

## 2. Riscos Cruzados (Cross-Cutting Risks)

Esta seção identifica riscos que surgem da **interação entre débitos** — não visíveis ao analisar cada área isoladamente.

### Risco 1 — SYS-01 × TODOS: Zero testes amplifica todos os outros débitos

**Severidade combinada: 🔴 Crítico**

O débito SYS-01 (zero testes automatizados) não é apenas um débito isolado — é um **multiplicador de risco** para todo o sistema:

| Débito | Risco sem testes |
|--------|-----------------|
| SEC-01 (financeGuard fail-open) | Fix de 0.5h pode ser revertido acidentalmente — sem teste que detecte |
| IDX-01 (Person sem índices) | Migration pode falhar silenciosamente em prod — sem smoke test |
| PERF-01 (Tailwind CDN → local) | Classes purgeadas acidentalmente — sem teste de regressão visual |
| MNT-01 (refatorar componentes) | Refatoração sem testes = risco de regressão em 29 views |
| SEC-02 (multi-tenancy app-only) | Leak cross-tenant introduzido por bug — sem teste de isolamento |
| OPS-01 (sem rollback scripts) | Migration aplicada, não é possível testar rollback com segurança |

**Conclusão:** Sem pelo menos testes de integração básicos para as rotas críticas (auth, multi-tenancy, financeGuard), qualquer correção de débito carrega risco de regressão não detectada. **SYS-01 deve ser Sprint 1, não Sprint 2.**

---

### Risco 2 — SEC-01 × UX-01: financeGuard fail-open + módulo financeiro em dev ativo

**Severidade combinada: 🔴 Crítico Imediato**

O `financeGuard.js` linha 25-27 tem fail-open confirmado. O módulo financeiro está em **desenvolvimento ativo** (3 arquivos modificados no git status: `finance-dashboard.js`, `finance-reports.js`, `finance-bi.js`).

**Sequência de risco concreta:**
1. Dev completa uma view financeira e faz deploy
2. Em produção, o banco tem momentânea lentidão
3. `financeGuard` chama `next()` silenciosamente
4. Usuário sem permissão acessa dados financeiros da organização

**Este cenário pode ocorrer no próximo deploy do módulo financeiro.**

**Gate obrigatório:** SEC-01 DEVE ser corrigido e commitado ANTES de qualquer view financeira ir para produção. É o único item P0 com blocking imediato.

---

### Risco 3 — SEC-02 × DB-NEW-01: Multi-tenancy app-only + AttendanceRecord sem organizationId

**Severidade combinada: 🟠 Alto**

A ausência de `organizationId` em `AttendanceRecord` (DB-NEW-01) cria um vetor de vazamento específico:

- `AttendanceRecord` só pode ser filtrado por org via JOIN com `Attendance`
- Se qualquer rota que consulta `AttendanceRecord` esquecer o JOIN, retorna dados de todas as orgs
- Com multi-tenancy apenas na aplicação (SEC-02), não há fallback no banco que impeça isso

**Risco real:** Uma query como `prisma.attendanceRecord.findMany({ where: { personId } })` sem o JOIN correto vaza frequência de qualquer organização para qualquer usuário autenticado que conheça um `personId`.

---

### Risco 4 — SYS-04 × OPS-01: Express 5 beta + zero rollback scripts

**Severidade combinada: 🟠 Alto**

Express 5 está em produção com status **beta**. Sem rollback scripts para migrations, se uma nova versão do Express 5 introduzir breaking change que quebre o servidor em produção:
- Não há caminho de rollback rápido para o schema do banco
- Downgrade do Express pode ser incompatível com migrations aplicadas

**Mitigação necessária:** Pinagem de versão do Express (`"express": "5.2.1"` em vez de `"^5.2.1"`) + OPS-01 resolvido antes de qualquer deploy em produção.

---

### Risco 5 — MNT-03 × UX-01: window.openModal global + views financeiras com confirmações aninhadas

**Severidade combinada: 🟡 Médio**

O módulo financeiro naturalmente precisará de fluxos com modais aninhados:
- Registrar pagamento de conta → abre modal de confirmação → dentro do modal há botão "Ver extrato" → precisaria abrir outro modal

Com `window.openModal` permitindo apenas uma instância, esses fluxos são impossíveis sem workarounds. **MNT-03 deve ser resolvido antes ou durante o desenvolvimento das views financeiras mais complexas** (finance-transactions.js, finance-bills.js).

---

### Risco 6 — DB-NEW-02 × ActivityLog: Audit trail sem retenção em SaaS multi-tenant

**Severidade combinada: 🟡 Médio (com prazo)**

`ActivityLog` cresce com todas as operações de **todas as organizações**. Em SaaS com múltiplos tenants:
- 1 org com 100 usuários ativos gera ~500-1000 logs/dia
- 10 orgs = ~5.000-10.000 logs/dia
- Em 6 meses = ~900.000-1.800.000 registros sem índice em `action`

O @data-engineer estimou que ActivityLog será a maior tabela em 6-12 meses. Sem política de retenção, isso afeta performance de **todas as consultas de audit** de todas as orgs simultâneamente.

**Gate temporal:** DB-NEW-02 deve ser planejado antes do 6º mês em produção com múltiplos tenants.

---

## 3. Inventário Consolidado de Débitos (todas as fases)

| Área | Total original | Adições specialists | Total final |
|------|--------------|--------------------|-----------:|
| Sistema / Backend | 10 | 0 | **10** |
| Segurança | 9 | 0 | **9** |
| Database (índices) | 8 | 0 | **8** |
| Database (design/integridade) | 6 | 2 (DB-NEW-01/02) | **8** |
| Frontend / UX / Performance | 16 | 3 (FE-NEW-01/02/03) | **19** |
| **TOTAL** | **49** | **5** | **54** |

**Distribuição por severidade (atualizada após revisões dos specialists):**

| Severidade | DRAFT | Pós-review | Delta |
|-----------|-------|-----------|-------|
| 🔴 Crítico | 5 | 5 | = |
| 🟠 Alto | 18 | 17 | -1 (ajustes de severidade) |
| 🟡 Médio | 19 | 23 | +4 |
| 🟢 Baixo | 7 | 9 | +2 |
| **Total** | **49** | **54** | **+5** |

---

## 4. Dependências Entre Débitos (Grafo)

Débitos com dependências de execução que o @architect deve refletir na priorização final:

```
SEC-01 ──────────────────────────────────────────► BLOQUEIA deploy financeiro
SYS-01 ──────────────────────────────────────────► AMPLIFICA todos os outros

IDX-01 ──────────────────────────────────────────► independente (quick win)

PERF-01 (Tailwind CDN)
  └──► MNT-02 (dark mode) — resolver juntos no mesmo sprint
  └──► PERF-04 (code splitting) — só faz sentido depois

MNT-03 (window.openModal)
  └──► Necessário antes de finance-transactions + finance-bills avançados

DB-NEW-01 (AttendanceRecord orgId)
  └──► SEC-02 (multi-tenancy) — resolve vetor de leak parcial

OPS-01 (rollback scripts)
  └──► Necessário antes de qualquer migration nova em produção

MNT-01 (sistema de componentes)
  └──► Executar após UX-01 (módulo financeiro) estabilizar
```

---

## 5. Gaps Identificados pelo QA (não cobertos pelas fases anteriores)

### Gap 1 — Sem estratégia de testes documentada

Nenhuma das fases 1-6 documentou **como** os testes devem ser escritos quando SYS-01 for resolvido. O @architect deve incluir no documento final:
- Qual framework de testes usar (Jest? Vitest?)
- Quais camadas têm prioridade (unit, integration, e2e)?
- Qual a cobertura mínima esperada?

**Recomendação do @qa:** Focar primeiro em testes de integração das rotas críticas (auth, multi-tenancy, financeGuard) — mais valor que testes unitários isolados.

---

### Gap 2 — Nenhum plano de observabilidade documentado

O sistema tem `ActivityLog` mas **não há monitoramento de saúde**:
- Sem health endpoint documentado (`/api/health` existe?)
- Sem alertas de erro em produção
- Sem métricas de tempo de resposta por rota
- Jobs agendados (`setInterval`) falham silenciosamente sem notificação

Para um SaaS multi-tenant, falha silenciosa em job (ex: lembretes de aniversário) pode durar dias sem ser detectada.

**Prioridade:** 🟡 Médio — adicionar ao documento final como `OPS-NEW-01`.

---

### Gap 3 — Sem estratégia de backup documentada

O sistema usa PostgreSQL 16 em produção via Docker. Não há documentação de:
- Frequência de backups
- Onde backups são armazenados
- Procedimento de restore testado

Com dados de múltiplas igrejas (dados sensíveis — membros, doações, notas pastorais), a ausência de backup documentado é um risco operacional.

**Prioridade:** 🟠 Alto — adicionar ao documento final como `OPS-NEW-02`.

---

### Gap 4 — financeGuard cobre apenas `financialEnabled`, não RBAC

O @data-engineer documentou o fail-open de `financeGuard`. O @qa identifica um segundo problema não documentado: mesmo com o fail-closed corrigido, o guard verifica apenas `financialEnabled` da organização — **não verifica se o usuário tem papel financeiro**.

O RBAC financeiro parece estar em `server/lib/financeAccess.js` (hasFinanceAccess), mas a relação entre `financeGuard` (middleware de rota) e `hasFinanceAccess` (helper) precisa ser auditada.

**Questão:** O `financeGuard` é o único ponto de entry ou há verificações adicionais por rota?

**Prioridade:** 🔴 Crítico — deve ser auditado durante a correção de SEC-01.

---

## 6. Verificação Final de Qualidade do Assessment

### Completude

| Critério | Status |
|---------|--------|
| Todas as 4 áreas cobertas (Sistema, Segurança, DB, Frontend) | ✅ |
| Especialistas revisaram suas respectivas áreas | ✅ |
| Perguntas técnicas abertas respondidas | ✅ (10/10) |
| Estimativas de esforço revisadas por quem vai executar | ✅ |
| Ordem de resolução com dependências | ⚠️ Parcial — ver seção 4 |
| Riscos cruzados entre áreas documentados | ✅ Esta seção |
| Gaps não cobertos identificados | ✅ 4 gaps adicionados |

### Confiabilidade das Estimativas

| Área | Confiança | Observação |
|------|----------|-----------|
| Índices de banco | 🟢 Alta | Estimativas confirmadas pelo especialista |
| Segurança (SEC-01, SEC-03, SEC-04) | 🟢 Alta | Escopo técnico bem definido |
| Módulo Financeiro Frontend (UX-01) | 🟡 Média | 38h depende do estado atual dos 3 arquivos em andamento |
| Sistema de Componentes (MNT-01) | 🟡 Média | 32-40h pode variar com escolha de abordagem |
| RLS PostgreSQL (SEC-02) | 🟡 Média | 20-40h — alta variância, recomendação é não priorizar |
| Zero testes (SYS-01) | 🔴 Baixa | 20h é subestimativa — sem saber a cobertura alvo |

---

## 7. Recomendações para o Documento Final (@architect)

O `technical-debt-assessment.md` final deve:

1. **Incorporar os 5 débitos adicionais** dos specialists (DB-NEW-01, DB-NEW-02, FE-NEW-01, FE-NEW-02, FE-NEW-03) + **3 gaps do QA** (OPS-NEW-01, OPS-NEW-02, + auditoria do financeGuard RBAC)

2. **Incluir seção de riscos cruzados** — os 6 risks desta revisão são os mais perigosos por serem invisíveis ao olhar cada área isoladamente

3. **Ajustar a estimativa total** para ~170-195h (vs. 160-180h do DRAFT), refletindo:
   - Reestimativa UX-01: +14h (24→38h)
   - Reestimativa MNT-01: +8-16h (24→32-40h)
   - Novos débitos: ~14h (5 débitos × ~2-3h médios)
   - Mitigado por: reduções de severidade em 4 itens

4. **Destacar 3 gates obrigatórios antes de produção:**
   - Gate 1: SEC-01 (financeGuard fail-closed) — antes de deploy financeiro
   - Gate 2: IDX-01 (Person indexes) — antes de escalar para 1000+ membros
   - Gate 3: OPS-01 (processo de rollback) — antes da próxima migration

5. **Sinalizar SYS-01 como risco sistêmico**, não apenas como débito de qualidade

---

*Review concluído por @qa — Brownfield Discovery Fase 7*
*QA Gate: ✅ APROVADO — prosseguir para Fase 8 (@architect finaliza assessment)*
*Próximo: @architect consolida tudo em `docs/prd/technical-debt-assessment.md`*
