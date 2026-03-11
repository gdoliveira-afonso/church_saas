/*
  Warnings:

  - Added the required column `organizationId` to the `TriageQueue` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TriageQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TriageQueue_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TriageQueue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TriageQueue" ("createdAt", "data", "formId", "id", "status") SELECT "createdAt", "data", "formId", "id", "status" FROM "TriageQueue";
DROP TABLE "TriageQueue";
ALTER TABLE "new_TriageQueue" RENAME TO "TriageQueue";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
