# CRM Celular — Database Schema Reference

**Banco:** PostgreSQL 16 (prod) / SQLite (dev)
**ORM:** Prisma 5.22.0
**Schema:** `server/prisma/schema.prisma`
**Data:** 2026-03-17
**Autor:** @data-engineer (Brownfield Discovery — Fase 2)

---

## Sumário de Modelos

| # | Model | Registros Estimados | Propósito |
|---|-------|---------------------|-----------|
| 1 | Organization | Baixo (1-1000) | Tenant root — cada igreja é uma org |
| 2 | User | Médio (5-500/org) | Usuários do sistema com RBAC |
| 3 | Person | Alto (100-10.000/org) | Membros da igreja |
| 4 | Cell | Médio (5-200/org) | Grupos celulares |
| 5 | Generation | Baixo (2-20/org) | Agrupamentos de células |
| 6 | Attendance | Alto (semanal/célula) | Reuniões registradas |
| 7 | AttendanceRecord | Muito Alto | Presença individual por reunião |
| 8 | Event | Médio | Calendário da igreja |
| 9 | EventException | Baixo | Exceções de eventos recorrentes |
| 10 | CellCancellation | Baixo | Cancelamentos de reuniões |
| 11 | CellJustification | Baixo | Justificativas de ausência |
| 12 | Consolidation | Médio (1:1 com Person novo) | Fluxo de integração de novos membros |
| 13 | PersonMilestone | Médio | Marcos espirituais do membro |
| 14 | PastoralNote | Médio | Notas pastorais por pessoa |
| 15 | Visit | Médio | Visitas registradas |
| 16 | Track | Baixo (4+ padrão) | Trilhas espirituais |
| 17 | PersonTrack | Médio | Conclusão de trilhas por pessoa |
| 18 | Form | Baixo (1-20/org) | Formulários customizáveis |
| 19 | TriageQueue | Médio | Fila de triagem de formulários |
| 20 | Notification | Alto | Notificações internas |
| 21 | SystemConfig | Baixo (2 padrão/org) | Configurações chave-valor por org |
| 22 | ApiKey | Baixo | Chaves de API externas |
| 23 | Webhook | Baixo | Webhooks de saída |
| 24 | WebhookLog | Médio | Log de execução de webhooks |
| 25 | ActivityLog | Muito Alto | Audit trail de todas as operações |
| 26 | EbdClass | Baixo-Médio | Classes da Escola Bíblica |
| 27 | EbdStudent | Médio | Matrículas EBD |
| 28 | EbdAttendance | Médio | Chamadas EBD por classe |
| 29 | EbdAttendanceRecord | Alto | Presença individual EBD |
| 30 | EbdOffering | Médio | Ofertas por classe EBD |
| 31 | FinancialAccount | Baixo (1-10/org) | Contas bancárias/caixas |
| 32 | Fund | Baixo (2-20/org) | Fundos customizáveis |
| 33 | ChartOfAccount | Baixo (15+ padrão) | Plano de contas hierárquico |
| 34 | FinancialTransaction | Alto | Ledger central (imutável por soft-delete) |
| 35 | Donation | Alto | Dízimos e ofertas |
| 36 | DonationBatch | Médio | Lotes de doações |
| 37 | Bill | Médio | Contas a pagar |
| 38 | BillPayment | Médio | Pagamentos de contas |

---

## Relacionamentos Principais

```
Organization (1)─────────────────────────────────────────(N) [todos os modelos abaixo]
│
├── User (N) ←──────────── Person (1:1, opcional via userId)
│   └── secondaryRoles: JSON[]  ← PROFESSOR, SUPERINTENDENTE_EBD, AGENTE_FINANCEIRO, etc.
│
├── Cell (N) ←──────── Person.cellId (célula de participação)
│   └── Attendance (N) → AttendanceRecord (N) → Person
│
├── Generation (N) ←─── Cell.generationId, User.generationId
│
├── Person (N)
│   ├── Consolidation (1:1)
│   ├── PersonMilestone (N)
│   ├── PersonTrack (N) → Track
│   ├── PastoralNote (N)
│   ├── Visit (N)
│   ├── EbdStudent (N) → EbdClass
│   └── Donation (N)
│
├── EbdClass (N)
│   ├── professor/segundoProfessor/terceiroProfessor → User
│   ├── EbdStudent (N)
│   ├── EbdAttendance (N) → EbdAttendanceRecord (N) → EbdStudent
│   └── EbdOffering (N)
│
├── FinancialAccount (N) ← FinancialTransaction
├── Fund (N) ← FinancialTransaction, Donation
├── ChartOfAccount (N, hierárquico pai/filho) ← FinancialTransaction, Bill
├── DonationBatch (N) ← Donation (N)
└── Bill (N) → BillPayment (N) → [cria FinancialTransaction]
```

---

## Schema Detalhado por Módulo

### Core — Organization

```prisma
model Organization {
  id                  String   @id @default(cuid())
  name                String
  slug                String   @unique          // ex: 'batista-central'
  subdomain           String?  @unique          // ex: 'central.meusaas.com'
  customDomain        String?  @unique          // ex: 'igrejacentral.org.br'
  status              String   @default("active")   // active | suspended
  plan                String   @default("demo")     // demo | normal
  cellsEnabled        Boolean  @default(true)
  ebdEnabled          Boolean  @default(false)
  financialEnabled    Boolean  @default(false)
  // Branding
  logoUrl             String?
  primaryColor        String   @default("#0f172a")
  loginMessage        String?
  congregationName    String?
  congregationAddress String?
  pastorName          String?
  nucleus             String?
  createdAt / updatedAt
}
```

**Notas:**
- `status` e `plan` são Strings sem CHECK constraint — valores válidos enforçados só na aplicação
- `nucleus` sem documentação de uso

---

### Core — User

```prisma
model User {
  id             String   @id @default(cuid())
  name           String
  username       String   @unique
  password       String                    // bcrypt hash
  role           String   @default("USER") // ADMIN|SUPERVISOR|LIDER_GERACAO|LEADER|VICE_LEADER|USER|SUPERADMIN
  secondaryRoles String?                   // ⚠️ JSON array serializado como String
  avatar         String?
  generationId   String?
  organizationId String?                   // ⚠️ nullable — SUPERADMIN não tem org
  tokenVersion   Int      @default(0)      // invalidação de tokens
  @@index([organizationId])
}
```

**Notas:**
- `secondaryRoles` como String (JSON) — sem validação de schema no DB
- `role` como String — sem CHECK constraint de valores válidos
- SUPERADMIN tem `organizationId = null`

---

### Core — Person

```prisma
model Person {
  id               String   @id @default(cuid())
  name             String
  phone / email / birthdate / address  String?
  status           String   @default("Visitante")  // Visitante|Membro|etc.
  howKnown / previousCell / returnReason / prayerRequest  String?
  cellId           String?                          // célula de participação
  userId           String?  @unique                 // link para User (líderes)
  organizationId   String
  extraData        String?                          // ⚠️ JSON serializado como String
  // ⚠️ NENHUM índice em organizationId ou cellId!
}
```

**⚠️ Débito crítico:** Person é a tabela mais consultada e não tem índice em `organizationId` nem `cellId`.

---

### Módulo Celular — Cell + Attendance

```prisma
model Cell {
  id             String   // líder/vice/host referenciados como String (sem FK para Person/User)
  leaderId       String?  // ⚠️ String sem FK — não é Person.id nem User.id explicitamente
  viceLeaderId   String?  // ⚠️ idem
  hostId         String?  // ⚠️ idem — pode ser Person.id
  meetingDay / meetingTime  String?
  status         String   @default("ativa")
  generationId / organizationId  String
  @@index([leaderId, viceLeaderId, organizationId])
}

model Attendance {
  id / cellId / organizationId / date (String) / notes / customFields (JSON String)
  @@unique([cellId, date])           // ⚠️ sem índice em organizationId ou date isolado
}

model AttendanceRecord {
  id / attendanceId / personId / status (String)
  @@unique([attendanceId, personId]) // implicitly indexed by Prisma
  // ⚠️ sem índice em personId isolado
}
```

**Notas:**
- `Cell.leaderId/viceLeaderId/hostId` são Strings sem FK formal — referência implícita a Person.id
- `Attendance.date` como String "YYYY-MM-DD" — funciona para comparação lexicográfica ISO
- `AttendanceRecord.status` como String — valores: "presente", "ausente", "justificado"

---

### Módulo EBD

```prisma
model EbdClass {
  professorId / segundoProfessorId / terceiroProfessorId → User (FK formal via @relation)
  ativo Boolean @default(true)
  @@unique([name, organizationId])  // ⚠️ sem índice simples em organizationId
}

model EbdStudent {
  personId → Person (FK com onDelete: Cascade)
  ebdClassId → EbdClass (FK com onDelete: Cascade)
  ativo Boolean @default(true)
  @@unique([personId, ebdClassId])  // ⚠️ sem índice em ebdClassId isolado
}

model EbdAttendance {
  data String  // "YYYY-MM-DD"
  professorPresente / professorJustificado / etc. Boolean
  @@unique([ebdClassId, data])
}

model EbdAttendanceRecord {
  presente Boolean @default(false)
  justificado Boolean @default(false)
  @@unique([ebdAttendanceId, ebdStudentId])
}
```

---

### Módulo Financeiro

```prisma
model FinancialTransaction {
  amount          Int           // centavos, sempre positivo
  type            String        // RECEITA | DESPESA
  date            String        // "YYYY-MM-DD"
  referenceType   String?       // "BILL" | "DONATION" | "MANUAL"
  deletedAt       DateTime?     // soft-delete
  @@index([organizationId, accountId, date, type, amount])  // bem indexado ✅
}

model Donation {
  type    String  // DIZIMO | OFERTA | OFERTA_ESPECIAL | PRIMICIA | OUTRO
  amount  Int     // centavos
  deletedAt DateTime?   // soft-delete
  @@index([organizationId, personId, date, amount])  // bem indexado ✅
}

model Bill {
  status    String  // PENDENTE | PAGO | CANCELADO
  recurrence String?  // NONE | MONTHLY | YEARLY
  @@index([organizationId, dueDate, status])  // bem indexado ✅
}
```

**Nota positiva:** O módulo financeiro tem a indexação mais completa de todo o schema.

---

## Histórico de Migrations

| Migration | Data | Descrição |
|-----------|------|-----------|
| `20260304020425` | 2026-03-04 | add_system_config |
| `20260304135702` | 2026-03-04 | add_cell_custom_fields |
| `20260304213048` | 2026-03-04 | add_person_milestones |
| `20260310210941` | 2026-03-10 | **init_saas** — conversão para multi-tenant |
| `20260310212139` | 2026-03-10 | add_custom_domain |
| `20260310223757` | 2026-03-10 | add_org_id_to_missing_models |
| `20260310223921` | 2026-03-10 | finalize_saas_schema_fields |
| `20260310224051` | 2026-03-10 | add_org_id_to_triage_queue |
| `20260311123643` | 2026-03-11 | normalize_plan_values |
| `20260311134335` | 2026-03-11 | add_module_flags_and_secondary_roles |
| `20260311135228` | 2026-03-11 | add_ebd_module_tables |
| `20260311200000` | 2026-03-11 | fix_ebd_class_professor_and_remove_superintendent |
| `20260315190329` | 2026-03-15 | add_visitor_name_to_donation |

**Observações:**
- 13 migrations em ~11 dias — projeto em desenvolvimento ativo
- Sem rollback scripts para nenhuma migration
- Naming descritivo ✅
- Uso de `migration_lock.toml` (Prisma padrão) ✅

---

## Campos JSON Serializados como String

| Tabela | Campo | Conteúdo | Risco |
|--------|-------|---------|-------|
| User | secondaryRoles | `["PROFESSOR","SUPERINTENDENTE_EBD"]` | Sem validação no DB |
| Person | extraData | JSON livre | Sem schema |
| Attendance | customFields | JSON livre (campos customizados) | Sem schema |
| Form | fields | Array de definições de campos | Crítico — parser na app |
| TriageQueue | data | Dados submetidos pelo formulário | Sem validação |
| SystemConfig | value | JSON genérico | Sem schema |

---

*Documento gerado por @data-engineer em execução do Brownfield Discovery Workflow — Fase 2*
