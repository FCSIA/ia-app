-- CreateEnum
CREATE TYPE "ClubMentionKind" AS ENUM ('USER', 'BUILT_IN_TAG', 'CUSTOM_TAG');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'CLUB_CHANNEL_MENTION';

-- CreateTable
CREATE TABLE "club_channels" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_channel_memberships" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_channel_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_tags" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_tag_members" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_tag_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_channel_messages" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_channel_message_mentions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT,
    "tag_id" TEXT,
    "kind" "ClubMentionKind" NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_channel_message_mentions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "notification_deliveries"
ADD COLUMN "club_id" TEXT,
ADD COLUMN "channel_id" TEXT,
ADD COLUMN "message_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "club_channels_club_id_name_key" ON "club_channels"("club_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "club_channel_memberships_channel_id_user_id_key" ON "club_channel_memberships"("channel_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_tags_club_id_slug_key" ON "club_tags"("club_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "club_tag_members_tag_id_user_id_key" ON "club_tag_members"("tag_id", "user_id");

-- AddForeignKey
ALTER TABLE "club_channels" ADD CONSTRAINT "club_channels_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channels" ADD CONSTRAINT "club_channels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_memberships" ADD CONSTRAINT "club_channel_memberships_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "club_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_memberships" ADD CONSTRAINT "club_channel_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_tags" ADD CONSTRAINT "club_tags_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_tags" ADD CONSTRAINT "club_tags_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_tag_members" ADD CONSTRAINT "club_tag_members_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "club_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_tag_members" ADD CONSTRAINT "club_tag_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_messages" ADD CONSTRAINT "club_channel_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "club_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_messages" ADD CONSTRAINT "club_channel_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_mentions" ADD CONSTRAINT "club_channel_message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_mentions" ADD CONSTRAINT "club_channel_message_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_mentions" ADD CONSTRAINT "club_channel_message_mentions_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "club_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "club_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
