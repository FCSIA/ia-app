-- Sync DB schema to Prisma schema (post-merge drift fix)
-- Preserves pg_trgm indexes from friend_search_indexes migration.

-- ── EventAttendanceStatus enum (new) ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "EventAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'TARDY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── FlexFridayType: drop FRESHMAN_WORKSHOP, keep desired value set ───────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'FlexFridayType' AND e.enumlabel = 'FRESHMAN_WORKSHOP'
  ) THEN
    CREATE TYPE "FlexFridayType_new" AS ENUM ('ALL_STUDENT', 'GRADE_SPECIFIC', 'PATHWAY_SPECIFIC', 'TEACHER_PD');
    ALTER TABLE "flex_fridays" ALTER COLUMN "type" DROP DEFAULT;
    ALTER TABLE "flex_fridays" ALTER COLUMN "type" TYPE "FlexFridayType_new" USING ("type"::text::"FlexFridayType_new");
    ALTER TYPE "FlexFridayType" RENAME TO "FlexFridayType_old";
    ALTER TYPE "FlexFridayType_new" RENAME TO "FlexFridayType";
    DROP TYPE "FlexFridayType_old";
    ALTER TABLE "flex_fridays" ALTER COLUMN "type" SET DEFAULT 'ALL_STUDENT';
  END IF;
END $$;

-- ── club_members.role: ClubMemberRole enum → TEXT ───────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_members' AND column_name = 'role' AND udt_name = 'ClubMemberRole'
  ) THEN
    ALTER TABLE "club_members" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "club_members" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
    DROP TYPE IF EXISTS "ClubMemberRole";
  END IF;
END $$;

-- ── flex_fridays.pathway: TEXT → Pathway ─────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flex_fridays' AND column_name = 'pathway' AND data_type = 'text'
  ) THEN
    ALTER TABLE "flex_fridays"
      ALTER COLUMN "pathway" TYPE "Pathway"
      USING (CASE WHEN "pathway" IN ('INFORMATION_TECHNOLOGY','HEALTH_SCIENCE','ENGINEERING')
                  THEN "pathway"::"Pathway" ELSE NULL END);
  END IF;
END $$;

-- ── events: add missing columns ──────────────────────────────────────────────
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "owner_id" TEXT,
  ADD COLUMN IF NOT EXISTS "category_id" TEXT,
  ADD COLUMN IF NOT EXISTS "registration_opens_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registration_closes_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "allowed_major_pathways" "Pathway"[] DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN IF NOT EXISTS "allowed_minor_pathways" "Pathway"[] DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN IF NOT EXISTS "required_major_workshop_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_inactive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3);

-- ── event_categories table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "event_categories" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_categories_title_key" ON "event_categories"("title");

-- ── events.category_id FK ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'events' AND constraint_name = 'events_category_id_fkey'
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "event_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
