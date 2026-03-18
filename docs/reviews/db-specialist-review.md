# Database Specialist Review — Technical Debt Assessment

**Projeto:** CRM Celular
**Data:** 2026-03-17
**Revisor:** @data-engineer (Dara) — Brownfield Discovery Fase 5
**Documento revisado:** `docs/prd/technical-debt-DRAFT.md` (seção Database)

---

## Veredicto Geral

**STATUS: ✅ VALIDADO COM AJUSTES**

Os débitos identificados pelo @architect são precisos. Faço ajustes de severidade em 3 itens, adiciono 2 débitos não identificados e respondo todas as perguntas abertas.

---

## 1. Débitos Validados

| ID | Débito | Severidade Draft | Severidade Validada | Horas | Notas |
|----|--------|-----------------|--------------------|----|-------|
| IDX-01 | `Person` sem índices em `organizationId` e `cellId` | 🔴 Crítico | 🔴 **Crítico — CONFIRMO** | 1h | Person é consultada em praticamente todas as telas. Full table scan atual |
| IDX-02 | `AttendanceRecord.personId` sem índice | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 0.5h | Histórico de frequência individual: query sem índice a cada carregamento de perfil |
| IDX-03 | `Notification` sem índice composto | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 0.5h | Chamado a cada login de qualquer usuário |
| IDX-04 | `EbdStudent.ebdClassId` sem índice | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 0.5h | Listagem de alunos por classe é operação frequente |
| IDX-05 | `Attendance.date` sem índice | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 0.5h | Relatórios de período sofrem, mas volume menor |
| IDX-06 | `Event` sem índice composto | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 0.5h | Job diário de lembretes faz scan diário |
| IDX-07 | `PersonMilestone.personId` sem índice | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 0.5h | — |
| IDX-08 | `EbdClass.organizationId` sem índice simples | 🟡 Médio | 🟢 **Baixo — AJUSTE ↓** | 0.5h | O `@@unique([name, organizationId])` cria índice composto que o PG usa para filtrar por org. Impacto menor que estimado |
| SEC-01 | `financeGuard` fail-open | 🔴 Crítico | 🔴 **Crítico — CONFIRMO** | 0.5h | Fix trivial, risco alto. Prioridade máxima |
| SEC-02 | Multi-tenancy sem RLS | 🟠 Alto | 🟠 **Alto — AJUSTE ESFORÇO** | 20-40h | Veja resposta detalhada abaixo |
| SEC-03 | Sem CHECK constraints | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 3h | Adicionando 1h por contagem real de campos afetados |
| SEC-04 | `Cell.leaderId` sem FK formal | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 4h | Cuidado: migration que adiciona FK em dados existentes pode falhar se houver leaderId órfão |
| SEC-07 | Soft-delete inconsistente | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 6h | Decisão estratégica necessária: não é só técnico |
| DES-01 | Datas como String | 🟠 Alto | 🟡 **Médio — AJUSTE ↓** | 8h+ | Veja resposta detalhada abaixo |
| DES-02 | JSON serializado como String | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 6h | Prisma suporta tipo `Json` nativo — migração viável |
| DES-03 | `Cell.leaderId` sem FK | 🟡 Médio | Coberto por SEC-04 | — | Duplicado com SEC-04 |
| DES-04 | `Person.status` como String livre | 🟡 Médio | 🟡 **Médio — CONFIRMO** | 1h | CHECK constraint é adição não-breaking |
| DES-05 | `EbdOffering.valor: Float` | 🟡 Médio | 🟟 **Baixo — AJUSTE ↓** | 1h | Veja resposta detalhada abaixo |
| OPS-01 | Zero rollback scripts | 🟠 Alto | 🟠 **Alto — CONFIRMO** | 4h | Veja abordagem recomendada abaixo |

---

## 2. Débitos Adicionados

| ID | Débito | Severidade | Horas | Justificativa |
|----|--------|-----------|-------|--------------|
| **DB-NEW-01** | **`AttendanceRecord` sem `organizationId`** — diferente de todos os outros modelos | 🟠 Alto | 3h | Impossibilita queries de frequência por org sem JOIN obrigatório em `Attendance`. Quebra o padrão de isolamento de dados |
| **DB-NEW-02** | **`ActivityLog` cresce ilimitadamente** — sem política de retenção ou particionamento | 🟡 Médio | 4h | Audit trail de todas as operações sem TTL. Em produção com múltiplas igrejas, será a maior tabela do banco em 6-12 meses |

---

## 3. Respostas às Perguntas do @architect

### Pergunta 1: SEC-02 — RLS no PostgreSQL com Prisma é viável?

**Resposta: Viável, mas complexo. Recomendo abordagem gradual.**

O Prisma não tem suporte nativo a RLS — ele apenas executa SQL via driver. RLS precisaria ser implementado diretamente no PostgreSQL via migrations SQL raw.

**Desafios específicos para este projeto:**

1. **Prisma usa uma única connection pool** sem `set local role` por request — o contexto de row-level security (`current_setting('app.current_org_id')`) precisaria ser injetado via `$executeRaw` antes de cada query, o que é invasivo.

2. **SUPERADMIN bypassa organizações** — a lógica de resolução de org é dinâmica (JWT > override > host > fallback matriz). Difícil de mapear em políticas SQL estáticas.

3. **Custo real: 20-40h** (vs. 12h do DRAFT) — inclui: criar políticas para 28+ tabelas, adaptar todas as queries críticas, testes extensivos de isolamento cross-tenant, e tratamento de casos especiais (SUPERADMIN, org resolution).

**Recomendação pragmática:** Manter multi-tenancy na aplicação por ora e focar nos índices e CHECK constraints primeiro. RLS pode ser introduzido incrementalmente nas tabelas de maior risco (FinancialTransaction, Donation) em uma iniciativa dedicada. **Não classifico como P1.**

---

### Pergunta 2: DES-01 — Migrar `date: String` para `DateTime` vale o custo?

**Resposta: NÃO recomendo migração em massa agora. Baixo risco real, alto custo.**

**Por que o risco real é menor do que parece:**
- O formato `"YYYY-MM-DD"` é lexicograficamente ordenável — `WHERE date >= '2026-01-01'` funciona corretamente no PostgreSQL mesmo com String.
- Queries de range por string ISO 8601 têm performance comparável a DateTime para esse formato.
- O padrão já está estabelecido em 15+ campos e toda a lógica de frontend/backend é consistente.

**Por que é caro:**
- Migration de dados em 15+ colunas de alta frequência requer downtime ou migração zero-downtime complexa.
- Todas as queries Prisma que usam `date` precisariam ser revisadas.
- Risco de regressão alto.

**Recomendação:** **Manter String para campos existentes.** Para campos novos, usar `DateTime`. Classifico como 🟡 Médio (não 🟠 Alto) e com baixa prioridade de execução.

---

### Pergunta 3: DES-05 — `EbdOffering.valor: Float` tem risco real?

**Resposta: Risco baixo para os valores típicos de igrejas. Mas deve ser corrigido.**

Float IEEE 754 tem precisão de ~15 dígitos decimais. Para valores de ofertas de igrejas (tipicamente R$ 0,50 a R$ 10.000,00), o risco de arredondamento é mínimo no display.

**Entretanto:** É um padrão inconsistente — **todos os outros campos monetários do sistema usam `Int` (centavos)**. A inconsistência gera risco de bug quando código que espera Int recebe Float. Recomendo migrar para Int (centavos), mas é 🟢 Baixo em prioridade, não 🟡 Médio.

**Migration segura:** `ALTER TABLE "EbdOffering" ALTER COLUMN "valor" TYPE INTEGER USING ROUND(valor * 100)::INTEGER` — precisaria de análise dos dados existentes primeiro.

---

### Pergunta 4: IDX-01 — Confirmar ausência de índices em Person

**Resposta: CONFIRMADO. Person.organizationId e Person.cellId não têm índice.**

Verificado no `schema.prisma`: o model `Person` não tem nenhum `@@index` declarado. O único índice implícito é o `@unique` em `userId`.

Impacto real em produção com 1.000+ membros: cada `GET /api/people` faz full table scan. Em igrejas maiores (5.000+ membros), as queries de listagem, relatórios e dashboard ficam lentas rapidamente.

**Este é o índice mais crítico do sistema — deve ser o primeiro a ser adicionado.**

SQL direto (sem migration Prisma obrigatória para urgência):
```sql
CREATE INDEX CONCURRENTLY idx_person_org ON "Person"("organizationId");
CREATE INDEX CONCURRENTLY idx_person_cell ON "Person"("cellId");
```
`CONCURRENTLY` permite criar o índice sem bloquear a tabela em produção.

---

### Pergunta 5: OPS-01 — Rollback scripts retroativos no Prisma

**Resposta: Abordagem pragmática em 3 etapas.**

Para as 13 migrations existentes, criar rollback scripts retroativos *completos* não é viável nem necessário. Recomendo:

**Etapa 1 — Snapshot imediato (hoje, 30min):**
```bash
pg_dump $DATABASE_URL --schema-only > backup/schema-$(date +%Y%m%d).sql
```

**Etapa 2 — Rollback scripts para as últimas 3 migrations (as mais recentes e reversíveis):**
- `20260315190329_add_visitor_name_to_donation` → `ALTER TABLE "Donation" DROP COLUMN IF EXISTS "visitorName";`
- `20260311200000_fix_ebd_class_professor` → requer análise da migration
- `20260311135228_add_ebd_module_tables` → `DROP TABLE IF EXISTS "EbdOffering", "EbdAttendanceRecord", ...;`

**Etapa 3 — Processo obrigatório para novas migrations:**
Todo PR com migration Prisma deve incluir arquivo `rollback_YYYYMMDD.sql` na pasta `server/prisma/rollbacks/`.

---

## 4. Ordem de Resolução Recomendada (perspectiva DB)

### Sprint 1 — Quick Wins (8h total, impacto imediato)
1. **IDX-01** — `Person` indexes (1h) — maior impacto de performance
2. **IDX-02/03/04** — indexes alta prioridade (1.5h)
3. **SEC-01** — `financeGuard` fail-closed (0.5h) — risco de segurança imediato
4. **Snapshot** do schema atual (0.5h) — antes de qualquer mudança
5. **IDX-05/06/07** — indexes médios (1.5h)
6. **DES-02** — JSON String → Prisma `Json` type (6h, em campos de menor risco primeiro: `secondaryRoles`)

### Sprint 2 — Fundação (18h)
7. **SEC-03** — CHECK constraints para campos críticos (3h)
8. **SEC-04** — FK formal para `Cell.leaderId` (4h — testar dados órfãos antes)
9. **DB-NEW-01** — Adicionar `organizationId` em `AttendanceRecord` (3h — migration com dados)
10. **OPS-01** — Criar processo de rollback + scripts retroativos recentes (4h)
11. **DES-04** — `Person.status` CHECK constraint (1h)
12. **DES-05** — `EbdOffering.valor` Float → Int (1h + análise de dados)

### Sprint 3 — Estratégico (planejamento cuidadoso)
13. **SEC-07** — Soft-delete consistente (6h — decisão estratégica primeiro)
14. **DB-NEW-02** — Política de retenção do ActivityLog (4h)
15. **SEC-02** — RLS PostgreSQL (20-40h — iniciativa separada, após estabilidade)
16. **DES-01** — Datas String→DateTime (se aprovado: 8h+ — breaking change)

---

## 5. Riscos Específicos de DB

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|----------|
| Person full table scan em crescimento orgânico | 🔴 Alta | Performance degradada | IDX-01 imediatamente |
| Cross-tenant data leak por bug de aplicação | 🟡 Média | Crítico (dados de igrejas) | SEC-02 longo prazo |
| Falha de FK ao adicionar `Cell.leaderId` formal | 🟡 Média | Migration falha em prod | Verificar dados órfãos antes |
| ActivityLog overflow em 12 meses | 🟡 Média | Espaço em disco / lentidão | DB-NEW-02 antes do 6º mês |
| `financeGuard` abrindo em falha de DB | 🟢 Baixa (mas crítica se ocorrer) | Acesso financeiro indevido | SEC-01 imediatamente |

---

*Revisão concluída por @data-engineer — Brownfield Discovery Fase 5*
*Próximo: @ux-design-expert revisa seção Frontend/UX (Fase 6)*
