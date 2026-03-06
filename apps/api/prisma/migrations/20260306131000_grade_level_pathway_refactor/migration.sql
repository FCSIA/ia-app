-- CreateEnum
CREATE TYPE "Pathway" AS ENUM ('INFORMATION_TECHNOLOGY', 'HEALTH_SCIENCE', 'ENGINEERING');

-- AlterTable
ALTER TABLE "announcements"
ADD COLUMN "target_grade" INTEGER,
ADD COLUMN "target_pathway" "Pathway";

UPDATE "announcements"
SET
  "target_grade" = CASE
    WHEN "target_type" = 'GRADE' AND "target_value" ~ '^[0-9]+$' THEN "target_value"::INTEGER
    ELSE NULL
  END,
  "target_pathway" = CASE
    WHEN "target_type" = 'PATHWAY' THEN CASE
      WHEN UPPER("target_value") = 'INFORMATION_TECHNOLOGY' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
      WHEN UPPER("target_value") = 'HEALTH_SCIENCE' THEN 'HEALTH_SCIENCE'::"Pathway"
      WHEN UPPER("target_value") = 'ENGINEERING' THEN 'ENGINEERING'::"Pathway"
      WHEN UPPER("target_value") = 'STEM' THEN 'ENGINEERING'::"Pathway"
      WHEN UPPER("target_value") = 'BUSINESS' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
      WHEN UPPER("target_value") = 'ARTS' THEN 'HEALTH_SCIENCE'::"Pathway"
      ELSE NULL
    END
    ELSE NULL
  END;

-- AlterTable
ALTER TABLE "flex_fridays"
ALTER COLUMN "pathway" TYPE "Pathway"
USING CASE
  WHEN "pathway" IS NULL OR "pathway" = '' THEN NULL
  WHEN UPPER("pathway") = 'INFORMATION_TECHNOLOGY' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("pathway") = 'HEALTH_SCIENCE' THEN 'HEALTH_SCIENCE'::"Pathway"
  WHEN UPPER("pathway") = 'ENGINEERING' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("pathway") = 'STEM' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("pathway") = 'BUSINESS' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("pathway") = 'ARTS' THEN 'HEALTH_SCIENCE'::"Pathway"
  ELSE NULL
END;

-- AlterTable
ALTER TABLE "flex_sessions"
ALTER COLUMN "target_pathway" TYPE "Pathway"
USING CASE
  WHEN "target_pathway" IS NULL OR "target_pathway" = '' THEN NULL
  WHEN UPPER("target_pathway") = 'INFORMATION_TECHNOLOGY' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("target_pathway") = 'HEALTH_SCIENCE' THEN 'HEALTH_SCIENCE'::"Pathway"
  WHEN UPPER("target_pathway") = 'ENGINEERING' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("target_pathway") = 'STEM' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("target_pathway") = 'BUSINESS' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("target_pathway") = 'ARTS' THEN 'HEALTH_SCIENCE'::"Pathway"
  ELSE NULL
END,
ALTER COLUMN "target_grade" TYPE INTEGER
USING CASE
  WHEN "target_grade" IS NULL OR "target_grade" = '' THEN NULL
  WHEN "target_grade" ~ '^[0-9]+$' THEN "target_grade"::INTEGER
  ELSE NULL
END;

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "major_pathway" "Pathway",
ADD COLUMN "minor_pathway" "Pathway";

UPDATE "users"
SET "major_pathway" = CASE
  WHEN "pathway" IS NULL OR "pathway" = '' THEN NULL
  WHEN UPPER("pathway") = 'INFORMATION_TECHNOLOGY' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("pathway") = 'HEALTH_SCIENCE' THEN 'HEALTH_SCIENCE'::"Pathway"
  WHEN UPPER("pathway") = 'ENGINEERING' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("pathway") = 'STEM' THEN 'ENGINEERING'::"Pathway"
  WHEN UPPER("pathway") = 'BUSINESS' THEN 'INFORMATION_TECHNOLOGY'::"Pathway"
  WHEN UPPER("pathway") = 'ARTS' THEN 'HEALTH_SCIENCE'::"Pathway"
  ELSE NULL
END;

ALTER TABLE "users"
DROP COLUMN "pathway",
ALTER COLUMN "grade_level" TYPE INTEGER
USING CASE
  WHEN "grade_level" IS NULL OR "grade_level" = '' THEN NULL
  WHEN "grade_level" ~ '^[0-9]+$' THEN "grade_level"::INTEGER
  ELSE NULL
END;
