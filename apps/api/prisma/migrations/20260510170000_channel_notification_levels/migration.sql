-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'CLUB_CHANNEL_MESSAGE';
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'CLUB_CHANNEL_TAG_MENTION';
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'CLUB_CHANNEL_THREAD';

-- CreateEnum
CREATE TYPE "NotificationPreferenceLevel" AS ENUM ('OFF', 'IN_APP', 'PUSH', 'TIME_SENSITIVE');

-- AlterTable
ALTER TABLE "notification_preferences"
ADD COLUMN "level" "NotificationPreferenceLevel" NOT NULL DEFAULT 'PUSH';
