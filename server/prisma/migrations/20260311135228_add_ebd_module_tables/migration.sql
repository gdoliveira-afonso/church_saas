-- CreateTable
CREATE TABLE "EbdClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faixaEtaria" TEXT,
    "sala" TEXT,
    "professorId" TEXT,
    "segundoProfessorId" TEXT,
    "superintendenteId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EbdClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_segundoProfessorId_fkey" FOREIGN KEY ("segundoProfessorId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_superintendenteId_fkey" FOREIGN KEY ("superintendenteId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EbdStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "ebdClassId" TEXT NOT NULL,
    "dataMatricula" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EbdStudent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EbdStudent_ebdClassId_fkey" FOREIGN KEY ("ebdClassId") REFERENCES "EbdClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EbdAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ebdClassId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EbdAttendance_ebdClassId_fkey" FOREIGN KEY ("ebdClassId") REFERENCES "EbdClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EbdAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ebdAttendanceId" TEXT NOT NULL,
    "ebdStudentId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EbdAttendanceRecord_ebdAttendanceId_fkey" FOREIGN KEY ("ebdAttendanceId") REFERENCES "EbdAttendance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EbdAttendanceRecord_ebdStudentId_fkey" FOREIGN KEY ("ebdStudentId") REFERENCES "EbdStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EbdOffering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ebdClassId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "observacao" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EbdOffering_ebdClassId_fkey" FOREIGN KEY ("ebdClassId") REFERENCES "EbdClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EbdOffering_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EbdOffering_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EbdClass_name_organizationId_key" ON "EbdClass"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EbdStudent_personId_ebdClassId_key" ON "EbdStudent"("personId", "ebdClassId");

-- CreateIndex
CREATE UNIQUE INDEX "EbdAttendance_ebdClassId_data_key" ON "EbdAttendance"("ebdClassId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "EbdAttendanceRecord_ebdAttendanceId_ebdStudentId_key" ON "EbdAttendanceRecord"("ebdAttendanceId", "ebdStudentId");
