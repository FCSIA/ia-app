---
tags: [feature, courses, academics]
---

# Courses (Academic Catalog)

← [[index|Home]]

---

## Overview

The Course feature provides a centralized, searchable catalog of every academic class offered at the school. It replaces the disparate PDF course catalogs and integrates directly into the student schedule builder.

**Files:**
- Legacy Backend: `apps/api/src/courses/`
- Convex: `apps/convex/src/courses.ts`
- Seed fixtures: `apps/convex/seed-data/courses.ts`
- Web: `apps/web/src/app/courses/`
- Database: [[schema#Course]]

---

## Catalog Sources

Courses are imported from two primary sources (indicated by the `catalogSource` enum):
- `COURSE_CATALOG`: Standard high school course offerings.
- `AP_CATALOG`: Specialized Advanced Placement courses.
- `MERGED`: Cases where the same course exists in both systems.

---

## Data Model

Key fields on the `Course` model:
- `slug`: URL-friendly identifier (e.g., `ap-computer-science-a`).
- `courseNumbers`: Array of school-specific course codes (e.g. `1234567`).
- `pathway`: Links the course to one of the 3 academic pathways.
- `minGrade` / `maxGrade`: Controls eligibility in the search UI.
- `prerequisitesText`: Descriptive text for student requirements.

---

## Searching and Filtering

The Convex `courses` functions provide the active course-catalog read path:
- **Search**: Matches against title, department, slug, and course numbers.
- **Grade Filtering**: Automatically hides courses the student is ineligible for.
- **Pathway Filtering**: Allows students to see what specific classes fulfill their diploma requirements.

For the current seeded catalog size, Convex reads a bounded candidate set and
filters in TypeScript. Before importing a much larger real catalog, move search
to `search_courses` and keep department/pathway filters indexed.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| Convex | `api.courses.list` | List courses with search and filters |
| Convex | `api.courses.getOne` | Detailed course profile by slug |
| Convex | `api.courses.seedFromStaticData` | Seed/reset the Convex course catalog from app fixtures |

---

## Integration

The Course catalog is a fundamental dependency for:
1. **Schedule Builder**: Students select from the official `Course` list to build their timetable.
2. **Pathways View**: (Future) Tracking graduation progress.

---

## Related

- [[schedule]] — Where courses are used to build student calendars
- [[schema]] — The Course database model
