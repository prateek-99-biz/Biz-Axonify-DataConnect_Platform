-- CreateTable
CREATE TABLE "SyncDashboardPart" (
    "clientId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "SyncDashboardPart_pkey" PRIMARY KEY ("clientId","section")
);
