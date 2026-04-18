-- Club: add logo, banner, accent color, overview copy
ALTER TABLE "clubs"
  ADD COLUMN "logo_url" TEXT,
  ADD COLUMN "banner_url" TEXT,
  ADD COLUMN "accent_color" TEXT,
  ADD COLUMN "overview" TEXT;

-- CalendarEntry: link back to FlexFriday (one-to-one, optional)
ALTER TABLE "calendar_entries"
  ADD COLUMN "flex_friday_id" TEXT;

CREATE UNIQUE INDEX "calendar_entries_flex_friday_id_key"
  ON "calendar_entries"("flex_friday_id");

ALTER TABLE "calendar_entries"
  ADD CONSTRAINT "calendar_entries_flex_friday_id_fkey"
  FOREIGN KEY ("flex_friday_id") REFERENCES "flex_fridays"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FlexSession: add time block + updated_at, drop pathway/grade targeting
ALTER TABLE "flex_sessions"
  ADD COLUMN "start_time" TEXT NOT NULL DEFAULT '13:00',
  ADD COLUMN "end_time" TEXT NOT NULL DEFAULT '14:30',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "flex_sessions"
  DROP COLUMN IF EXISTS "target_pathway",
  DROP COLUMN IF EXISTS "target_grade";

-- FlexWorkshop: migrate single-session relation into join table, add targeting arrays
-- 1) Create the many-to-many join table first
CREATE TABLE "flex_workshop_sessions" (
    "id" TEXT NOT NULL,
    "workshop_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flex_workshop_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flex_workshop_sessions_workshop_id_session_id_key"
  ON "flex_workshop_sessions"("workshop_id", "session_id");
CREATE INDEX "flex_workshop_sessions_session_id_idx"
  ON "flex_workshop_sessions"("session_id");

ALTER TABLE "flex_workshop_sessions"
  ADD CONSTRAINT "flex_workshop_sessions_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "flex_workshops"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flex_workshop_sessions"
  ADD CONSTRAINT "flex_workshop_sessions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "flex_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Backfill join table from each workshop's existing session_id
INSERT INTO "flex_workshop_sessions" ("id", "workshop_id", "session_id", "created_at")
SELECT
  'cm' || substr(md5(random()::text || clock_timestamp()::text), 1, 22) AS id,
  "id" AS workshop_id,
  "session_id",
  NOW()
FROM "flex_workshops"
WHERE "session_id" IS NOT NULL;

-- 3) Drop the old single-session foreign key + column
ALTER TABLE "flex_workshops"
  DROP CONSTRAINT IF EXISTS "flex_workshops_session_id_fkey";

ALTER TABLE "flex_workshops"
  DROP COLUMN "session_id";

-- 4) Add targeting arrays + updated_at to workshops
ALTER TABLE "flex_workshops"
  ADD COLUMN "target_grades" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "target_major_pathways" "Pathway"[] NOT NULL DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN "target_minor_pathways" "Pathway"[] NOT NULL DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
