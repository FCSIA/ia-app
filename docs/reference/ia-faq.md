---
tags: [reference, product, ia]
---

# IA Product FAQ

[Home](../index.md)

This page captures school-context notes used by product copy, seed data, and
feature decisions. Verify policy-sensitive details with Innovation Academy or
Fulton County Schools before shipping them as official guidance.

## Flex Friday

Flex Friday is a recurring STEM workshop model aligned to IA pathways. Students
use it to attend pathway workshops, complete required enrichment, and track
credit toward magnet expectations.

Common product implications:

- Students need a clear way to browse upcoming Flex Fridays.
- Registration and assignment states must be visible before the event.
- Attendance and credit tracking should be easy for staff to audit.
- Off-campus or asynchronous days still need clear status messaging.

FAQ:

- How many credits are expected? Current working copy says 12 per school year.
- How does a student sign up? Through the IA event/Flex Friday portal flow.
- Who manages questions? The school Flex Friday coordinator or staff owner.

## Academics and Pathways

Innovation Academy is STEM-focused with three primary pathways:

- Information Technology
- Health Science
- Engineering

Freshmen take an introductory GT Block before selecting a primary pathway.
Students may also pursue minors or additional pathway coursework depending on
school rules.

Product implications:

- Student profiles need grade, major pathway, and minor pathway fields.
- Announcements, courses, events, and Flex Friday sessions may target pathway or
  grade groups.
- Course browsing should make pathway and grade eligibility obvious.

## Projects and Research

IA emphasizes capstone-style research and project work. Product copy may refer
to:

- Pinnacle Project,
- AP Seminar,
- AP Research,
- science fair or research presentation workflows.

These are useful context for future portfolio, showcase, or event features.

## Course Offerings and Credits

The app should treat the Convex course catalog as the product source of truth
for in-app schedule building. Graduation policy, weighting, and official course
requirements should be verified from school sources before being encoded in
eligibility logic.

Product implications:

- Keep official course numbers with course records.
- Preserve prerequisites text for student decision-making.
- Use grade and pathway filters as guidance, not a replacement for counselor
  review.

## Daily Schedule

IA has regular school-day blocks, special schedules, club-week behavior, and
Flex Friday schedules. The schedule feature should model bell blocks as data
rather than hard-coded time assumptions.

Product implications:

- Admins need to edit blocks without code changes.
- Students need a simple current-block view.
- Special days should eventually be handled explicitly instead of inferred from
  weekday alone.

## Attendance, Arrival, and IDs

School policy commonly covers attendance thresholds, excused absences, late
arrival, student IDs/lanyards, and front-office procedures. These are important
for future handbook or notification features but should not be hard-coded from
this reference page alone.

## Student Life and Clubs

IA clubs cover academic, technical, service, cultural, arts, and interest-based
groups. Product implications:

- Every club should have sponsor oversight.
- Students need clear join flows.
- Sponsors and leaders need manageable communication channels.
- Club events and announcements need approval paths where school policy requires
  them.

## Athletics and Competitions

IA's school activities include eSports and many academic or technical
competitions. Traditional athletics may involve students' zoned high schools.

Use this context for event categories and club examples, but verify official
eligibility and transportation details before publishing.

## Support Resources

Counseling, college/career support, the media center/eXchange, health office,
and volunteer processes are useful future domains. They are not currently core
Convex feature areas.

Potential future features:

- counselor announcements,
- college visit calendar,
- eXchange booking,
- volunteer onboarding,
- student support resource directory.
