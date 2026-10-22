-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMapping" (
    "id" TEXT NOT NULL,
    "salesforceAccountId" TEXT,
    "axonifyTenantId" TEXT,
    "displayName" TEXT NOT NULL,
    "industry" TEXT,
    "csmEmail" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "creatorId" TEXT NOT NULL,
    "sourceAlertKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAck" (
    "id" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisional',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SyncClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "csmEmail" TEXT NOT NULL,
    "csmName" TEXT NOT NULL,
    "axonifyTenantId" TEXT,
    "salesforceAccountId" TEXT,

    CONSTRAINT "SyncClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncClientPeriod" (
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "registeredUsers" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "retainedUsers" INTEGER NOT NULL,
    "previousActiveUsers" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "featuresAvailable" INTEGER NOT NULL,
    "featuresUsed" INTEGER NOT NULL,

    CONSTRAINT "SyncClientPeriod_pkey" PRIMARY KEY ("clientId","period")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "message" TEXT,
    "clientCount" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "triggeredBy" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMapping_salesforceAccountId_key" ON "ClientMapping"("salesforceAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMapping_axonifyTenantId_key" ON "ClientMapping"("axonifyTenantId");

-- CreateIndex
CREATE INDEX "ClientMapping_displayName_idx" ON "ClientMapping"("displayName");

-- CreateIndex
CREATE INDEX "Note_clientId_createdAt_idx" ON "Note"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_clientId_status_idx" ON "Task"("clientId", "status");

-- CreateIndex
CREATE INDEX "Task_ownerId_status_idx" ON "Task"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AlertAck_alertKey_userId_key" ON "AlertAck"("alertKey", "userId");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAck" ADD CONSTRAINT "AlertAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

