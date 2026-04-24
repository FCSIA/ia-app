-- CreateEnum
CREATE TYPE "FlexAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "flex_attendances" (
    "id" TEXT NOT NULL,
    "workshop_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "flex_friday_id" TEXT NOT NULL,
    "status" "FlexAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "marked_by_id" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flex_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flex_attendances_workshop_id_student_id_key" ON "flex_attendances"("workshop_id", "student_id");

-- CreateIndex
CREATE INDEX "flex_attendances_student_id_flex_friday_id_idx" ON "flex_attendances"("student_id", "flex_friday_id");

-- CreateIndex
CREATE INDEX "flex_attendances_flex_friday_id_idx" ON "flex_attendances"("flex_friday_id");

-- AddForeignKey
ALTER TABLE "flex_attendances" ADD CONSTRAINT "flex_attendances_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "flex_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_attendances" ADD CONSTRAINT "flex_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_attendances" ADD CONSTRAINT "flex_attendances_flex_friday_id_fkey" FOREIGN KEY ("flex_friday_id") REFERENCES "flex_fridays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_attendances" ADD CONSTRAINT "flex_attendances_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
