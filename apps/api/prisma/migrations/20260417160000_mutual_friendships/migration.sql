-- Mutual friendships with invite/accept flow
-- Renames owner_id/friend_id to requester_id/addressee_id, adds status+acceptedAt.

CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- Rename columns
ALTER TABLE "student_schedule_friends" RENAME COLUMN "owner_id" TO "requester_id";
ALTER TABLE "student_schedule_friends" RENAME COLUMN "friend_id" TO "addressee_id";

-- Add status (existing rows → ACCEPTED, since they were manually "added" pre-mutual-model)
ALTER TABLE "student_schedule_friends"
  ADD COLUMN "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "accepted_at" TIMESTAMP(3);

UPDATE "student_schedule_friends" SET "status" = 'ACCEPTED', "accepted_at" = "created_at";

-- Rename constraints/indexes to match new column names
ALTER INDEX "student_schedule_friends_owner_id_friend_id_key"
  RENAME TO "student_schedule_friends_requester_id_addressee_id_key";

DROP INDEX IF EXISTS "student_schedule_friends_friend_id_idx";
CREATE INDEX "student_schedule_friends_addressee_id_idx" ON "student_schedule_friends" ("addressee_id");
CREATE INDEX "student_schedule_friends_status_idx" ON "student_schedule_friends" ("status");

-- Rename FKs
ALTER TABLE "student_schedule_friends"
  RENAME CONSTRAINT "student_schedule_friends_owner_id_fkey" TO "student_schedule_friends_requester_id_fkey";
ALTER TABLE "student_schedule_friends"
  RENAME CONSTRAINT "student_schedule_friends_friend_id_fkey" TO "student_schedule_friends_addressee_id_fkey";
