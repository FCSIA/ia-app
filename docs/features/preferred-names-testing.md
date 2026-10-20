# Preferred-name test checklist

Use an isolated local deployment. This verification used
[localhost:3004](http://localhost:3004/profile) with backend ports 3270/3271.
The seeded student account is `STU001` / `STU001STU001` (Alex Johnson).
The seeded super-admin account is `SUPER001` / `STU001STU001`.
These credentials are for the local demo only. Use a separate browser session
for the observer account so you can keep both accounts signed in.

## Set, replace, and clear

1. Open **Profile & Settings**. With the field blank, the header and profile
   show Alex Johnson and the avatar fallback shows AJ.
2. Enter `  Lex   QA  ` in **Preferred name (optional)** and save. Expect
   `Lex QA` after saving and reloading; the header, profile, and initials use
   Lex QA / LQ. The preferred name is the complete display name.
3. Change it to `Lex Two`. Expect the new name throughout the app and in
   results; the old preferred name should stop matching people searches.
4. Clear the field and save. Expect Alex Johnson / AJ everywhere again.
   Whitespace-only input also clears the preference.
5. Try a single-word name and a name with accented or non-Latin characters.
   Expect the exact name after whitespace normalization. The input accepts
   up to 80 characters; the backend also enforces that limit.

Repeat the following scenarios with the name set and after clearing it.
Use **Lex QA** as the preferred name for easy comparison. Names entered in
free-form message bodies are content and are not rewritten by a profile edit.

## Places to inspect

| Scenario | How to test | Expected result |
| --- | --- | --- |
| Own identity | Profile & Settings, top-right account menu, Dashboard greeting | Preferred name; the profile shows the regular name directly below when different. With no preference, regular full name and the established first-name greeting |
| Other people's identity | As another club member, open Robotics Club → People and Overview; click Alex's avatar or hover a chat author | Preferred name and initials in rows and member lists. Profile dialogs and hover previews show the regular name below the preferred name when different |
| Directory search | Robotics Club → People: search `Alex Johnson`, then `Lex QA`, then `STU001` | Each finds the same account, displayed as Lex QA |
| Global search | Another user: open Search everything / Ctrl+K; search both names | Both find the same person under Lex QA (own-account results may be excluded) |
| Existing chat | Robotics Club → #general: inspect Alex's existing message; open its profile, thread, reply preview, pinned-message list, or reaction list where applicable | Current preferred name on identity labels, even for older messages |
| New chat and replies | Post a local test message, reply in a thread, react as Alex; inspect from another member | Preferred name while sending, after delivery, in threads, and in reactor lists |
| Chat search | Open Search #general and search the regular and preferred names | Alex's loaded messages match either name |
| Mentions | Another member: type `@Alex`, then `@Lex`; select the suggestion | Same account suggested with the preferred display name; mention targets the account ID |
| Club invitations and assignments | As a sponsor/admin, open an invite or member picker; search both names. For bulk unit assignment CSVs, match the regular or preferred name | Same account found; preferred name displayed; ambiguous names still require resolution |
| Schedules and friends | Add/find Alex from the Schedule friend search using each name; inspect friend cards, friend dialog, group members, and a share-link preview | Preferred name on each identity label |
| Calendar | Share a calendar item with Alex or view an item shared by Alex; inspect sharing controls and event details | Preferred name for the sharing person and selected people |
| Announcements and comments | Have the renamed account publish an announcement (with a permitted role) or comment; inspect lists, detail, dashboard widget, and author search | Preferred author/comment name; author search matches either name |
| Events | Using an account permitted to create events, set a preferred name, then inspect event author and sponsor labels | Preferred name for each person |
| Flex Friday | Inspect Alex's pass; as permitted staff, inspect attendance rows | Preferred name for the student |
| Notifications | After setting a preferred name, trigger a local reply/mention, friend request, invitation, or feedback response; inspect recipient notifications | Newly generated text uses the preferred name; delivered historical text retains its original wording |
| Admin and moderation | As SUPER001, search Users by both names; inspect user details, permissions, feedback/moderation submitter and response labels | Preferred name shown, both names searchable, normal account IDs unchanged |
| Audit | As SUPER001, inspect an event authored by the renamed account and search/filter its actor by either name | Current preferred actor name; both names match actor search |
| Wrapped | In its availability window with snapshot data, inspect own greeting and top-mentioned person | Current preferred name, including an already-saved snapshot |
| Native app | Repeat settings, header, dashboard, clubs, chat/mentions, announcements, events/calendar, Flex, and admin scenarios in the native client | Same naming and search rules as web |
| Account isolation | Change STU001's preference, then sign in as another account | Only STU001's profile changed; login credentials and regular roster names remain intact |

## Verification performed

Backend tests exercise identity guards, persistence, clear/replace, atomic search
updates, global/friend/admin/invitation searches, existing-message authors, full
regular/preferred audit-actor searches, Unicode initials, and the safe shared
announcement/comment author projection.
Client tests cover directory search, native mentions, announcement author search,
and optimistic chat author names. Web production compilation and all three
TypeScript projects are checked. Signed-in browser checks cover normalized save,
reload persistence, regular-name disclosure, header/avatar initials, and clearing
the preference on the isolated demo account. Native device interaction and
design-owner visual review remain outstanding.
