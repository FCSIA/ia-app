-- CreateEnum
CREATE TYPE "Pathway" AS ENUM ('INFORMATION_TECHNOLOGY', 'HEALTH_SCIENCE', 'ENGINEERING');

-- AlterTable users: change major_pathway and minor_pathway to Pathway enum type
ALTER TABLE "users" ALTER COLUMN "major_pathway" TYPE "Pathway" USING "major_pathway"::"Pathway";
ALTER TABLE "users" ALTER COLUMN "minor_pathway" TYPE "Pathway" USING "minor_pathway"::"Pathway";

-- AlterTable flex_sessions: change target_pathway to Pathway enum type
ALTER TABLE "flex_sessions" ALTER COLUMN "target_pathway" TYPE "Pathway" USING "target_pathway"::"Pathway";
