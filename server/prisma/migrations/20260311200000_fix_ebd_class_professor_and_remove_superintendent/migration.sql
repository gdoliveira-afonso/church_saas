-- Fix EbdClass: remove superintendenteId, change professorId/segundoProfessorId FK from Person to User
-- SQLite requires table recreation to modify FK constraints

PRAGMA foreign_keys=OFF;

CREATE TABLE "EbdClass_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faixaEtaria" TEXT,
    "sala" TEXT,
    "professorId" TEXT,
    "segundoProfessorId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EbdClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EbdClass_segundoProfessorId_fkey" FOREIGN KEY ("segundoProfessorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data; reset professor IDs to NULL (old values were Person IDs, now expect User IDs)
INSERT INTO "EbdClass_new" ("id", "organizationId", "name", "faixaEtaria", "sala", "professorId", "segundoProfessorId", "ativo", "createdAt", "updatedAt")
SELECT "id", "organizationId", "name", "faixaEtaria", "sala", NULL, NULL, "ativo", "createdAt", "updatedAt"
FROM "EbdClass";

DROP TABLE "EbdClass";
ALTER TABLE "EbdClass_new" RENAME TO "EbdClass";

CREATE UNIQUE INDEX "EbdClass_name_organizationId_key" ON "EbdClass"("name", "organizationId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
