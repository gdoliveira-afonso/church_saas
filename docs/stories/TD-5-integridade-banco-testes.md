# Story TD-5 — Integridade do Banco + Testes de Integração

**Epic:** EPIC-TD
**Sprint:** Sprint 3
**Esforço:** 28 horas
**Prioridade:** P1
**Assignee:** @dev + @data-engineer
**Status:** Ready

---

## User Story

**Como** desenvolvedor do CRM,
**Quero** que o banco de dados tenha constraints de integridade e que rotas críticas tenham testes automatizados,
**Para** que bugs de regressão sejam detectados antes de chegar em produção.

---

## Contexto

SYS-01 (zero testes) é o maior risco sistêmico identificado: sem cobertura mínima, qualquer correção de débito pode introduzir regressão. Esta story foca em testes de integração para as rotas mais críticas, não em cobertura completa.

Complementar: adicionar `organizationId` em `AttendanceRecord` e CHECK constraints no schema.

**Débitos cobertos:** SYS-01, SEC-03, SEC-04, DB-NEW-01, DES-04

---

## Acceptance Criteria

### AC-1: Setup de testes (SYS-01 — fundação)
- [ ] `vitest` instalado como devDependency no `server/package.json`
- [ ] `server/package.json` — `"test": "vitest run"` e `"test:watch": "vitest"`
- [ ] Arquivo de setup `server/tests/setup.js` com conexão a banco de teste (SQLite in-memory)
- [ ] Helper `server/tests/helpers/auth.js` que gera JWT de teste para diferentes roles

### AC-2: Testes de autenticação e multi-tenancy
- [ ] `server/tests/auth.test.js`:
  - Rota `/api/auth/login` com credenciais válidas → retorna token
  - Rota `/api/auth/login` com credenciais inválidas → retorna 401
  - Token expirado → retorna 401
  - Token de org A não acessa dados da org B (teste cross-tenant)

### AC-3: Testes do financeGuard (SEC-01 — regressão)
- [ ] `server/tests/financeGuard.test.js`:
  - `financialEnabled = false` → retorna 403
  - `financialEnabled = true` + sem role financeiro → retorna 403
  - `financialEnabled = true` + AGENTE_FINANCEIRO → acesso permitido
  - Simular falha de DB → retorna 503 (não 200)

### AC-4: CHECK constraints no schema (SEC-03, DES-04)
- [ ] Migration adicionando CHECK constraints para:
  - `User.role` — valores: `ADMIN, SUPERVISOR, LIDER_GERACAO, LEADER, VICE_LEADER, USER, SUPERADMIN`
  - `Organization.status` — valores: `active, suspended`
  - `Organization.plan` — valores: `demo, normal`
  - `Bill.status` — valores: `PENDENTE, PAGO, CANCELADO`
  - `Person.status` — valores definidos (Visitante, Membro, Consolidando, Inativo)
- [ ] Rollback script em `server/prisma/rollbacks/`

### AC-5: FK formal para Cell.leaderId (SEC-04)
- [ ] Verificar dados órfãos antes: query que lista `leaderId` valores que não existem em `Person.id`
- [ ] Se houver órfãos: limpá-los (set null) em migration
- [ ] Migration adicionando `@relation` formal entre `Cell.leaderId` e `Person.id`
- [ ] Rollback script criado

### AC-6: organizationId em AttendanceRecord (DB-NEW-01)
- [ ] Migration adicionando campo `organizationId String` em `AttendanceRecord`
- [ ] Migration preenche o campo via JOIN com `Attendance` para dados existentes:
  ```sql
  UPDATE "AttendanceRecord" ar
  SET "organizationId" = a."organizationId"
  FROM "Attendance" a WHERE ar."attendanceId" = a.id;
  ```
- [ ] `@@index([organizationId])` adicionado
- [ ] Rotas que consultam `AttendanceRecord` atualizadas para incluir `organizationId` nos filtros
- [ ] Rollback script criado

---

## Arquivos a Criar/Modificar

**Criar:**
- `server/tests/setup.js`
- `server/tests/helpers/auth.js`
- `server/tests/auth.test.js`
- `server/tests/financeGuard.test.js`
- `server/prisma/rollbacks/rollback_20260317_constraints.sql`
- `server/prisma/rollbacks/rollback_20260317_attendance_orgid.sql`

**Modificar:**
- `server/package.json` — adicionar vitest
- `server/prisma/schema.prisma` — CHECK constraints + FK + AttendanceRecord.organizationId
- `server/routes/attendance.js` (ou equivalente) — adicionar filtro por organizationId

---

## Definition of Done

- [ ] `npm test` passa sem erros no `server/`
- [ ] Pelo menos 8 testes passando (auth × 4 + financeGuard × 4)
- [ ] Migration aplicada sem erros em dev
- [ ] Rollback scripts testados
- [ ] Commit: `test: add integration tests for auth and financeGuard; add DB constraints [TD-5]`
