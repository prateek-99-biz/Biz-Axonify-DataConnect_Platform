-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "AppUser_clientId_idx" ON "AppUser"("clientId");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
