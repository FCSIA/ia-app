ALTER TABLE "club_channel_messages"
  ADD COLUMN IF NOT EXISTS "body_rich" JSONB;
