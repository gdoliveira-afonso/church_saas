# Módulos do Sistema

## Módulos Ativáveis por Organização

| Flag na Organization  | Módulo      | Guard de rota            |
|-----------------------|-------------|--------------------------|
| `cellsEnabled`        | Células     | `cellsGuard`             |
| `ebdEnabled`          | EBD         | `ebdGuard`               |
| `financialEnabled`    | Financeiro  | `financeGuard`           |

Todos os toggles são configurados pelo ADMIN ou SUPERADMIN via `PUT /api/settings`.

---

## Módulo EBD (Escola Bíblica Dominical)

### Models

| Model                | Descrição                                                                 |
|----------------------|---------------------------------------------------------------------------|
| `EbdClass`           | Turma/classe. `professorId` e `segundoProfessorId` referenciam `User.id`  |
| `EbdStudent`         | Matrícula de um `Person` em uma `EbdClass`                                |
| `EbdAttendance`      | Registro de chamada por data (`YYYY-MM-DD`) para uma classe               |
| `EbdAttendanceRecord`| Presença individual: `presente (bool)` por aluno em uma `EbdAttendance`   |
| `EbdOffering`        | Oferta registrada por classe, data e valor                                |

### Endpoints `/api/ebd`

| Método | Rota                              | Descrição                                      |
|--------|-----------------------------------|------------------------------------------------|
| GET    | `/classes`                        | Lista classes da organização                   |
| POST   | `/classes`                        | Cria nova classe                               |
| GET    | `/classes/:id`                    | Detalhe de uma classe                          |
| PUT    | `/classes/:id`                    | Atualiza classe                                |
| DELETE | `/classes/:id`                    | Remove classe                                  |
| GET    | `/classes/:id/students`           | Lista alunos matriculados                      |
| POST   | `/classes/:id/students`           | Matricula pessoa na classe                     |
| DELETE | `/classes/:id/students/:sid`      | Remove matrícula                               |
| GET    | `/classes/:id/attendance`         | Histórico de chamadas da classe                |
| POST   | `/classes/:id/attendance`         | Registra chamada (cria/atualiza)               |
| GET    | `/attendance/all`                 | Todas as chamadas da organização               |
| GET    | `/classes/:id/offerings`          | Ofertas da classe                              |
| POST   | `/classes/:id/offerings`          | Registra oferta                                |
| GET    | `/offerings/all`                  | Todas as ofertas da organização                |
| GET    | `/person/:personId`               | Situação EBD de uma pessoa (matrícula, frequência) |
| GET    | `/reports/summary`                | Relatório consolidado por período              |
| DELETE | `/all-data`                       | Remove todos os dados EBD da organização       |

### Acesso por role

| Operação                        | Quem pode executar                                            |
|---------------------------------|---------------------------------------------------------------|
| CRUD classes, alunos, ofertas   | ADMIN, SUPERADMIN, SUPERINTENDENTE_EBD                        |
| Chamada (registrar/visualizar)  | ADMIN, SUPERVISOR, SUPERINTENDENTE_EBD, PROFESSOR da classe   |
| Relatórios                      | ADMIN, SUPERVISOR, SUPERINTENDENTE_EBD                        |
| Visualizar lista de classes     | Todos os roles com ebdEnabled                                 |

### Fluxo de chamada

1. Professor acessa a classe → aba "Chamada"
2. Sistema carrega `EbdAttendance` com `records` por data
3. Toggle de presença atualiza `EbdAttendanceRecord.presente`
4. Frontend usa event delegation para persistir via `POST /classes/:id/attendance`
5. Payload: `{ data: "YYYY-MM-DD", records: [{ ebdStudentId, presente }] }`

### Views

| Arquivo                       | Rota              | Descrição                                           |
|-------------------------------|-------------------|-----------------------------------------------------|
| `src/views/ebd.js`            | `/ebd`            | Lista de classes, matrícula rápida, botão relatórios |
| `src/views/ebd-class.js`      | `/ebd/class/:id`  | Detalhe: abas Alunos / Chamada / Ofertas             |
| `src/views/ebd-reports.js`    | `/ebd/reports`    | Relatórios com filtros e export Excel                |

---

## Módulo Financeiro

Status: backend completo (Fases 1 e 2), frontend pendente (Fase 3).

### Models

| Model                  | Descrição                                                                   |
|------------------------|-----------------------------------------------------------------------------|
| `FinancialAccount`     | Contas bancárias/caixas da organização                                       |
| `Fund`                 | Fundos customizáveis (ex: Missões, Obras, Dízimos)                           |
| `ChartOfAccount`       | Plano de contas hierárquico (pai/filho), com toggle ativo                    |
| `FinancialTransaction` | Ledger central: toda entrada/saída. Imutável se origem BILL ou DONATION.     |
| `Donation`             | Dízimo ou oferta vinculado a uma `Person` e `FinancialTransaction`           |
| `DonationBatch`        | Lote de doações (coleita de domingo, por exemplo)                            |
| `Bill`                 | Conta a pagar. Status calculado em JS: PENDENTE / PAGO / VENCIDO             |
| `BillPayment`          | Registro de pagamento de uma conta (cria `FinancialTransaction`)             |

### Endpoints `/api/finance`

| Grupo         | Rotas                                              |
|---------------|----------------------------------------------------|
| Contas        | CRUD `/accounts`, extrato com running balance      |
| Fundos        | CRUD `/funds`, toggle ativo, saldo por fundo       |
| Plano contas  | CRUD `/chart`, árvore pai/filho, toggle            |
| Transações    | GET/POST/DELETE `/transactions` (soft-delete)      |
| Doações       | GET/POST `/donations`, lotes `/donations/batches`  |
| Contas pagar  | GET/POST `/bills`, pagamento `/bills/:id/pay`      |
| Relatórios    | `/reports/dashboard`, `/reports/cashflow`, `/reports/dre`, `/reports/tithes-by-member`, `/reports/by-fund`, `/reports/summary` |

### Acesso

Requer `financialEnabled = true` na organização. Roles com acesso: ADMIN, SUPERVISOR, ou secondaryRole `AGENTE_FINANCEIRO`.

### Fluxo de pagamento de conta

1. `POST /bills/:id/pay` com `{ valor, data, accountId, description? }`
2. Backend cria `BillPayment` e `FinancialTransaction` em `prisma.$transaction`
3. Status da Bill atualizado para `PAGO`

### Fluxo de registro de doação

1. `POST /donations` com dados da pessoa, valor, fundo, data
2. Backend cria `Donation` e `FinancialTransaction` em `prisma.$transaction`
3. Saldo da conta e fundo são recalculados nas queries seguintes

### Seed financeiro

`server/lib/financeSeeds.js` — `seedFinance(orgId)` idempotente. Cria ao ativar o módulo:
- 1 conta bancária padrão
- 15 categorias no plano de contas
- 2 fundos padrão

---

## Módulo Células

Controlado pelo toggle `cellsEnabled`. Disponível para ADMIN, SUPERVISOR, LIDER_GERACAO e LEADER.

| Model           | Descrição                                                              |
|-----------------|------------------------------------------------------------------------|
| `Cell`          | Grupo com líder, vice, anfitrião, dia/hora de reunião e geração         |
| `Generation`    | Agrupamento organizacional de células                                   |
| `Attendance`    | Chamada de reunião de célula                                            |
| `AttendanceRecord` | Presença individual por reunião                                     |
| `CellCancellation` | Registro de reunião cancelada com justificativa                     |
| `CellJustification` | Justificativa de ausência de membro                               |

Endpoints: `/api/cells`, `/api/generations`, `/api/cells/:id/attendance`

---

## Módulo Pessoas

Disponível para todos os roles (escopo varia por role).

| Model             | Descrição                                                            |
|-------------------|----------------------------------------------------------------------|
| `Person`          | Membro. `userId` (opcional) vincula ao usuário do sistema.           |
| `PersonMilestone` | Marcos do percurso espiritual do membro                              |
| `PersonTrack`     | Participação em trilhas de desenvolvimento espiritual                |
| `PastoralNote`    | Notas pastorais privadas sobre um membro                             |
| `Visit`           | Registro de visitas pastorais                                        |
| `Consolidation`   | Fluxo de consolidação (onboarding de novos membros)                  |
| `Track`           | Trilha de discipulado/treinamento configurável                       |

Endpoints: `/api/people`, `/api/people/:id/milestones`, `/api/people/:id/tracks`

---

## Módulo Formulários e Triagem

| Model        | Descrição                                                              |
|--------------|------------------------------------------------------------------------|
| `Form`       | Formulário dinâmico com campos configuráveis                           |
| `TriageQueue`| Fila de submissões aguardando processamento                            |

Endpoints: `/api/forms`, `/api/triage`

---

## Módulo Eventos

| Model            | Descrição                                               |
|------------------|---------------------------------------------------------|
| `Event`          | Evento com suporte a recorrência                        |
| `EventException` | Exceção pontual em evento recorrente (cancelar/alterar) |

Endpoints: `/api/events`

---

## Integrações Externas

| Model        | Descrição                                                    |
|--------------|--------------------------------------------------------------|
| `ApiKey`     | Chaves de API hashadas para acesso externo (`/api/v1/`)      |
| `Webhook`    | Endpoints de webhook configurados pela organização           |
| `WebhookLog` | Log de disparos de webhook                                   |

---

## Auditoria

`ActivityLog` registra ações dos usuários automaticamente via `activityLoggerMiddleware`. Endpoints de consulta em `/api/logs` (leitura: qualquer autenticado; exclusão: apenas ADMIN/SUPERVISOR/SUPERADMIN).
