-- CreateTable
CREATE TABLE "SyncDashboard" (
    "clientId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncDashboard_pkey" PRIMARY KEY ("clientId")
);
