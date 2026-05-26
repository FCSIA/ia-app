---
tags: [database, schema, convex]
---

# Schema Map

[Home](../index.md)

The active schema is `apps/convex/src/schema.ts`. Convex automatically adds
`_id` and `_creationTime` to every document.

## Identity and Admin

- `users`
- `auditEvents`

Better Auth component tables live under the installed component schema in
`apps/convex/src/betterAuth`.

## Notifications

- `notificationDeliveries`
- `notificationPreferences`

## Academics and Schedule

- `courses`
- `studentSchedules`
- `studentScheduleEntries`
- `studentScheduleFriends`
- `schoolDayBlocks`

## Announcements

- `announcements`
- `comments`
- `announcementReads`
- `announcementBookmarks`

## Clubs and Channels

- `clubs`
- `clubMembers`
- `clubSponsors`
- `clubInvites`
- `clubJoinRequests`
- `clubChannels`
- `clubChannelMemberships`
- `clubTags`
- `clubTagMembers`
- `clubChannelMessages`
- `clubChannelMessagePollVotes`
- `clubChannelMessageAttachments`
- `clubChannelMessageReactions`
- `clubChannelMessageMentions`

## Events and Calendar

- `eventCategories`
- `events`
- `eventApprovals`
- `calendarEntries`

## Flex Friday

- `flexFridays`
- `flexSessions`
- `flexWorkshops`
- `flexWorkshopSessions`
- `flexRegistrations`
- `flexAssignments`
- `flexAttendances`

## Safety and Analytics

- `moderationKeywordRules`
- `moderationReports`
- `wrappedSnapshots`

## Modeling Rules

- Store references as `v.id("table")`.
- Keep child collections in separate tables instead of unbounded arrays on a
  parent document.
- Use numeric timestamps for app times.
- Add indexes for every hot query path.
- Enforce uniqueness and cascade behavior in mutations.

## Related

- [Indexes and search](indexes-and-search.md)
- [Data evolution](data-evolution.md)
- [Convex overview](../backend/convex-overview.md)
