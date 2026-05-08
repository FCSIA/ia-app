-- Announcement approval and saved/featured state
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "submitted_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "target_grades" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "target_major_pathways" "Pathway"[] NOT NULL DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN IF NOT EXISTS "target_minor_pathways" "Pathway"[] NOT NULL DEFAULT ARRAY[]::"Pathway"[],
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejection_note" TEXT,
  ADD COLUMN IF NOT EXISTS "promoted_until" TIMESTAMP(3);

UPDATE "announcements"
SET "target_grades" = ARRAY["target_grade"]::INTEGER[]
WHERE "target_grade" IS NOT NULL AND cardinality("target_grades") = 0;

UPDATE "announcements"
SET "target_major_pathways" = ARRAY["target_pathway"]::"Pathway"[]
WHERE "target_pathway" IS NOT NULL AND cardinality("target_major_pathways") = 0;

ALTER TABLE "announcements"
  ADD CONSTRAINT "announcements_submitted_by_id_fkey"
  FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "announcements"
  ADD CONSTRAINT "announcements_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "announcements_status_promoted_until_idx"
  ON "announcements"("status", "promoted_until");

CREATE TABLE IF NOT EXISTS "announcement_bookmarks" (
  "id" TEXT NOT NULL,
  "announcement_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_bookmarks_announcement_id_user_id_key"
  ON "announcement_bookmarks"("announcement_id", "user_id");

CREATE INDEX IF NOT EXISTS "announcement_bookmarks_user_id_created_at_idx"
  ON "announcement_bookmarks"("user_id", "created_at");

ALTER TABLE "announcement_bookmarks"
  ADD CONSTRAINT "announcement_bookmarks_announcement_id_fkey"
  FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcement_bookmarks"
  ADD CONSTRAINT "announcement_bookmarks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Entity-level notification preferences. Preserve old rows by using a stable scope key.
ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "channel_id" TEXT,
  ADD COLUMN IF NOT EXISTS "announcement_id" TEXT,
  ADD COLUMN IF NOT EXISTS "event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "scope_key" TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "notification_preferences"
SET "scope_key" = COALESCE('club:' || "club_id", 'global')
WHERE "scope_key" = 'global' AND "club_id" IS NOT NULL;

DROP INDEX IF EXISTS "notification_preferences_user_id_category_club_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_id_category_scope_key_key"
  ON "notification_preferences"("user_id", "category", "scope_key");

CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_category_club_id_idx"
  ON "notification_preferences"("user_id", "category", "club_id");

CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_category_channel_id_idx"
  ON "notification_preferences"("user_id", "category", "channel_id");
