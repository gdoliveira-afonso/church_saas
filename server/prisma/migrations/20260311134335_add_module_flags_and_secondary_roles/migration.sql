-- AlterTable
ALTER TABLE "User" ADD COLUMN "secondaryRoles" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_Organization" ("congregationAddress", "congregationName", "createdAt", "customDomain", "id", "loginMessage", "logoUrl", "name", "nucleus", "pastorName", "plan", "primaryColor", "slug", "status", "subdomain", "updatedAt") SELECT "congregationAddress", "congregationName", "createdAt", "customDomain", "id", "loginMessage", "logoUrl", "name", "nucleus", "pastorName", "plan", "primaryColor", "slug", "status", "subdomain", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_subdomain_key" ON "Organization"("subdomain");
CREATE UNIQUE INDEX "Organization_customDomain_key" ON "Organization"("customDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
