ALTER TABLE "club_channel_messages"
  ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinned_at" TIMESTAMP(3),
  ADD COLUMN "poll_question" TEXT,
  ADD COLUMN "poll_options" JSONB;

CREATE TABLE "club_channel_message_poll_votes" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "club_channel_message_poll_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "club_channel_message_poll_votes_message_id_user_id_key" ON "club_channel_message_poll_votes"("message_id", "user_id");
CREATE INDEX "club_channel_message_poll_votes_message_id_option_id_idx" ON "club_channel_message_poll_votes"("message_id", "option_id");
CREATE INDEX "club_channel_messages_channel_id_is_pinned_pinned_at_idx" ON "club_channel_messages"("channel_id", "is_pinned", "pinned_at");

ALTER TABLE "club_channel_message_poll_votes"
  ADD CONSTRAINT "club_channel_message_poll_votes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "club_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "club_channel_message_poll_votes"
  ADD CONSTRAINT "club_channel_message_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
