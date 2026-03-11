/*
  Warnings:

  - Added the required column `organizationId` to the `CellCancellation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `CellJustification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `EventException` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CellCancellation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cellId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "CellCancellation_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CellCancellation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CellCancellation" ("authorId", "cellId", "date", "id", "reason") SELECT "authorId", "cellId", "date", "id", "reason" FROM "CellCancellation";
DROP TABLE "CellCancellation";
ALTER TABLE "new_CellCancellation" RENAME TO "CellCancellation";
CREATE UNIQUE INDEX "CellCancellation_cellId_date_key" ON "CellCancellation"("cellId", "date");
CREATE TABLE "new_CellJustification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cellId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "CellJustification_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CellJustification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CellJustification" ("authorId", "cellId", "date", "id", "reason") SELECT "authorId", "cellId", "date", "id", "reason" FROM "CellJustification";
DROP TABLE "CellJustification";
ALTER TABLE "new_CellJustification" RENAME TO "CellJustification";
CREATE TABLE "new_EventException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "newTitle" TEXT,
    CONSTRAINT "EventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventException" ("canceled", "date", "eventId", "id", "newTitle") SELECT "canceled", "date", "eventId", "id", "newTitle" FROM "EventException";
DROP TABLE "EventException";
ALTER TABLE "new_EventException" RENAME TO "EventException";
CREATE UNIQUE INDEX "EventException_eventId_date_key" ON "EventException"("eventId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
