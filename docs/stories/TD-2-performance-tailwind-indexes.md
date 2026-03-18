# Story TD-2 — Performance: Tailwind Local + DB Indexes

**Epic:** EPIC-TD
**Sprint:** Sprint 1
**Esforço:** 10 horas
**Prioridade:** P0/P1
**Assignee:** @dev + @data-engineer
**Status:** Ready

---

## User Story

**Como** usuário do CRM em qualquer dispositivo,
**Quero** que a aplicação carregue rapidamente e que as listagens de membros respondam sem delay,
**Para** ter uma experiência fluida mesmo em conexões móveis ou igrejas com muitos membros.

---

## Contexto

**PERF-01:** O Tailwind CSS é carregado via CDN (~3MB não purgeado). Após migração para instalação local com Vite, o CSS purgeado será ~50KB — redução de 95%.

**IDX-01 a IDX-07:** A tabela `Person` (mais acessada do sistema) não tem nenhum índice além do PK. Todas as listagens, relatórios e telas de frequência fazem full table scan. Com crescimento orgânico isso degrada exponencialmente.

**Débitos cobertos:** PERF-01, PERF-02, PERF-03, MNT-02 (dark mode junto com PERF-01), IDX-01 a IDX-07

---

## Acceptance Criteria

### AC-1: Tailwind instalado localmente (PERF-01 + MNT-02)
- [ ] `npm install tailwindcss @tailwindcss/vite` executado no projeto raiz
- [ ] `vite.config.js` configurado com plugin `@tailwindcss/vite`
- [ ] `src/index.css` (ou equivalente) com `@import "tailwindcss"` e o token `--color-primary`
- [ ] Script CDN do Tailwind removido do `index.html`
- [ ] Dark mode refatorado: overrides `!important` substituídos por classes `dark:` do Tailwind
- [ ] Todas as 20 views completas testadas visualmente em light e dark mode
- [ ] Bundle CSS final < 150KB (verificar com `npm run build`)

### AC-2: Índices críticos no banco (IDX-01 a IDX-07)
- [ ] Migration Prisma criada com os seguintes índices:
  - `Person`: `@@index([organizationId])` e `@@index([cellId])`
  - `AttendanceRecord`: `@@index([personId])`
  - `Notification`: `@@index([organizationId, userId, read])`
  - `EbdStudent`: `@@index([ebdClassId])`
  - `Attendance`: `@@index([organizationId, date])`
  - `Event`: `@@index([organizationId, date])`
  - `PersonMilestone`: `@@index([personId])`
- [ ] Script SQL de rollback criado em `server/prisma/rollbacks/rollback_20260317_indexes.sql`
- [ ] Migration aplicada em dev e testada
- [ ] `npx prisma generate` executado

### AC-3: Lazy load de SheetJS e Chart.js (PERF-02, PERF-03)
- [ ] SheetJS removido do `index.html` (tag script global)
- [ ] Import dinâmico de SheetJS adicionado apenas em: `src/views/reports.js`, `src/views/ebd-reports.js`, e views financeiras de relatório
- [ ] Chart.js removido do `index.html` (tag script global)
- [ ] Import dinâmico de Chart.js adicionado apenas nas views que usam gráficos

---

## Notas de Implementação

**Migração Tailwind (ordem correta):**
```bash
npm install tailwindcss @tailwindcss/vite
```
```javascript
// vite.config.js
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [tailwindcss()],
  // ... restante da config
})
```
```css
/* src/index.css */
@import "tailwindcss";
:root { --color-primary: 19 91 236; }
```

**Atenção:** Verificar classes dinâmicas geradas via JS (ex: `bg-${color}-500`) — listá-las no `safelist` do CSS se necessário para evitar que o purge as remova.

**Índices via Prisma — exemplo:**
```prisma
model Person {
  // ...campos existentes...
  @@index([organizationId])
  @@index([cellId])
}
```

**Rollback script exemplo:**
```sql
-- rollback_20260317_indexes.sql
DROP INDEX IF EXISTS "Person_organizationId_idx";
DROP INDEX IF EXISTS "Person_cellId_idx";
-- ... demais índices
```

---

## Arquivos a Modificar

- `package.json` (raiz) — adicionar `tailwindcss`, `@tailwindcss/vite`
- `vite.config.js`
- `src/index.css` (criar se não existir)
- `index.html` — remover CDN scripts
- `server/prisma/schema.prisma` — adicionar `@@index`
- `server/prisma/rollbacks/rollback_20260317_indexes.sql` (criar)
- `src/views/reports.js`, `ebd-reports.js` — lazy import SheetJS

---

## Definition of Done

- [ ] `npm run build` passa sem erros
- [ ] CSS bundle < 150KB
- [ ] Dark mode funcionando em todas as 20 views testadas
- [ ] Migration aplicada em dev com `npx prisma migrate dev`
- [ ] Rollback script criado e testado
- [ ] Commit com mensagem: `perf: migrate Tailwind to local install, add DB indexes [TD-2]`
