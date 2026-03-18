# CRM Celular — Database Audit Report

**Data:** 2026-03-17
**Escopo:** Schema completo (Prisma/PostgreSQL)
**Autor:** @data-engineer (Brownfield Discovery — Fase 2)

---

## Resumo Executivo

| Categoria | Crítico 🔴 | Alto 🟠 | Médio 🟡 | Baixo 🟢 | Total |
|-----------|-----------|---------|---------|---------|-------|
| Índices | 0 | 3 | 4 | 2 | 9 |
| Segurança/Integridade | 1 | 3 | 4 | 1 | 9 |
| Design/Normalização | 0 | 2 | 5 | 2 | 9 |
| Operações | 0 | 1 | 3 | 2 | 6 |
| **TOTAL** | **1** | **9** | **16** | **7** | **33** |

---

## 1. Auditoria de Índices

### 🔴 Crítico

| ID | Tabela | Campo(s) Faltando | Impacto | Queries Afetadas |
|----|--------|-------------------|---------|-----------------|
| IDX-01 | `Person` | `organizationId`, `cellId` | Full table scan em toda listagem de membros | `GET /api/people`, dashboard, frequência, relatórios |

**Person é a tabela de maior acesso no sistema e não tem nenhum índice além do PK.**

### 🟠 Alto

| ID | Tabela | Campo(s) Faltando | Impacto | Queries Afetadas |
|----|--------|-------------------|---------|-----------------|
| IDX-02 | `AttendanceRecord` | `personId` (isolado) | Busca de frequência por pessoa sem índice | Histórico de frequência por membro |
| IDX-03 | `Notification` | `organizationId`, `userId`, `read` | Full scan ao carregar notificações | Bell icon — chamado a cada login |
| IDX-04 | `EbdStudent` | `ebdClassId` (isolado) | Listagem de alunos por classe sem índice | `GET /api/ebd/classes/:id/students` |

### 🟡 Médio

| ID | Tabela | Campo(s) Faltando | Impacto |
|----|--------|-------------------|---------|
| IDX-05 | `Attendance` | `date`, `organizationId` | Relatórios de frequência por período |
| IDX-06 | `Event` | `organizationId`, `date` | Calendário e lembretes diários |
| IDX-07 | `PersonMilestone` | `personId`, `organizationId` | Perfil do membro carrega devagar |
| IDX-08 | `EbdClass` | `organizationId` (isolado) | O @@unique([name, org]) não substitui índice simples |

### 🟢 Baixo

| ID | Tabela | Campo(s) Faltando | Impacto |
|----|--------|-------------------|---------|
| IDX-09 | `Form` | `organizationId` | Baixo volume |
| IDX-10 | `Webhook` | `organizationId` | Baixo volume |

### ✅ Bem Indexadas

| Tabela | Índices Presentes |
|--------|-------------------|
| `FinancialTransaction` | organizationId, accountId, date, type, amount |
| `Donation` | organizationId, personId, date, amount |
| `Bill` | organizationId, dueDate, status |
| `BillPayment` | billId |
| `DonationBatch` | organizationId |
| `FinancialAccount` | organizationId |
| `Fund` | organizationId |
| `ChartOfAccount` | organizationId |
| `User` | organizationId |
| `Cell` | leaderId, viceLeaderId, organizationId |
| `ActivityLog` | organizationId, userId |

---

## 2. Auditoria de Segurança e Integridade

### 🔴 Crítico

| ID | Item | Descrição | Risco |
|----|------|-----------|-------|
| SEC-01 | **financeGuard fail-open** | Se a query `prisma.organization.findUnique` falhar, o guard chama `next()` sem verificar `financialEnabled` | Se o banco tiver indisponibilidade momentânea, usuários sem permissão acessam o módulo financeiro |

**Arquivo:** `server/middleware/financeGuard.js` linha 25-27

```javascript
} catch (err) {
    console.error('[financeGuard] Erro ao verificar financialEnabled:', err.message);
}
next(); // ← FAIL-OPEN: deveria ser fail-closed (return 500)
```

### 🟠 Alto

| ID | Item | Descrição | Risco |
|----|------|-----------|-------|
| SEC-02 | **Multi-tenancy apenas na aplicação** | Isolamento de dados por `organizationId` é enforçado SOMENTE pelo código da aplicação. Nenhuma constraint no banco impede acesso cross-tenant | Bug em qualquer rota pode vazar dados entre orgs |
| SEC-03 | **Sem CHECK constraints em campos String críticos** | `User.role`, `Organization.status`, `Organization.plan`, `Bill.status`, `Donation.type` são Strings livres | Dados inválidos podem ser inseridos diretamente (via psql/migration) |
| SEC-04 | **Cell.leaderId/viceLeaderId sem FK formal** | Referências como String sem `@relation` — sem integridade referencial | Células com leaderId apontando para Person deletado |

### 🟡 Médio

| ID | Item | Descrição | Risco |
|----|------|-----------|-------|
| SEC-05 | **secondaryRoles como JSON String** | Sem validação de schema no banco — qualquer string pode ser inserida | Roles inválidos no banco, falha silenciosa no `hasSecondaryRole()` |
| SEC-06 | **Sem audit de login failures persistente** | `createLog` de `LOGIN_FAIL` cria `ActivityLog` mas sem índice em `action` | Difícil detectar ataques de força bruta por análise do banco |
| SEC-07 | **Soft-delete inconsistente** | Apenas `FinancialAccount`, `FinancialTransaction`, `Donation`, `Bill` têm `deletedAt`. Demais modelos são hard-deleted | Perda de dados históricos ao deletar Person, Cell, etc. |
| SEC-08 | **ApiKey.keyHash sem índice** | `@unique` cria índice ✅ mas `keyPrefix` sem índice — listagem sem filtro adequado | Baixo impacto, mas keyPrefix é exibido na UI |

### 🟢 Baixo

| ID | Item | Descrição |
|----|------|-----------|
| SEC-09 | **Sem COMMENT ON no banco** | Documentação apenas no schema.prisma — se acessado via psql diretamente, sem contexto |

---

## 3. Auditoria de Design e Normalização

### 🟠 Alto

| ID | Item | Descrição | Impacto |
|----|------|-----------|---------|
| DES-01 | **Datas como String ("YYYY-MM-DD") em 15+ campos** | `Attendance.date`, `Event.date`, `EbdAttendance.data`, `Donation.date`, `Bill.dueDate`, etc. | Range queries funcionam via string comparison ISO (ok para ISO 8601), mas impossibilita funções nativas de data (AGE(), EXTRACT(), etc.) |
| DES-02 | **6 campos JSON serializados como String** | `secondaryRoles`, `extraData`, `fields`, `customFields`, `data` (TriageQueue), `value` (SystemConfig) | Sem validação de schema, sem queries JSON eficientes, sem índices GIN |

### 🟡 Médio

| ID | Item | Descrição |
|----|------|-----------|
| DES-03 | **Cell.leaderId sem FK formal** | Referência implícita a Person.id sem `@relation` — Prisma não valida a integridade |
| DES-04 | **Person.status como String livre** | Valores: "Visitante", "Membro", "Consolidando", etc. — sem enum/CHECK constraint |
| DES-05 | **AttendanceRecord.status como String** | Valores: "presente", "ausente", "justificado" — sem constraint |
| DES-06 | **Consolidation sem `updatedAt`** | Único model sem timestamps completos |
| DES-07 | **PersonTrack sem `updatedAt`** | Registro de conclusão sem timestamp de atualização |

### 🟢 Baixo

| ID | Item | Descrição |
|----|------|-----------|
| DES-08 | **EbdOffering.valor como Float** | Único campo monetário como Float (todos os outros são Int/centavos). Risco de arredondamento |
| DES-09 | **Track.targetMetadata como String** | JSON serializado sem documentação do schema |

---

## 4. Auditoria de Operações e Migrations

### 🟠 Alto

| ID | Item | Descrição | Risco |
|----|------|-----------|-------|
| OPS-01 | **Zero rollback scripts** | Nenhuma das 13 migrations tem script de rollback documentado | Impossível reverter schema em produção de forma controlada |

### 🟡 Médio

| ID | Item | Descrição |
|----|------|-----------|
| OPS-02 | **Troca de provider SQLite↔PostgreSQL é manual** | Requer edição do `schema.prisma` + DATABASE_URL + `prisma generate`. Processo propenso a erro humano |
| OPS-03 | **Jobs agendados via setInterval** | `scheduleDailyEventReminder` e `scheduleBirthdayChecks` em `server/index.js` — sem cron real, sem persistência de estado de execução |
| OPS-04 | **Sem tabela de health/versão do schema** | Não há tabela `schema_version` ou similar — difícil saber versão exata em prod |

### 🟢 Baixo

| ID | Item | Descrição |
|----|------|-----------|
| OPS-05 | **Scripts avulsos na raiz de server/** | `check-*.js`, `debug-db.js`, `cleanup-*.js` — sem versionamento de uso |
| OPS-06 | **`migrate.log` commitado na raiz** | Arquivo de log no repositório |

---

## 5. Recomendações Prioritárias

### Prioridade Imediata (antes do próximo deploy)

```sql
-- IDX-01: Person indexes (CRÍTICO — maior impacto de performance)
CREATE INDEX idx_person_org ON "Person"("organizationId");
CREATE INDEX idx_person_cell ON "Person"("cellId");

-- IDX-03: Notification indexes (carregado a cada login)
CREATE INDEX idx_notification_org_user ON "Notification"("organizationId", "userId");
CREATE INDEX idx_notification_read ON "Notification"("read");

-- IDX-02: AttendanceRecord por pessoa
CREATE INDEX idx_attendance_record_person ON "AttendanceRecord"("personId");
```

### Prioridade Alta (próximo sprint)

```sql
-- IDX-04: EBD students por classe
CREATE INDEX idx_ebd_student_class ON "EbdStudent"("ebdClassId");

-- IDX-05: Attendance por data
CREATE INDEX idx_attendance_date ON "Attendance"("organizationId", "date");

-- IDX-06: Events por data
CREATE INDEX idx_event_org_date ON "Event"("organizationId", "date");
```

### Prioridade Média (backlog técnico)

1. **SEC-01:** Mudar `financeGuard` para fail-closed (retornar 500 em erro de DB)
2. **SEC-03:** Adicionar CHECK constraints para campos String críticos (`User.role`, `Organization.plan`, `Bill.status`)
3. **DES-01:** Avaliar migração de campos date String → `DateTime` (breaking change, requer migração de dados)
4. **DES-02:** Migrar campos JSON String → tipo `Json` do Prisma onde PostgreSQL suporta
5. **OPS-01:** Criar rollback scripts para migrations existentes

---

## 6. Inventário de Débitos para o Assessment Final

| ID | Débito | Área | Severidade | Esforço Estimado |
|----|--------|------|-----------|-----------------|
| IDX-01 | Índices faltando em Person | Performance | 🔴 Crítico | 1h |
| IDX-02 | Índice AttendanceRecord.personId | Performance | 🟠 Alto | 0.5h |
| IDX-03 | Índices Notification | Performance | 🟠 Alto | 0.5h |
| IDX-04 | Índice EbdStudent.ebdClassId | Performance | 🟠 Alto | 0.5h |
| IDX-05..08 | Índices médios | Performance | 🟡 Médio | 2h total |
| SEC-01 | financeGuard fail-open | Segurança | 🔴 Crítico | 0.5h |
| SEC-02 | Multi-tenancy só na app | Segurança | 🟠 Alto | 8h+ (RLS no PG) |
| SEC-03 | Sem CHECK constraints | Integridade | 🟠 Alto | 2h |
| SEC-04 | Cell.leaderId sem FK | Integridade | 🟠 Alto | 2h |
| SEC-07 | Soft-delete inconsistente | Dados | 🟡 Médio | 4h |
| DES-01 | Datas como String | Design | 🟠 Alto | 8h+ (breaking) |
| DES-02 | JSON como String | Design | 🟡 Médio | 4h |
| OPS-01 | Sem rollback scripts | Operações | 🟠 Alto | 3h |
| OPS-02 | Troca provider manual | Dev Exp | 🟡 Médio | 2h |

**Esforço total estimado:** ~40-50 horas (excluindo DES-01 que é breaking change maior)

---

*Documento gerado por @data-engineer em execução do Brownfield Discovery Workflow — Fase 2*
