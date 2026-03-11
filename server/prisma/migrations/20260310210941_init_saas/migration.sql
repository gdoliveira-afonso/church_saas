/*
  Warnings:

  - You are about to drop the `SystemSettings` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `SystemConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `organizationId` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Cell` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Form` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Generation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Person` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `SystemConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Track` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Webhook` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SystemSettings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
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

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'read_membros,read_eventos',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "id", "keyHash", "keyPrefix", "lastUsedAt", "name", "permissions", "status") SELECT "createdAt", "id", "keyHash", "keyPrefix", "lastUsedAt", "name", "permissions", "status" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE TABLE "new_Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cellId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "customFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("cellId", "createdAt", "customFields", "date", "id", "notes") SELECT "cellId", "createdAt", "customFields", "date", "id", "notes" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE UNIQUE INDEX "Attendance_cellId_date_key" ON "Attendance"("cellId", "date");
CREATE TABLE "new_Cell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leaderId" TEXT,
    "viceLeaderId" TEXT,
    "hostId" TEXT,
    "address" TEXT,
    "meetingDay" TEXT,
    "meetingTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "generationId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cell_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cell_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cell" ("address", "createdAt", "generationId", "hostId", "id", "leaderId", "meetingDay", "meetingTime", "name", "status", "updatedAt", "viceLeaderId") SELECT "address", "createdAt", "generationId", "hostId", "id", "leaderId", "meetingDay", "meetingTime", "name", "status", "updatedAt", "viceLeaderId" FROM "Cell";
DROP TABLE "Cell";
ALTER TABLE "new_Cell" RENAME TO "Cell";
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "type" TEXT DEFAULT 'event',
    "category" TEXT,
    "location" TEXT,
    "icon" TEXT,
    "recurrence" TEXT,
    "reminder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("category", "color", "createdAt", "date", "description", "endTime", "id", "location", "recurrence", "reminder", "startTime", "title", "type") SELECT "category", "color", "createdAt", "date", "description", "endTime", "id", "location", "recurrence", "reminder", "startTime", "title", "type" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "showOnLogin" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT DEFAULT 'description',
    "color" TEXT DEFAULT 'blue',
    "subtitle" TEXT,
    "personStatus" TEXT,
    "fields" TEXT NOT NULL,
    CONSTRAINT "Form_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Form" ("color", "fields", "icon", "id", "name", "personStatus", "showOnLogin", "status", "subtitle") SELECT "color", "fields", "icon", "id", "name", "personStatus", "showOnLogin", "status", "subtitle" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE TABLE "new_Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Generation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Generation" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Generation";
DROP TABLE "Generation";
ALTER TABLE "new_Generation" RENAME TO "Generation";
CREATE UNIQUE INDEX "Generation_name_organizationId_key" ON "Generation"("name", "organizationId");
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("action", "createdAt", "id", "message", "read", "title", "userId") SELECT "action", "createdAt", "id", "message", "read", "title", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birthdate" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Visitante',
    "howKnown" TEXT,
    "previousCell" TEXT,
    "returnReason" TEXT,
    "prayerRequest" TEXT,
    "cellId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "extraData" TEXT,
    CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Person_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Person" ("address", "birthdate", "cellId", "createdAt", "email", "howKnown", "id", "name", "phone", "prayerRequest", "previousCell", "returnReason", "status", "updatedAt", "userId") SELECT "address", "birthdate", "cellId", "createdAt", "email", "howKnown", "id", "name", "phone", "prayerRequest", "previousCell", "returnReason", "status", "updatedAt", "userId" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");
CREATE TABLE "new_SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("key", "organizationId"),
    CONSTRAINT "SystemConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SystemConfig" ("key", "updatedAt", "value") SELECT "key", "updatedAt", "value" FROM "SystemConfig";
DROP TABLE "SystemConfig";
ALTER TABLE "new_SystemConfig" RENAME TO "SystemConfig";
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "targetMetadata" TEXT,
    CONSTRAINT "Track_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("category", "color", "icon", "id", "name") SELECT "category", "color", "icon", "id", "name" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "generationId" TEXT,
    "organizationId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatar", "createdAt", "generationId", "id", "name", "password", "role", "updatedAt", "username") SELECT "avatar", "createdAt", "generationId", "id", "name", "password", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "new_Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Webhook" ("createdAt", "events", "id", "name", "secret", "status", "url") SELECT "createdAt", "events", "id", "name", "secret", "status", "url" FROM "Webhook";
DROP TABLE "Webhook";
ALTER TABLE "new_Webhook" RENAME TO "Webhook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_subdomain_key" ON "Organization"("subdomain");
