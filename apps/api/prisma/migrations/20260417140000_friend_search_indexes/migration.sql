-- Enable trigram extension for fast fuzzy + substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes power both ILIKE '%q%' and similarity()
CREATE INDEX IF NOT EXISTS "users_first_name_trgm_idx"
  ON "users" USING GIN ("first_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_last_name_trgm_idx"
  ON "users" USING GIN ("last_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_unique_id_trgm_idx"
  ON "users" USING GIN ("unique_id" gin_trgm_ops);

-- Filter predicate: active students. Accelerates the search's prefilter.
CREATE INDEX IF NOT EXISTS "users_active_students_idx"
  ON "users" ("is_active")
  WHERE "is_active" = true;

-- Reverse-lookup index: "who added me as a friend?" and dashboard joins
CREATE INDEX IF NOT EXISTS "student_schedule_friends_friend_id_idx"
  ON "student_schedule_friends" ("friend_id");
