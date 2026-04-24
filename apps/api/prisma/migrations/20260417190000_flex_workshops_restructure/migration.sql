-- CreateTable: flex_workshops
CREATE TABLE "flex_workshops" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "teacher_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flex_workshops_pkey" PRIMARY KEY ("id")
);

-- Migrate existing sessions: create a workshop for each session that has location or capacity
INSERT INTO "flex_workshops" ("id", "session_id", "teacher_id", "title", "description", "location", "capacity", "created_at")
SELECT
    gen_random_uuid()::TEXT,
    "id",
    "teacher_id",
    "title",
    "description",
    "location",
    "capacity",
    "created_at"
FROM "flex_sessions";

-- Migrate registrations: update session_id → workshop_id via the mapping
ALTER TABLE "flex_registrations" ADD COLUMN "workshop_id" TEXT;
UPDATE "flex_registrations" r
SET "workshop_id" = w."id"
FROM "flex_workshops" w
WHERE w."session_id" = r."session_id";

-- Migrate assignments: update session_id → workshop_id via the mapping
ALTER TABLE "flex_assignments" ADD COLUMN "workshop_id" TEXT;
UPDATE "flex_assignments" a
SET "workshop_id" = w."id"
FROM "flex_workshops" w
WHERE w."session_id" = a."session_id";

-- Drop old FKs and constraints on registrations
ALTER TABLE "flex_registrations" DROP CONSTRAINT IF EXISTS "flex_registrations_session_id_fkey";
DROP INDEX IF EXISTS "flex_registrations_session_id_student_id_key";
ALTER TABLE "flex_registrations" DROP COLUMN "session_id";
ALTER TABLE "flex_registrations" ALTER COLUMN "workshop_id" SET NOT NULL;

-- Drop old FKs and constraints on assignments
ALTER TABLE "flex_assignments" DROP CONSTRAINT IF EXISTS "flex_assignments_session_id_fkey";
DROP INDEX IF EXISTS "flex_assignments_session_id_student_id_key";
ALTER TABLE "flex_assignments" DROP COLUMN "session_id";
ALTER TABLE "flex_assignments" ALTER COLUMN "workshop_id" SET NOT NULL;

-- Drop location, capacity, teacher_id from flex_sessions
ALTER TABLE "flex_sessions" DROP COLUMN IF EXISTS "location";
ALTER TABLE "flex_sessions" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "flex_sessions" DROP COLUMN IF EXISTS "teacher_id";

-- Add new FK: flex_workshops → flex_sessions
ALTER TABLE "flex_workshops" ADD CONSTRAINT "flex_workshops_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "flex_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new FK: flex_registrations → flex_workshops
ALTER TABLE "flex_registrations" ADD CONSTRAINT "flex_registrations_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "flex_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "flex_registrations_workshop_id_student_id_key" ON "flex_registrations"("workshop_id", "student_id");

-- Add new FK: flex_assignments → flex_workshops
ALTER TABLE "flex_assignments" ADD CONSTRAINT "flex_assignments_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "flex_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "flex_assignments_workshop_id_student_id_key" ON "flex_assignments"("workshop_id", "student_id");
