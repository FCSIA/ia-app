-- AlterTable: rename pathway -> major_pathway, add minor_pathway
ALTER TABLE "users" RENAME COLUMN "pathway" TO "major_pathway";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "minor_pathway" TEXT;
