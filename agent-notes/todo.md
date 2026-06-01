# Priority Tasks (todo.md)

1. [ ] **Discrete Schema Validation**: Audit `schema.prisma` to verify `Club`, `FlexFriday`, and `StudentSchedule` are structured to strongly type their relationships without overlapping abstractions.
2. [ ] **Add Flex Session Enhancements**: Add explicit columns/relations for `resources` and `attendance` tracking to `FlexSession` in Prisma schema if they don't exist yet.
3. [ ] **Channel and Announcement Split**: Ensure the Prisma schema cleanly separates Text Channels (audit-heavy) from Announcement Channels (All-admin, Pathway).
4. [ ] **Teacher Dashboard Prep**: Establish the backend structure for the check-in and pass system for future releases. 
5. [ ] **UI Alignment**: Adjust the web/mobile app routes and TanStack Query usages to conform to discrete APIs for Clubs vs Flex Fridays.
6. [ ] **Push Notifications**: Design the idiomatic web push path for channel tag notifications when a user enables them: service worker + Push API + VAPID/web-push provider, Convex-stored push subscriptions, notification preference enforcement, click deep-links to the club/channel/message, and a separate native push path for mobile. Do not rely on background tab polling for closed-tab delivery.



1. Allow string values for club roles, clubs may have different types of leaders so they should be able create new ones.
2.

spotify-wrapped thing
