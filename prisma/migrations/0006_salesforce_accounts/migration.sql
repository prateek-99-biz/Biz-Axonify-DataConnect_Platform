-- CreateTable
CREATE TABLE "SalesforceAccount" (
    "clientId" TEXT NOT NULL,
    "salesforceAccountId" TEXT,
    "industry" TEXT,
    "region" TEXT,
    "csmName" TEXT,
    "csmEmail" TEXT,
    "licenses" INTEGER,
    "licenseValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "contractStart" DATE,
    "renewalDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesforceAccount_pkey" PRIMARY KEY ("clientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesforceAccount_salesforceAccountId_key" ON "SalesforceAccount"("salesforceAccountId");
