-- CreateEnum
CREATE TYPE "CalendarSource" AS ENUM ('DISTRICT', 'SCHOOL', 'CLUB', 'PERSONAL');

-- DropIndex
DROP INDEX "users_first_name_trgm_idx";

-- DropIndex
DROP INDEX "users_last_name_trgm_idx";

-- DropIndex
DROP INDEX "users_unique_id_trgm_idx";

-- AlterTable
ALTER TABLE "calendar_entries" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "source" "CalendarSource" NOT NULL DEFAULT 'SCHOOL';

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
