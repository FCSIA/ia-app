-- CreateEnum
CREATE TYPE "CourseCatalogSource" AS ENUM ('COURSE_CATALOG', 'AP_CATALOG', 'MERGED');

-- CreateEnum
CREATE TYPE "ClubChannelVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'MEMBER_READONLY');

-- DropIndex
DROP INDEX "users_first_name_trgm_idx";

-- DropIndex
DROP INDEX "users_last_name_trgm_idx";

-- DropIndex
DROP INDEX "users_unique_id_trgm_idx";

-- AlterTable
ALTER TABLE "club_channels" DROP COLUMN "is_private",
ADD COLUMN     "visibility" "ClubChannelVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "club_join_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_schedule_entries" ADD COLUMN     "course_id" TEXT;

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "course_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "department" TEXT NOT NULL,
    "pathway" "Pathway",
    "catalog_source" "CourseCatalogSource" NOT NULL DEFAULT 'COURSE_CATALOG',
    "term" TEXT,
    "grade_text" TEXT,
    "min_grade" INTEGER,
    "max_grade" INTEGER,
    "prerequisites_text" TEXT,
    "summary" TEXT,
    "major_topics" TEXT,
    "essential_skills" TEXT,
    "student_workload" TEXT,
    "teacher_workload" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_department_title_idx" ON "courses"("department", "title");

-- CreateIndex
CREATE INDEX "courses_pathway_min_grade_max_grade_idx" ON "courses"("pathway", "min_grade", "max_grade");

-- CreateIndex
CREATE INDEX "club_channels_club_id_visibility_idx" ON "club_channels"("club_id", "visibility");

-- CreateIndex
CREATE INDEX "student_schedule_entries_course_id_idx" ON "student_schedule_entries"("course_id");

-- AddForeignKey
ALTER TABLE "student_schedule_entries" ADD CONSTRAINT "student_schedule_entries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
