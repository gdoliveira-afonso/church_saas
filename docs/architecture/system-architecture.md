# CRM Celular — Brownfield Architecture Document

**Projeto:** CRM Celular — SaaS multi-tenant para gestão de membros de igrejas e células
**Data:** 2026-03-17
**Versão:** 1.0
**Autor:** @architect (Brownfield Discovery — Fase 1)

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-03-17 | 1.0 | Análise inicial brownfield | @architect |

---

## Introdução

Este documento captura o **ESTADO ATUAL** do codebase do CRM Celular, incluindo débitos técnicos, workarounds e padrões reais. Serve como referência para agentes IA que trabalhem em evoluções do sistema.

**Escopo:** Documentação abrangente de todo o sistema (nenhum PRD específico fornecido).

---

## Quick Reference — Arquivos e Entry Points Críticos

### Arquivos Críticos para Entender o Sistema

| Arquivo | Propósito |
|---------|-----------|
| `src/app.js` | Entry point do frontend — define todas as rotas SPA com guards |
| `src/router.js` | Roteador hash-based customizado |
| `src/store.js` | Estado global da aplicação (Store class) |
| `src/components/ui.js` | Utilitários de UI compartilhados (sidebar, toast, modais) |
| `server/index.js` | Entry point do backend — auth, middlewares, monta todos os routers |
| `server/prisma/schema.prisma` | Schema completo do banco de dados (fonte da verdade) |
| `server/lib/prisma.js` | Singleton do PrismaClient |
| `server/lib/planLimits.js` | Módulo central de limites por plano |
| `server/lib/financeAccess.js` | Helper de controle de acesso ao módulo financeiro |
| `server/middleware/activityLogger.js` | Audit trail de todas as operações |
| `vite.config.js` | Proxy `/api` → backend:3000 em dev |
| `docker-compose.yml` | Orquestração completa (postgres + backend + nginx/frontend) |

---

## High Level Architecture

### Technical Summary

Aplicação SaaS multi-tenant com modelo **monolítico** separado em frontend SPA e backend REST API. Multi-tenancy implementado por `organizationId` em cada entidade — sem schemas separados por tenant.

### Stack Tecnológica Real

| Categoria | Tecnologia | Versão | Observações |
|-----------|------------|--------|-------------|
| **Frontend Runtime** | Vanilla JavaScript | ES Modules | Sem framework (React/Vue/etc) |
| **Frontend Build** | Vite | ^7.3.1 | Bundler + dev server |
| **Frontend CSS** | Tailwind CSS | 4.x (CDN) | Carregado via CDN, não instalado |
| **Frontend Router** | Custom hash-based | — | `src/router.js` — implementação própria |
| **Frontend State** | Custom Store class | — | `src/store.js` — sem Redux/Zustand |
| **Backend Runtime** | Node.js | 18+ | CommonJS (`"type": "commonjs"`) |
| **Backend Framework** | Express.js | ^5.2.1 | Versão 5 (ainda beta) |
| **ORM** | Prisma | ^5.22.0 | Schema em `server/prisma/schema.prisma` |
| **Banco (dev)** | SQLite | — | Troca manual de provider no schema |
| **Banco (prod)** | PostgreSQL | 16 | Via Docker |
| **Autenticação** | JWT | jsonwebtoken ^9.0.3 | Bearer tokens, 24h exp, tokenVersion |
| **Hash de Senhas** | Bcrypt | ^6.0.0 | — |
| **PDF** | Puppeteer | ^24.38.0 | Geração de relatórios PDF |
| **Upload** | Multer | ^2.1.0 | Logos e imagens |
| **Segurança** | Helmet | ^8.0.0 | HTTP security headers |
| **Rate Limiting** | express-rate-limit | ^8.2.1 | 200 req/min/IP |
| **Deploy** | Docker + Nginx | — | 3 containers via docker-compose |
| **PWA** | Service Worker | — | `public/sw.js` |

### Tipo de Repositório

- **Tipo:** Monorepo parcial (frontend na raiz, backend em `server/`)
- **Package Manager:** npm
- **Frontend:** `package.json` raiz (Vite only, `"type": "module"`)
- **Backend:** `server/package.json` (CommonJS)

---

## Arquitetura Multi-Tenant

### Modelo de Tenant

Todos os dados são isolados por `organizationId`. Cada `Organization` é uma "igreja" independente no SaaS.

```
Organization (tenant)
├── Users (com roles RBAC)
├── People (membros)
├── Cells (grupos celulares)
├── Generations (agrupamentos de células)
├── Events
├── Forms + TriageQueue
├── Attendance + AttendanceRecord
├── Tracks (trilhas espirituais)
├── EBD Module (toggle: ebdEnabled)
└── Financial Module (toggle: financialEnabled)
```

### Resolução de Organização

**Prioridade no backend:**
1. `organizationId` do JWT token
2. Override por query/body (apenas SUPERADMIN)
3. Header `Host` → subdomain/custom domain lookup
4. Fallback: org `matriz`

### Planos

| Plano | Descrição |
|-------|-----------|
| `demo` | Limitações impostas via `planLimits.js` |
| `normal` | Acesso completo |

---

## Estrutura de Pastas (Real)

```
projeto-saas/
├── src/                          # Frontend (Vite SPA)
│   ├── app.js                    # Entry + todas as rotas + guards
│   ├── router.js                 # Hash-based SPA router
│   ├── store.js                  # Estado global (Store class)
│   ├── components/
│   │   └── ui.js                 # Sidebar, toast, modais, utilitários UI
│   └── views/                    # 29 views (uma por página/módulo)
│       ├── login.js
│       ├── dashboard.js
│       ├── people.js             # Lista + form de membros
│       ├── cells.js + cellDetail
│       ├── attendance.js
│       ├── reports.js
│       ├── settings.js + triageView
│       ├── calendar.js
│       ├── generations.js
│       ├── ebd.js                # Módulo EBD (lista de classes)
│       ├── ebd-class.js          # Detalhe da classe (alunos/chamada/ofertas)
│       ├── ebd-reports.js
│       ├── finance-dashboard.js  # Módulo Financeiro (em desenvolvimento)
│       ├── finance-accounts.js
│       ├── finance-transactions.js
│       ├── finance-donations.js
│       ├── finance-bills.js
│       ├── finance-funds.js
│       ├── finance-reports.js
│       ├── finance-bi.js
│       ├── finance-chart.js
│       ├── form-builder.js
│       ├── api-keys.js
│       ├── webhooks.js
│       ├── api-docs.js
│       ├── organizations.js      # Painel SUPERADMIN
│       ├── profile.js
│       └── public-form.js
│
├── server/                       # Backend (Express API)
│   ├── index.js                  # Entry point principal
│   ├── routes/                   # Routers REST
│   │   ├── users.js
│   │   ├── people.js
│   │   ├── cells.js
│   │   ├── events.js
│   │   ├── others.js             # Dashboard data, milestones, etc.
│   │   ├── forms.js
│   │   ├── generations.js
│   │   ├── settings.js
│   │   ├── reports.js
│   │   ├── logs.js
│   │   ├── admin.js
│   │   ├── organizations.js
│   │   ├── config.js
│   │   ├── ebd.js
│   │   └── finance/              # Módulo financeiro
│   │       ├── index.js          # Router base + hasFinanceAccess()
│   │       ├── accounts.js
│   │       ├── funds.js
│   │       ├── chart.js
│   │       ├── transactions.js
│   │       ├── donations.js
│   │       ├── bills.js
│   │       └── reports.js
│   ├── middleware/
│   │   ├── activityLogger.js     # Audit trail global
│   │   ├── cellsGuard.js         # Bloqueia se cellsEnabled=false
│   │   ├── ebdGuard.js           # Bloqueia se ebdEnabled=false
│   │   └── financeGuard.js       # Bloqueia se financialEnabled=false
│   ├── lib/
│   │   ├── prisma.js             # Singleton PrismaClient
│   │   ├── planLimits.js         # Limites por plano (central)
│   │   ├── financeAccess.js      # Controle de acesso financeiro
│   │   ├── financeSeeds.js       # Seed idempotente do módulo financeiro
│   │   └── reports.js            # Helpers de relatórios
│   ├── services/
│   │   ├── autoProvisioning.js   # Auto-provisionamento de orgs
│   │   ├── birthdayService.js    # Job de aniversariantes
│   │   └── pdfGenerator.js       # Geração de PDF via Puppeteer
│   ├── api/                      # API Pública v1 (autenticada por API Key)
│   │   └── routes/
│   │       ├── v1/index.js
│   │       ├── apiKeys.js
│   │       └── webhooks.js
│   ├── prisma/
│   │   ├── schema.prisma         # Schema completo (FONTE DA VERDADE)
│   │   └── migrations/           # Histórico de migrations
│   └── scripts/                  # Scripts utilitários (avulsos)
│
├── public/                       # Assets estáticos (sw.js, etc.)
├── index.html                    # Shell HTML do SPA
├── vite.config.js
├── docker-compose.yml
└── nginx.conf                    # Reverse proxy + static files
```

---

## Sistema RBAC

### Roles Primárias

| Role | Escopo | Acesso |
|------|--------|--------|
| `SUPERADMIN` | Global SaaS | Gerencia todas as organizações |
| `ADMIN` | Organização | Acesso completo à org |
| `SUPERVISOR` | Organização | Acesso amplo (quase ADMIN) |
| `LIDER_GERACAO` | Geração | Gerencia líderes da sua geração |
| `LEADER` | Célula | Gerencia sua célula |
| `VICE_LEADER` | Célula | Auxilia líder |
| `USER` | Módulo EBD | Acesso restrito ao EBD (professor/colaborador) |

### Roles Secundárias (JSON array em `User.secondaryRoles`)

| Role | Módulo | Permissão |
|------|--------|-----------|
| `PROFESSOR` | EBD | Professor de classe EBD |
| `SEGUNDO_PROFESSOR` | EBD | Segundo professor |
| `SUPERINTENDENTE_EBD` | EBD | Acesso admin completo ao EBD |
| `AGENTE_FINANCEIRO` | Financeiro | Acesso ao módulo financeiro |
| `GESTOR_FINANCEIRO` | Financeiro | Acesso ampliado ao módulo financeiro |

### Guards no Frontend (`src/app.js`)

```javascript
guard(fn)                          // Apenas autenticado
roleGuard(roles, fn)               // Role primária específica
cellModuleGuard(fn)                // cellsEnabled + autenticado
cellModuleRoleGuard(roles, fn)     // cellsEnabled + role
ebdAdminGuard(fn)                  // ADMIN/SUPERVISOR OU SUPERINTENDENTE_EBD
financeGuard(fn)                   // financialEnabled + ADMIN/SUPERADMIN OU AGENTE/GESTOR_FINANCEIRO
```

---

## Módulos do Sistema

### 1. Core — Membros e Células

| Módulo | Routes Backend | View Frontend |
|--------|----------------|---------------|
| Pessoas (membros) | `/api/people` | `people.js` |
| Células | `/api/cells` | `cells.js` |
| Gerações | `/api/generations` | `generations.js` |
| Frequência | `/api/cells` (attendance) | `attendance.js` |
| Dashboard | `/api/dash` | `dashboard.js` |
| Relatórios | `/api/reports` | `reports.js` |

### 2. Calendário e Eventos

- Routes: `/api/events`
- View: `calendar.js`
- Suporte a recorrência: `weekly`, `monthly-date`, `yearly`, `none`
- Exceções por data (`EventException`)

### 3. Formulários e Triagem

- Routes: `/api/forms`, `/api/public/triage`
- Views: `form-builder.js`, `settings.js` (triageView)
- Formulários públicos acessíveis sem login
- Fila de triagem para aprovação manual

### 4. Módulo EBD (toggle: `ebdEnabled`)

- Route: `/api/ebd`
- Views: `ebd.js`, `ebd-class.js`, `ebd-reports.js`
- Guard backend: `ebdGuard.js`
- Professores são `User` (não `Person`)
- SUPERINTENDENTE_EBD via secondaryRoles

### 5. Módulo Financeiro (toggle: `financialEnabled`) — EM DESENVOLVIMENTO

- Route: `/api/finance/*`
- **Backend (Fase 2): COMPLETO** — accounts, funds, chart, transactions, donations, bills, reports
- **Frontend (Fase 3): EM ANDAMENTO** — views sendo implementadas
- Guard backend: `financeGuard.js`
- Valores em centavos (inteiros)
- AGENTE_FINANCEIRO/GESTOR_FINANCEIRO via secondaryRoles

### 6. API Pública v1

- Route: `/api/v1`
- Autenticada por API Key (hashed no banco)
- Permissões: `read_membros`, `read_eventos`
- Webhooks com log de execução

### 7. Configurações por Organização

- Branding: logo, cor primária, nome da congregação
- Toggles de módulos: `cellsEnabled`, `ebdEnabled`, `financialEnabled`
- Campos customizados de célula
- Notificações configuráveis

---

## Fluxo de Autenticação

```
Login → POST /api/login
  → bcrypt.compare(password)
  → jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
  → Retorna: { token, user: { ...dados } }

Request autenticada:
  → Bearer token no header Authorization
  → authenticateToken() verifica JWT + tokenVersion no banco
  → resolveOrgContext() determina orgId
  → Middleware de rota (roleCheck inline)
```

**tokenVersion:** Incrementado ao alterar senha ou forçar logout. Invalida todos os tokens anteriores.

---

## Jobs Agendados (Servidor)

| Job | Frequência | Arquivo | Descrição |
|-----|-----------|---------|-----------|
| `scheduleDailyEventReminder` | 24h | `server/index.js` | Lembretes de eventos do dia seguinte |
| `scheduleBirthdayChecks` | 24h | `server/index.js` → `birthdayService.js` | Notificações de aniversariantes |

**ATENÇÃO:** Jobs rodam via `setInterval` simples — sem cron real, sem persistência de estado. Se o server reiniciar, o timer reseta.

---

## Deploy e Infraestrutura

### Docker Compose (Produção)

```
nginx (frontend:80/443)
  └── proxy /api → backend:3000

backend (Express:3000)
  └── depends_on: postgres (healthy)

postgres (PostgreSQL:16)
  └── Volume: crm_pg_data
```

### Volumes Persistentes

| Volume | Conteúdo |
|--------|---------|
| `crm_pg_data` | Dados PostgreSQL |
| `crm_uploads_data` | Logos e imagens das igrejas |
| `crm_ssl_data` | Certificados SSL |

### Env Variables Necessárias

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `JWT_SECRET` | ✅ SIM | Servidor recusa iniciar sem ela |
| `DATABASE_URL` | ✅ SIM | Connection string PostgreSQL |
| `SUPERADMIN_PASSWORD` | ⚠️ Recomendada | Se ausente, gera senha aleatória |
| `ALLOWED_ORIGINS` | Prod | CORS origins separados por vírgula |
| `SAAS_DOMAIN` | SaaS | Domínio base para subdomínios |
| `MATRIZ_NAME` | Opcional | Nome da org padrão |
| `MATRIZ_ADMIN_PASSWORD` | Recomendada | Se ausente, gera senha aleatória |

### Desenvolvimento Local

```bash
# Frontend
npm run dev        # Vite dev server (proxy /api → localhost:3000)

# Backend
cd server && node index.js

# SQLite (dev): trocar provider no schema.prisma + DATABASE_URL="file:./prisma/dev.db"
# Após alterar schema: npx prisma generate (com server PARADO)
```

---

## Integrações e Pontos Externos

| Serviço | Tipo | Arquivo | Observações |
|---------|------|---------|-------------|
| PostgreSQL | Database | Prisma ORM | Via DATABASE_URL |
| Puppeteer/Chrome | PDF | `services/pdfGenerator.js` | Headless browser |
| Multer | Upload | `server/index.js` | Files em `server/uploads/` |
| Service Worker | PWA | `public/sw.js` | Cache offline |
| Webhooks | Saída | `api/routes/webhooks.js` | Eventos para sistemas externos |

---

## Débitos Técnicos Identificados

### Sistema/Backend

| ID | Débito | Severidade | Observações |
|----|--------|-----------|-------------|
| SYS-01 | **Zero testes automatizados** — `server/package.json` tem `"test": "echo Error"` | 🔴 Alto | Risco em cada mudança |
| SYS-02 | **Jobs com setInterval** — sem cron real, sem persistência | 🟡 Médio | Timer reseta ao reiniciar |
| SYS-03 | **Scripts de debug na raiz do server** — `check-*.js`, `debug-db.js`, `cleanup-*.js` | 🟡 Médio | Poluição do repositório |
| SYS-04 | **Express 5 (beta)** — usado em produção | 🟡 Médio | Possíveis breaking changes |
| SYS-05 | **Datas como strings** — `date: String` em vários models | 🟡 Médio | Dificulta queries de range |
| SYS-06 | **JSON serializado como string** — `secondaryRoles`, `extraData`, `fields`, `customFields` | 🟡 Médio | Sem validação de schema, sem índice |
| SYS-07 | **Ausência de TypeScript** — frontend e backend em JS puro | 🟡 Médio | Sem type safety |
| SYS-08 | **Troca de provider SQLite/PG manual** — processo propenso a erro | 🟢 Baixo | Risco em dev |
| SYS-09 | **`tmp_test_db.js` na raiz** — arquivo temporário commitado | 🟢 Baixo | Limpeza |
| SYS-10 | **`migrate.log` na raiz** — log de migração commitado | 🟢 Baixo | Limpeza |

### Segurança

| ID | Débito | Severidade | Observações |
|----|--------|-----------|-------------|
| SEC-01 | **Sem 2FA/MFA** | 🟡 Médio | Apenas usuário/senha |
| SEC-02 | **JWT sem rotação de refresh token** — só 24h, sem renovação silenciosa | 🟡 Médio | UX: logout involuntário |
| SEC-03 | **Uploads sem validação de tipo real** — apenas Multer | 🟡 Médio | Risco de upload de arquivos maliciosos |
| SEC-04 | **Senhas geradas aleatoriamente sem log visível** — se env não definida | 🟡 Médio | Admin pode não saber a senha inicial |

### Frontend

| ID | Débito | Severidade | Observações |
|----|--------|-----------|-------------|
| FE-01 | **Tailwind via CDN** — não minificado, não purgeado em prod | 🟡 Médio | Bundle CSS gigante |
| FE-02 | **`package.json` com `name: "new-proj"`** — nome não atualizado | 🟢 Baixo | Cosmético |
| FE-03 | **Sem code splitting** — todo código bundlado junto | 🟡 Médio | Tempo de carga inicial |
| FE-04 | **Testes de UI ausentes** — zero testes de frontend | 🔴 Alto | Junto com SYS-01 |
| FE-05 | **Módulo Financeiro incompleto** — Fase 3 (views) pendente | 🔴 Alto | Funcionalidade não entregue |

### Database

| ID | Débito | Severidade | Observações |
|----|--------|-----------|-------------|
| DB-01 | **AttendanceRecord sem índice em personId** | 🟡 Médio | Queries de frequência por pessoa |
| DB-02 | **Person sem índice em cellId, organizationId** | 🟡 Médio | Listagem por célula |
| DB-03 | **Notifications sem índice em organizationId** | 🟡 Médio | Listagem de notificações |
| DB-04 | **Soft-delete inconsistente** — `deletedAt` apenas em FinancialAccount, FinancialTransaction, Donation, Bill | 🟡 Médio | Outras entidades são hard-deleted |

---

## Workarounds e Gotchas

1. **Prisma generate deve rodar com server PARADO** — em Windows, o processo Node.js bloqueia o arquivo `.db` (SQLite DLL lock)

2. **Tailwind 4 via CDN** — não usar `@apply` em CSS customizado; classes inline no HTML apenas

3. **Frontend `type: "module"` vs Backend `type: "commonjs"`** — são dois ambientes Node diferentes; imports do frontend usam `import/export`, backend usa `require()`

4. **EBD: Professores são Users, não Persons** — selects de professor usam `store.users` com User IDs, não `store.people`

5. **Valores financeiros em centavos** — `amount: Int` sempre positivo, em centavos. Nunca float.

6. **Organization resolve pelo Host header** — em dev local retorna `null` (não força org); em prod usa subdomain/custom domain

7. **tokenVersion invalidation** — ao alterar senha de um usuário, incrementar `tokenVersion` para invalidar tokens anteriores

8. **financeGuard inclui GESTOR_FINANCEIRO** — secondaryRole adicional ao AGENTE_FINANCEIRO, com permissões ampliadas (a definir)

---

## Padrões de Código

### Backend — Padrão de Rota

```javascript
router.get('/', authenticateToken?, async (req, res) => {
  try {
    const orgId = req.orgId; // sempre disponível após resolveOrgContext
    const data = await prisma.model.findMany({ where: { organizationId: orgId } });
    res.json(data);
  } catch (err) {
    console.error('[Route Error]:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});
```

### Frontend — Padrão de View

```javascript
export async function myView(params) {
  document.getElementById('app').innerHTML = `<div>...</div>`;
  // Lê do store: store.people, store.cells, store.users, etc.
  // API calls: fetch('/api/...', { headers: { Authorization: `Bearer ${store.token}` } })
}
```

### Frontend — Acesso ao Store

```javascript
store.isLoggedIn()                    // verifica token
store.hasRole('ADMIN', 'SUPERVISOR')  // role primária
store.hasSecondaryRole('PROFESSOR')   // secondaryRoles JSON
store.people / store.cells / store.users / store.systemSettings
store.ebdClasses / store.ebdAttendance / store.ebdOfferings
store.financeAccounts / store.financeFunds / store.financeChartOfAccounts
```

---

## Testing Reality

| Tipo | Cobertura | Ferramenta |
|------|-----------|-----------|
| Unit Tests | ❌ 0% | Nenhuma |
| Integration Tests | ❌ 0% | Nenhuma |
| E2E Tests | ❌ 0% | Nenhuma |
| Manual Testing | ✅ Principal método | — |

**Risco:** Qualquer mudança no backend ou frontend não tem cobertura automática. Regressões são detectadas apenas via teste manual.

---

## Estado Atual (2026-03-17)

### Módulos Completos ✅
- Core (membros, células, gerações, frequência)
- Eventos e calendário
- Formulários e triagem
- Relatórios
- Configurações por organização
- EBD completo (classes, chamada, ofertas, relatórios)
- API Pública v1 + Webhooks
- PWA (Service Worker)
- **Módulo Financeiro — Backend (Fase 2)**

### Em Desenvolvimento 🔄
- **Módulo Financeiro — Frontend (Fase 3)** — 9 views a finalizar

### Débitos Prioritários 📋
1. Implementar suite de testes (jest + supertest no backend)
2. Trocar Tailwind CDN por instalação local (purge em prod)
3. Adicionar índices de banco faltantes (DB-01, DB-02, DB-03)
4. Completar Módulo Financeiro — Fase 3
5. Limpar scripts de debug da raiz do server

---

*Documento gerado por @architect em execução do Brownfield Discovery Workflow — Fase 1*
