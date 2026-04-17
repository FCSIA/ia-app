# Priority Tasks (todo.md)

1. [ ] **Discrete Schema Validation**: Audit `schema.prisma` to verify `Club`, `FlexFriday`, and `StudentSchedule` are structured to strongly type their relationships without overlapping abstractions.
2. [ ] **Add Flex Session Enhancements**: Add explicit columns/relations for `resources` and `attendance` tracking to `FlexSession` in Prisma schema if they don't exist yet.
3. [ ] **Channel and Announcement Split**: Ensure the Prisma schema cleanly separates Text Channels (audit-heavy) from Announcement Channels (All-admin, Pathway).
4. [ ] **Teacher Dashboard Prep**: Establish the backend structure for the check-in and pass system for future releases. 
5. [ ] **UI Alignment**: Adjust the web/mobile app routes and TanStack Query usages to conform to discrete APIs for Clubs vs Flex Fridays.
