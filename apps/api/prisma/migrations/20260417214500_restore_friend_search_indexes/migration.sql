CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_first_name_trgm_idx"
  ON "users" USING GIN ("first_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_last_name_trgm_idx"
  ON "users" USING GIN ("last_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_unique_id_trgm_idx"
  ON "users" USING GIN ("unique_id" gin_trgm_ops);
