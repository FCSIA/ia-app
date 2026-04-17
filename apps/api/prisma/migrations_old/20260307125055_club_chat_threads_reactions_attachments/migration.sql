-- AlterTable
ALTER TABLE "club_channel_messages" ADD COLUMN     "parent_message_id" TEXT;

-- CreateTable
CREATE TABLE "club_channel_message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_channel_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_channel_message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_channel_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_channel_message_attachments_message_id_created_at_idx" ON "club_channel_message_attachments"("message_id", "created_at");

-- CreateIndex
CREATE INDEX "club_channel_message_reactions_message_id_emoji_idx" ON "club_channel_message_reactions"("message_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "club_channel_message_reactions_message_id_user_id_emoji_key" ON "club_channel_message_reactions"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "club_channel_messages_channel_id_parent_message_id_created__idx" ON "club_channel_messages"("channel_id", "parent_message_id", "created_at");

-- AddForeignKey
ALTER TABLE "club_channel_messages" ADD CONSTRAINT "club_channel_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_attachments" ADD CONSTRAINT "club_channel_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_reactions" ADD CONSTRAINT "club_channel_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_channel_message_reactions" ADD CONSTRAINT "club_channel_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
