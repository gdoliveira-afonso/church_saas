/*
  Warnings:

  - Added the required column `organizationId` to the `PastoralNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `PersonMilestone` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Visit` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PastoralNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PastoralNote_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PastoralNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PastoralNote" ("authorId", "createdAt", "date", "id", "personId", "text", "type") SELECT "authorId", "createdAt", "date", "id", "personId", "text", "type" FROM "PastoralNote";
DROP TABLE "PastoralNote";
ALTER TABLE "new_PastoralNote" RENAME TO "PastoralNote";
CREATE TABLE "new_PersonMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonMilestone_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonMilestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PersonMilestone" ("color", "date", "detail", "icon", "id", "label", "personId", "type") SELECT "color", "date", "detail", "icon", "id", "label", "personId", "type" FROM "PersonMilestone";
DROP TABLE "PersonMilestone";
ALTER TABLE "new_PersonMilestone" RENAME TO "PersonMilestone";
CREATE TABLE "new_Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Visit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Visit" ("authorId", "createdAt", "date", "id", "notes", "personId", "type") SELECT "authorId", "createdAt", "date", "id", "notes", "personId", "type" FROM "Visit";
DROP TABLE "Visit";
ALTER TABLE "new_Visit" RENAME TO "Visit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
