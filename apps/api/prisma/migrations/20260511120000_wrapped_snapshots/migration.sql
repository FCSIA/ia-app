-- Precompute IA Wrapped summaries so the May traffic spike reads indexed rows
-- instead of rebuilding analytics from channel activity on every request.

CREATE TABLE "wrapped_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_year_start" INTEGER NOT NULL,
    "school_year_label" TEXT NOT NULL,
    "range_start" TIMESTAMP(3) NOT NULL,
    "range_end" TIMESTAMP(3) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "summary" JSONB NOT NULL,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,
    "channels_engaged" INTEGER NOT NULL DEFAULT 0,
    "friends" INTEGER NOT NULL DEFAULT 0,
    "clubs" INTEGER NOT NULL DEFAULT 0,
    "flex_credits" INTEGER NOT NULL DEFAULT 0,
    "pathway_flex_credits" INTEGER NOT NULL DEFAULT 0,
    "reactions_received" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wrapped_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wrapped_snapshots_user_id_school_year_start_key"
  ON "wrapped_snapshots"("user_id", "school_year_start");
CREATE INDEX "wrapped_snapshots_school_year_start_idx"
  ON "wrapped_snapshots"("school_year_start");
CREATE INDEX "wrapped_snapshots_school_year_start_schema_version_idx"
  ON "wrapped_snapshots"("school_year_start", "schema_version");
CREATE INDEX "wrapped_snapshots_school_year_start_generated_at_idx"
  ON "wrapped_snapshots"("school_year_start", "generated_at");
CREATE INDEX "wrapped_snapshots_school_year_start_messages_sent_idx"
  ON "wrapped_snapshots"("school_year_start", "messages_sent");
CREATE INDEX "wrapped_snapshots_school_year_start_flex_credits_idx"
  ON "wrapped_snapshots"("school_year_start", "flex_credits");
CREATE INDEX "wrapped_snapshots_school_year_start_reactions_received_idx"
  ON "wrapped_snapshots"("school_year_start", "reactions_received");

ALTER TABLE "wrapped_snapshots"
  ADD CONSTRAINT "wrapped_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "student_schedule_friends_requester_id_status_accepted_at_idx"
  ON "student_schedule_friends"("requester_id", "status", "accepted_at");
CREATE INDEX "student_schedule_friends_addressee_id_status_accepted_at_idx"
  ON "student_schedule_friends"("addressee_id", "status", "accepted_at");

CREATE INDEX "club_members_user_id_joined_at_idx"
  ON "club_members"("user_id", "joined_at");

CREATE INDEX "club_channel_messages_author_id_created_at_idx"
  ON "club_channel_messages"("author_id", "created_at");
CREATE INDEX "club_channel_messages_author_id_channel_id_created_at_idx"
  ON "club_channel_messages"("author_id", "channel_id", "created_at");

CREATE INDEX "club_channel_message_reactions_user_id_created_at_idx"
  ON "club_channel_message_reactions"("user_id", "created_at");
CREATE INDEX "club_channel_message_reactions_message_id_created_at_idx"
  ON "club_channel_message_reactions"("message_id", "created_at");

CREATE INDEX "club_channel_message_mentions_message_id_user_id_idx"
  ON "club_channel_message_mentions"("message_id", "user_id");
CREATE INDEX "club_channel_message_mentions_user_id_idx"
  ON "club_channel_message_mentions"("user_id");
