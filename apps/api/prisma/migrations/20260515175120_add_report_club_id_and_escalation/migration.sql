-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "club_id" TEXT,
ADD COLUMN     "is_escalated" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
