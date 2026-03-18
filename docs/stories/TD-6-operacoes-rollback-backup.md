# Story TD-6 — Operações: Rollback + Backup + Observabilidade

**Epic:** EPIC-TD
**Sprint:** Sprint 3
**Esforço:** 10 horas
**Prioridade:** P1
**Assignee:** @dev + @data-engineer
**Status:** Ready

---

## User Story

**Como** operador do sistema em produção,
**Quero** ter scripts de rollback para migrations, backups automáticos e alertas de falhas,
**Para** poder responder a incidentes com confiança e sem perda de dados.

---

## Contexto

O sistema não tem nenhum dos três pilares de operações seguras: rollback de schema, backup documentado, ou monitoramento de jobs. Com dados sensíveis de múltiplas igrejas, isso é risco operacional.

**Débitos cobertos:** OPS-01, OPS-NEW-01, OPS-NEW-02, SYS-02 (parcial), SYS-04

---

## Acceptance Criteria

### AC-1: Rollback scripts retroativos (OPS-01)
- [ ] Snapshot do schema atual: `pg_dump $DATABASE_URL --schema-only > server/prisma/rollbacks/schema-snapshot-20260317.sql`
- [ ] Rollback script para as 3 migrations mais recentes:
  - `rollback_20260315_add_visitor_name_to_donation.sql`
  - `rollback_20260311_fix_ebd_class_professor.sql`
  - `rollback_20260311_add_ebd_module_tables.sql`
- [ ] `server/prisma/rollbacks/README.md` documentando o processo obrigatório para PRs futuros com migration

### AC-2: Processo obrigatório para novas migrations
- [ ] Template em `server/prisma/rollbacks/TEMPLATE.sql` com instruções
- [ ] `CONTRIBUTING.md` atualizado (ou criado) com seção "Database Migrations" exigindo rollback script em todo PR que inclua migration Prisma

### AC-3: Health endpoint documentado (OPS-NEW-01)
- [ ] Verificar se `/api/health` existe em `server/index.js` ou routes
- [ ] Se não existir: criar endpoint GET `/api/health` que retorna `{ status: "ok", timestamp, dbConnected: bool }`
- [ ] `docker-compose.yml` atualizado para usar `/api/health` no healthcheck do backend

### AC-4: Log de falhas de jobs agendados (OPS-NEW-01)
- [ ] `server/index.js` — jobs `scheduleDailyEventReminder` e `scheduleBirthdayChecks` envolvidos em try/catch com `console.error` estruturado
- [ ] Adicionar `ActivityLog` entry quando job falha (action: `JOB_FAILURE`, data: `{ job, error }`)

### AC-5: Estratégia de backup documentada (OPS-NEW-02)
- [ ] `docs/operations/BACKUP.md` criado com:
  - Comando de backup manual: `pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql`
  - Procedimento de restore: `psql $DATABASE_URL < backup_YYYYMMDD.sql`
  - Frequência recomendada: diária em produção
  - Local de armazenamento recomendado (ex: volume Docker externo ou S3)
  - Checklist de teste de restore (a ser executado mensalmente)

### AC-6: Pinagem de versão do Express (SYS-04)
- [ ] `server/package.json` — alterar `"express": "^5.2.1"` para `"express": "5.2.1"` (sem `^`)
- [ ] Comentário no `package.json` explicando o motivo: `// Pinned: Express 5 still in beta - avoid auto-upgrade`

---

## Arquivos a Criar/Modificar

**Criar:**
- `server/prisma/rollbacks/schema-snapshot-20260317.sql`
- `server/prisma/rollbacks/rollback_20260315_add_visitor_name_to_donation.sql`
- `server/prisma/rollbacks/rollback_20260311_fix_ebd_class_professor.sql`
- `server/prisma/rollbacks/rollback_20260311_add_ebd_module_tables.sql`
- `server/prisma/rollbacks/TEMPLATE.sql`
- `server/prisma/rollbacks/README.md`
- `docs/operations/BACKUP.md`

**Modificar:**
- `server/index.js` — health endpoint (se não existir) + try/catch nos jobs
- `docker-compose.yml` — healthcheck
- `server/package.json` — pinagem do Express

---

## Definition of Done

- [ ] `GET /api/health` retorna 200 com `dbConnected: true` em dev
- [ ] 3 rollback scripts criados e documentados
- [ ] `BACKUP.md` com instruções completas de backup e restore
- [ ] Express version pinada no package.json
- [ ] Commit: `ops: add rollback scripts, health endpoint, backup docs, pin Express version [TD-6]`
