-- Add missing columns to announcements
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "target_grade" INTEGER;
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "target_pathway" "Pathway";

-- Add missing grade_level to flex_fridays
ALTER TABLE "flex_fridays" ADD COLUMN IF NOT EXISTS "grade_level" INTEGER;

-- Fix type: flex_sessions.target_grade TEXT -> INTEGER
ALTER TABLE "flex_sessions" ALTER COLUMN "target_grade" TYPE INTEGER USING "target_grade"::INTEGER;

-- Fix type: users.grade_level TEXT -> INTEGER
ALTER TABLE "users" ALTER COLUMN "grade_level" TYPE INTEGER USING "grade_level"::INTEGER;

-- Add missing FlexFridayType enum value (schema uses GRADE_SPECIFIC not FRESHMAN_WORKSHOP)
ALTER TYPE "FlexFridayType" ADD VALUE IF NOT EXISTS 'GRADE_SPECIFIC';
