---
tags: [feature, courses, academics]
---

# Courses

[Home](../index.md)

Courses provide the official academic catalog used by the schedule builder and
course browsing pages.

## What It Does

- Lists and searches catalog courses.
- Supports grade, department, pathway, and course-number filtering.
- Provides detail pages by slug.
- Seeds demo catalog data from Convex-owned fixtures.

## Source Files

- Backend: `apps/convex/src/courses/`
- Seed fixtures: `apps/convex/src/seeddata/courses.ts`
- Web routes: `apps/web/src/app/courses/`
- Course picker: `apps/web/src/components/courses/course-picker.tsx`

## Convex Surface

- `api.courses.catalog.list`
- `api.courses.catalog.listPage`
- `api.courses.catalog.get`
- `api.courses.seed.run`

## Data Model

`courses` stores title, slug, department, course numbers, pathway, term,
eligibility grades, prerequisites text, and source metadata.

## Search

The schema includes `search_courses`. Current UI paths also use bounded reads
and TypeScript filtering for seeded/demo data. Use the search index for larger
real catalogs.

## Related

- [Schedule](schedule.md)
- [Schema map](../database/schema-map.md)
