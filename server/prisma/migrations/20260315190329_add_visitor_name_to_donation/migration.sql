-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CAIXA',
    "bank" TEXT,
    "agency" TEXT,
    "accountNumber" TEXT,
    "initialBalance" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "FinancialAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT 'blue',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartOfAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "chartAccountId" TEXT,
    "fundId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "competenceDate" TEXT,
    "paymentMethod" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT,
    "batchId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DIZIMO',
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "fundId" TEXT,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "visitorName" TEXT,
    "transactionId" TEXT,
    "registeredById" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Donation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Donation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Donation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DonationBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Donation_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Donation_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DonationBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DonationBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "chartAccountId" TEXT,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "amount" INTEGER NOT NULL,
    "dueDate" TEXT NOT NULL,
    "competenceDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "recurrence" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "accountId" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillPayment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EbdAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ebdClassId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "notes" TEXT,
    "professorPresente" BOOLEAN NOT NULL DEFAULT false,
    "professorJustificado" BOOLEAN NOT NULL DEFAULT false,
    "segundoProfessorPresente" BOOLEAN NOT NULL DEFAULT false,
    "segundoProfessorJustificado" BOOLEAN NOT NULL DEFAULT false,
    "terceiroProfessorPresente" BOOLEAN NOT NULL DEFAULT false,
    "terceiroProfessorJustificado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EbdAttendance_ebdClassId_fkey" FOREIGN KEY ("ebdClassId") REFERENCES "EbdClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EbdAttendance" ("createdAt", "data", "ebdClassId", "id", "notes") SELECT "createdAt", "data", "ebdClassId", "id", "notes" FROM "EbdAttendance";
DROP TABLE "EbdAttendance";
ALTER TABLE "new_EbdAttendance" RENAME TO "EbdAttendance";
CREATE UNIQUE INDEX "EbdAttendance_ebdClassId_data_key" ON "EbdAttendance"("ebdClassId", "data");
CREATE TABLE "new_EbdAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ebdAttendanceId" TEXT NOT NULL,
    "ebdStudentId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "justificado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EbdAttendanceRecord_ebdAttendanceId_fkey" FOREIGN KEY ("ebdAttendanceId") REFERENCES "EbdAttendance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EbdAttendanceRecord_ebdStudentId_fkey" FOREIGN KEY ("ebdStudentId") REFERENCES "EbdStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EbdAttendanceRecord" ("ebdAttendanceId", "ebdStudentId", "id", "presente") SELECT "ebdAttendanceId", "ebdStudentId", "id", "presente" FROM "EbdAttendanceRecord";
DROP TABLE "EbdAttendanceRecord";
ALTER TABLE "new_EbdAttendanceRecord" RENAME TO "EbdAttendanceRecord";
CREATE UNIQUE INDEX "EbdAttendanceRecord_ebdAttendanceId_ebdStudentId_key" ON "EbdAttendanceRecord"("ebdAttendanceId", "ebdStudentId");
CREATE TABLE "new_EbdClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faixaEtaria" TEXT,
    "sala" TEXT,
    "professorId" TEXT,
    "segundoProfessorId" TEXT,
    "terceiroProfessorId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EbdClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_segundoProfessorId_fkey" FOREIGN KEY ("segundoProfessorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_terceiroProfessorId_fkey" FOREIGN KEY ("terceiroProfessorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EbdClass" ("ativo", "createdAt", "faixaEtaria", "id", "name", "organizationId", "professorId", "sala", "segundoProfessorId", "updatedAt") SELECT "ativo", "createdAt", "faixaEtaria", "id", "name", "organizationId", "professorId", "sala", "segundoProfessorId", "updatedAt" FROM "EbdClass";
DROP TABLE "EbdClass";
ALTER TABLE "new_EbdClass" RENAME TO "EbdClass";
CREATE UNIQUE INDEX "EbdClass_name_organizationId_key" ON "EbdClass"("name", "organizationId");
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "customDomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'demo',
    "cellsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ebdEnabled" BOOLEAN NOT NULL DEFAULT false,
    "financialEnabled" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "loginMessage" TEXT,
    "congregationName" TEXT,
    "congregationAddress" TEXT,
    "pastorName" TEXT,
    "nucleus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Organization" ("cellsEnabled", "congregationAddress", "congregationName", "createdAt", "customDomain", "ebdEnabled", "id", "loginMessage", "logoUrl", "name", "nucleus", "pastorName", "plan", "primaryColor", "slug", "status", "subdomain", "updatedAt") SELECT "cellsEnabled", "congregationAddress", "congregationName", "createdAt", "customDomain", "ebdEnabled", "id", "loginMessage", "logoUrl", "name", "nucleus", "pastorName", "plan", "primaryColor", "slug", "status", "subdomain", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_subdomain_key" ON "Organization"("subdomain");
CREATE UNIQUE INDEX "Organization_customDomain_key" ON "Organization"("customDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FinancialAccount_organizationId_idx" ON "FinancialAccount"("organizationId");

-- CreateIndex
CREATE INDEX "Fund_organizationId_idx" ON "Fund"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_name_organizationId_key" ON "Fund"("name", "organizationId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_organizationId_idx" ON "ChartOfAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_organizationId_key" ON "ChartOfAccount"("code", "organizationId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_organizationId_idx" ON "FinancialTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_accountId_idx" ON "FinancialTransaction"("accountId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_date_idx" ON "FinancialTransaction"("date");

-- CreateIndex
CREATE INDEX "FinancialTransaction_type_idx" ON "FinancialTransaction"("type");

-- CreateIndex
CREATE INDEX "FinancialTransaction_amount_idx" ON "FinancialTransaction"("amount");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_transactionId_key" ON "Donation"("transactionId");

-- CreateIndex
CREATE INDEX "Donation_organizationId_idx" ON "Donation"("organizationId");

-- CreateIndex
CREATE INDEX "Donation_personId_idx" ON "Donation"("personId");

-- CreateIndex
CREATE INDEX "Donation_date_idx" ON "Donation"("date");

-- CreateIndex
CREATE INDEX "Donation_amount_idx" ON "Donation"("amount");

-- CreateIndex
CREATE INDEX "DonationBatch_organizationId_idx" ON "DonationBatch"("organizationId");

-- CreateIndex
CREATE INDEX "Bill_organizationId_idx" ON "Bill"("organizationId");

-- CreateIndex
CREATE INDEX "Bill_dueDate_idx" ON "Bill"("dueDate");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_transactionId_key" ON "BillPayment"("transactionId");

-- CreateIndex
CREATE INDEX "BillPayment_billId_idx" ON "BillPayment"("billId");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "Cell_leaderId_idx" ON "Cell"("leaderId");

-- CreateIndex
CREATE INDEX "Cell_viceLeaderId_idx" ON "Cell"("viceLeaderId");

-- CreateIndex
CREATE INDEX "Cell_organizationId_idx" ON "Cell"("organizationId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
