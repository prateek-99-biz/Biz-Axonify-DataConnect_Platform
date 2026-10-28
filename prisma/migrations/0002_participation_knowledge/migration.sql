-- AlterTable
ALTER TABLE "SyncClientPeriod" ADD COLUMN     "avgKnowledge" DOUBLE PRECISION,
ADD COLUMN     "knowledgeLearners" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trainingUsers" INTEGER NOT NULL DEFAULT 0;
