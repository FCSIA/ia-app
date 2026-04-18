---
tags: [feature, courses, academics]
---

# Courses (Academic Catalog)

← [[index|Home]]

---

## Overview

The Course feature provides a centralized, searchable catalog of every academic class offered at the school. It replaces the disparate PDF course catalogs and integrates directly into the student schedule builder.

**Files:**
- Backend: `apps/api/src/courses/`
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

The `CoursesService` provides a high-performance fuzzy search and filtering engine:
- **Search**: Matches against title, department, slug, and course numbers.
- **Grade Filtering**: Automatically hides courses the student is ineligible for.
- **Pathway Filtering**: Allows students to see what specific classes fulfill their diploma requirements.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/courses` | List courses with fuzzy search and filters |
| GET | `/courses/:slug` | Detailed course profile |

---

## Integration

The Course catalog is a fundamental dependency for:
1. **Schedule Builder**: Students select from the official `Course` list to build their timetable.
2. **Pathways View**: (Future) Tracking graduation progress.

---

## Related

- [[schedule]] — Where courses are used to build student calendars
- [[schema]] — The Course database model
