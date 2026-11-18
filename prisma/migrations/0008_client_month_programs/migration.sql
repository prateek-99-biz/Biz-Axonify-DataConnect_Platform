-- Active, logged-in and training users counted only among users in active training programs, so the Insights pages
-- can switch between AdminZone's two Participation views (All Users, Users in Active Training Programs).
ALTER TABLE "SyncClientMonth" ADD COLUMN "programActiveUsers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SyncClientMonth" ADD COLUMN "programLoggedInUsers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SyncClientMonth" ADD COLUMN "programTrainingUsers" INTEGER NOT NULL DEFAULT 0;
