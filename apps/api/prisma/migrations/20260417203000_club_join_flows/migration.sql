-- CreateEnum
CREATE TYPE "ClubJoinPolicy" AS ENUM ('OPEN', 'REQUEST');

-- CreateEnum
CREATE TYPE "ClubJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'CLUB_JOIN_REQUEST';

-- AlterTable
ALTER TABLE "clubs"
  ADD COLUMN "join_policy" "ClubJoinPolicy" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "join_code" TEXT,
  ADD COLUMN "join_code_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "club_join_requests" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "ClubJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_join_requests_club_id_requester_id_key" ON "club_join_requests"("club_id", "requester_id");

-- CreateIndex
CREATE INDEX "club_join_requests_club_id_status_idx" ON "club_join_requests"("club_id", "status");

-- AddForeignKey
ALTER TABLE "club_join_requests" ADD CONSTRAINT "club_join_requests_club_id_fkey"
FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_join_requests" ADD CONSTRAINT "club_join_requests_requester_id_fkey"
FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
