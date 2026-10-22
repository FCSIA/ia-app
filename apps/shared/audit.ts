import { displayName, nameSearchValues } from './user-name';

/** Plain-language labels and search grammar shared by the audit backend and UI. */
export function auditLabel(value: string): string {
  const words = value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
const RECORD_LABELS: Record<string, string> = {
  clubchannelmessage: 'Message',
  clubchannel: 'Channel',
  clubwhiteboard: 'Whiteboard',
  clubunit: 'Club group',
  clubpeoplegroup: 'People group',
  clubjoinrequest: 'Club join request',
  studentschedule: 'Student schedule',
  studentschedulegroup: 'Schedule group',
  studentfriendsharelink: 'Schedule sharing link',
  flexfriday: 'Flex Friday',
  flexsession: 'Flex session',
  flexworkshop: 'Workshop',
  flexregistration: 'Workshop registration',
  flexassignment: 'Workshop assignment',
  flexattendance: 'Attendance',
  authaccount: 'Sign-in account',
  keywordrule: 'Moderation keyword',
  user: 'Person',
};
export function auditRecordLabel(type: string): string {
  return (
    RECORD_LABELS[type.replace(/[_\s]/g, '').toLowerCase()] ?? auditLabel(type)
  );
}
export const AUDIT_CATEGORIES = {
  "people-access": "People & access",
  "clubs-chat": "Clubs & chat",
  announcements: "Announcements",
  moderation: "Moderation",
  schedules: "Schedules",
  "flex-events": "Flex & events",
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const auditEntityKey = (type: string) => type.replace(/[_\s]/g, '').toLowerCase();
/** Known stored spellings share one semantic filter without rewriting history. */
export const AUDIT_ENTITY_TYPES = ['User', 'authAccount', 'Club', 'ClubChannel', 'ClubChannelMessage', 'ClubWhiteboard', 'ClubUnit', 'ClubPeopleGroup', 'ClubJoinRequest', 'Announcement', 'Comment', 'Report', 'KeywordRule', 'StudentSchedule', 'StudentScheduleGroup', 'StudentFriendShareLink', 'SchoolDayBlock', 'SchoolDayTemplate', 'SchoolDayDateOverride', 'SchoolScheduleSettings', 'FlexFriday', 'FlexSession', 'FlexWorkshop', 'FlexRegistration', 'FlexAssignment', 'FlexAttendance', 'Event', 'user', 'club', 'studentSchedule', 'studentScheduleGroup', 'studentFriendShareLink', 'schoolDayBlock', 'schoolDayTemplate', 'schoolDayDateOverride', 'schoolScheduleSettings', 'FLEX_FRIDAY', 'FLEX_SESSION', 'FLEX_WORKSHOP', 'FLEX_REGISTRATION', 'FLEX_ASSIGNMENT', 'FLEX_ATTENDANCE', 'EVENT'] as const;
export const AUDIT_ACTIONS: Record<string, { label: string; category: AuditCategory; destructive?: boolean }> = {
  "ADMINISTRATOR_CSV_IMPORT": { label: "Imported administrators from CSV", category: "people-access" },
  "ANNOUNCEMENT_APPROVED": { label: "Approved announcement", category: "announcements" },
  "ANNOUNCEMENT_ARCHIVED": { label: "Archived announcement", category: "announcements" },
  "ANNOUNCEMENT_COMMENT_ADDED": { label: "Added announcement comment", category: "announcements" },
  "ANNOUNCEMENT_COMMENT_DELETED": { label: "Deleted announcement comment", category: "announcements", destructive: true },
  "ANNOUNCEMENT_CREATED": { label: "Created announcement", category: "announcements" },
  "ANNOUNCEMENT_REJECTED": { label: "Rejected announcement", category: "announcements", destructive: true },
  "AUTO_MODERATION_FLAGGED": { label: "Flagged content for moderation", category: "moderation" },
  "CLUB_BULK_STRUCTURE_ASSIGNMENTS_APPLIED": { label: "Assigned club structure in bulk", category: "clubs-chat" },
  "CLUB_CHANNEL_CREATED": { label: "Created club channel", category: "clubs-chat" },
  "CLUB_CHANNEL_MESSAGE_DELETED": { label: "Deleted a message", category: "clubs-chat", destructive: true },
  "CLUB_CHANNEL_MESSAGE_PINNED": { label: "Pinned a message", category: "clubs-chat" },
  "CLUB_CHANNEL_MESSAGE_POSTED": { label: "Posted a message", category: "clubs-chat" },
  "CLUB_CHANNEL_MESSAGE_REACTION_ADDED": { label: "Added a reaction", category: "clubs-chat" },
  "CLUB_CHANNEL_MESSAGE_REACTION_REMOVED": { label: "Removed a reaction", category: "clubs-chat", destructive: true },
  "CLUB_CHANNEL_MESSAGE_UNPINNED": { label: "Unpinned a message", category: "clubs-chat" },
  "CLUB_CHANNEL_MESSAGE_UPDATED": { label: "Edited a message", category: "clubs-chat" },
  "CLUB_CHANNEL_WHITEBOARDS_DISABLED": { label: "Disabled channel whiteboards", category: "clubs-chat" },
  "CLUB_CHANNEL_WHITEBOARDS_ENABLED": { label: "Enabled channel whiteboards", category: "clubs-chat" },
  "CLUB_CREATED": { label: "Created club", category: "clubs-chat" },
  "CLUB_DEACTIVATED": { label: "Deactivated club", category: "clubs-chat" },
  "CLUB_DELETED": { label: "Deleted club", category: "clubs-chat", destructive: true },
  "CLUB_DELETION_STARTED": { label: "Started club deletion", category: "clubs-chat" },
  "CLUB_INVITES_BULK_IMPORTED": { label: "Imported club invitations", category: "clubs-chat" },
  "CLUB_JOINED": { label: "Joined club", category: "clubs-chat" },
  "CLUB_JOIN_CODE_GENERATED": { label: "Generated club join code", category: "clubs-chat" },
  "CLUB_JOIN_CODE_REDEEMED": { label: "Redeemed club join code", category: "clubs-chat" },
  "CLUB_JOIN_CODE_REVOKED": { label: "Revoked club join code", category: "clubs-chat", destructive: true },
  "CLUB_JOIN_REQUEST_APPROVED": { label: "Approved club join request", category: "clubs-chat" },
  "CLUB_JOIN_REQUEST_DECLINED": { label: "Declined club join request", category: "clubs-chat", destructive: true },
  "CLUB_MEMBERS_BULK_ADDED_DIRECTLY": { label: "Added club members in bulk", category: "clubs-chat" },
  "CLUB_MEMBER_ADDED_DIRECTLY": { label: "Added a club member", category: "clubs-chat" },
  "CLUB_MEMBER_REMOVED": { label: "Removed club member", category: "clubs-chat", destructive: true },
  "CLUB_MEMBER_ROLES_BULK_SET": { label: "Set club member roles in bulk", category: "clubs-chat" },
  "CLUB_MEMBER_ROLE_SET": { label: "Set a club member role", category: "clubs-chat" },
  "CLUB_PEOPLE_GROUP_CREATED": { label: "Created club people group", category: "clubs-chat" },
  "CLUB_PEOPLE_GROUP_DELETED": { label: "Deleted club people group", category: "clubs-chat", destructive: true },
  "CLUB_PEOPLE_GROUP_UPDATED": { label: "Updated club people group", category: "clubs-chat" },
  "CLUB_ROLE_CREATED": { label: "Created club role", category: "clubs-chat" },
  "CLUB_ROLE_DIRECTORY_VISIBILITY_UPDATED": { label: "Updated club role directory visibility", category: "clubs-chat" },
  "CLUB_ROLE_PERMISSIONS_UPDATED": { label: "Updated club role permissions", category: "clubs-chat" },
  "CLUB_ROLE_REMOVED": { label: "Removed club role", category: "clubs-chat", destructive: true },
  "CLUB_ROLE_RENAMED": { label: "Renamed club role", category: "clubs-chat" },
  "CLUB_UNITS_BULK_CREATED": { label: "Created club groups in bulk", category: "clubs-chat" },
  "CLUB_UNIT_ARCHIVED": { label: "Archived club group", category: "clubs-chat" },
  "CLUB_UNIT_CREATED": { label: "Created club group", category: "clubs-chat" },
  "CLUB_UNIT_JOINED": { label: "Joined club group", category: "clubs-chat" },
  "CLUB_UNIT_JOIN_CODE_ROTATED": { label: "Rotated club group join code", category: "clubs-chat" },
  "CLUB_UNIT_MEMBERS_BULK_SET": { label: "Set group members in bulk", category: "clubs-chat" },
  "CLUB_UNIT_MEMBER_REMOVED": { label: "Removed club group member", category: "clubs-chat", destructive: true },
  "CLUB_UNIT_MEMBER_SET": { label: "Set a group member", category: "clubs-chat" },
  "CLUB_UNIT_UPDATED": { label: "Updated club group", category: "clubs-chat" },
  "CLUB_UPDATED": { label: "Updated club", category: "clubs-chat" },
  "CLUB_WHITEBOARD_ARCHIVED": { label: "Archived club whiteboard", category: "clubs-chat" },
  "CLUB_WHITEBOARD_CREATED": { label: "Created club whiteboard", category: "clubs-chat" },
  "CLUB_WHITEBOARD_EDITED": { label: "Edited whiteboard", category: "clubs-chat" },
  "CLUB_WHITEBOARD_RENAMED": { label: "Renamed club whiteboard", category: "clubs-chat" },
  "CLUB_WHITEBOARD_RESTORED": { label: "Restored club whiteboard", category: "clubs-chat" },
  "CLUB_WHITEBOARD_UNARCHIVED": { label: "Unarchived whiteboard", category: "clubs-chat" },
  "EVENT_APPROVED": { label: "Approved event", category: "flex-events" },
  "EVENT_CANCELLED": { label: "Cancelled event", category: "flex-events" },
  "EVENT_CREATED": { label: "Created event", category: "flex-events" },
  "EVENT_REJECTED": { label: "Rejected event", category: "flex-events", destructive: true },
  "FEEDBACK_GITHUB_ISSUE_CREATED": { label: "Created feedback GitHub issue", category: "moderation" },
  "FEEDBACK_GITHUB_ISSUE_FAILED": { label: "Failed feedback GitHub issue", category: "moderation" },
  "FEEDBACK_GITHUB_ISSUE_RETRY_QUEUED": { label: "Queued feedback GitHub issue retry", category: "moderation" },
  "FEEDBACK_GITHUB_ISSUE_STATE_SYNCED": { label: "Synced feedback GitHub issue state", category: "moderation" },
  "FEEDBACK_RESPONSE_ADDED": { label: "Added feedback response", category: "moderation" },
  "FLEX_ATTENDANCE_CLEARED": { label: "Cleared attendance", category: "flex-events" },
  "FLEX_ATTENDANCE_MARKED": { label: "Recorded attendance", category: "flex-events" },
  "FLEX_FRIDAY_CREATED": { label: "Created Flex Friday", category: "flex-events" },
  "FLEX_REGISTRATION_REMOVED": { label: "Removed a workshop registration", category: "flex-events", destructive: true },
  "FLEX_SESSION_CREATED": { label: "Created Flex session", category: "flex-events" },
  "FLEX_SESSION_DELETED": { label: "Deleted Flex session", category: "flex-events", destructive: true },
  "FLEX_SESSION_UPDATED": { label: "Updated Flex session", category: "flex-events" },
  "FLEX_WORKSHOP_ASSIGNED": { label: "Assigned a workshop", category: "flex-events" },
  "FLEX_WORKSHOP_CREATED": { label: "Created a workshop", category: "flex-events" },
  "FLEX_WORKSHOP_DELETED": { label: "Deleted a workshop", category: "flex-events", destructive: true },
  "FLEX_WORKSHOP_REGISTERED": { label: "Registered for a workshop", category: "flex-events" },
  "FLEX_WORKSHOP_UPDATED": { label: "Updated a workshop", category: "flex-events" },
  "KEYWORD_ADDED": { label: "Added keyword", category: "moderation" },
  "KEYWORD_REMOVED": { label: "Removed keyword", category: "moderation", destructive: true },
  "REPORT_SUBMITTED": { label: "Submitted report", category: "moderation" },
  "REPORT_UPDATED": { label: "Updated report", category: "moderation" },
  "RESTORE": { label: "Restore", category: "people-access" },
  "USER_CSV_BULK_UPDATED": { label: "Updated people from CSV", category: "people-access" },
  "USER_CSV_IMPORT": { label: "Imported people from CSV", category: "people-access" },
  "USER_DEVELOPER_STATUS_UPDATED": { label: "Updated user developer status", category: "people-access" },
  "USER_FEEDBACK_REVIEW_ACCESS_UPDATED": { label: "Updated user feedback review access", category: "people-access" },
  "auth.login_locked": { label: "Temporarily locked sign-in", category: "people-access" },
  "auth.login_unlocked": { label: "Unlocked sign-in", category: "people-access" },
  "club.unit_channel_defaults_updated": { label: "Updated club group channel defaults", category: "clubs-chat" },
  "club.unit_channels_created": { label: "Created club group channels", category: "clubs-chat" },
  "impersonation.requested": { label: "Requested impersonation", category: "people-access" },
  "schedule.friend_accepted": { label: "Accepted schedule friend", category: "schedules" },
  "schedule.friend_link_auto_accepted": { label: "Accepted schedule sharing automatically", category: "schedules" },
  "schedule.friend_link_created": { label: "Created schedule friend link", category: "schedules" },
  "schedule.friend_link_requested": { label: "Requested schedule friend link", category: "schedules" },
  "schedule.friend_link_revoked": { label: "Revoked schedule friend link", category: "schedules", destructive: true },
  "schedule.friend_removed": { label: "Removed schedule friend", category: "schedules" },
  "schedule.friend_requested": { label: "Requested schedule friend", category: "schedules" },
  "schedule.group_created": { label: "Created schedule group", category: "schedules" },
  "schedule.group_deleted": { label: "Deleted schedule group", category: "schedules", destructive: true },
  "schedule.updated": { label: "Updated a schedule", category: "schedules" },
  "schoolDayBlock.created": { label: "Created school day block", category: "schedules" },
  "schoolDayBlock.deleted": { label: "Deleted school day block", category: "schedules", destructive: true },
  "schoolDayBlock.updated": { label: "Updated school day block", category: "schedules" },
  "schoolDayDateOverride.applied_template": { label: "Applied a day template", category: "schedules" },
  "schoolDayDateOverride.created": { label: "Created school day date override", category: "schedules" },
  "schoolDayDateOverride.reset": { label: "Reset school day date override", category: "schedules" },
  "schoolDayDateOverride.unlinked_template": { label: "Unlinked a day template", category: "schedules" },
  "schoolDayDateOverride.updated": { label: "Updated school day date override", category: "schedules" },
  "schoolDayTemplate.created": { label: "Created school day template", category: "schedules" },
  "schoolDayTemplate.deleted": { label: "Deleted school day template", category: "schedules", destructive: true },
  "schoolDayTemplate.set_regular": { label: "Set the regular day template", category: "schedules" },
  "schoolDayTemplate.updated": { label: "Updated school day template", category: "schedules" },
  "schoolScheduleSettings.academic_year_configured": { label: "Configured the academic year", category: "schedules" },
  "user.activated": { label: "Activated user", category: "people-access" },
  "user.bulk_deleted": { label: "Deleted people in bulk", category: "people-access", destructive: true },
  "user.created": { label: "Created user", category: "people-access" },
  "user.deactivated": { label: "Deactivated user", category: "people-access", destructive: true },
  "user.legacy_credential_rotated": { label: "Rotated user legacy credential", category: "people-access" },
  "user.password_changed": { label: "Changed password", category: "people-access" },
  "user.password_reset": { label: "Reset user password", category: "people-access" },
  "user.roles_assigned": { label: "Assigned user roles", category: "people-access" },
};
/** Legacy rows are classified by the same semantics as new writes. */
export function auditCategory(entityType: string, action?: string): AuditCategory {
  if (action && AUDIT_ACTIONS[action]) return AUDIT_ACTIONS[action].category;
  const type = entityType.replace(/[_\s]/g, "").toLowerCase();
  if (type.startsWith("flex") || type === "event") return "flex-events";
  if (type.startsWith("club")) return "clubs-chat";
  if (["announcement", "comment"].includes(type)) return "announcements";
  if (["report", "keywordrule"].includes(type)) return "moderation";
  if (type.includes("schedule") || type.startsWith("schoolday")) return "schedules";
  return "people-access";
}
export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action]?.label ?? auditLabel(action);
}
export function isFlexAudit(entityType: string): boolean {
  const type = entityType.replace(/[_\s]/g, '').toLowerCase();
  return type.startsWith('flex') || type === 'event';
}
export type AuditSearchField =
  | 'text'
  | 'person'
  | 'action'
  | 'type'
  | 'record'
  | 'source'
  | 'after'
  | 'before';
export type AuditSearchTerm = {
  field: AuditSearchField;
  value: string;
  exclude: boolean;
};
export type AuditSearchResult = {
  terms: AuditSearchTerm[];
  error: string | null;
};
const SEARCH_FIELDS = new Set([
  'text',
  'person',
  'action',
  'type',
  'record',
  'source',
  'after',
  'before',
]);
/** AND-only, case-insensitive substring search. Quoted values support spaces. */
export function parseAuditSearch(input: string): AuditSearchResult {
  const terms: AuditSearchTerm[] = [];
  const fail = (error: string): AuditSearchResult => ({ terms: [], error });
  if (input.length > 2000)
    return fail('Keep the query under 2,000 characters.');
  // Do not backtrack an unterminated field phrase into a plain `person:`
  // token: that would incorrectly report a missing separator at its quote.
  const pattern = /(-?)(?:([a-zA-Z]+):)?("(?:[^"\\]|\\["\\])*"|(?!-?[a-zA-Z]+:")[^\s"]+)/gy;
  let position = 0;
  while (position < input.length) {
    if (/\s/.test(input[position]!)) {
      position++;
      continue;
    }
    pattern.lastIndex = position;
    const match = pattern.exec(input);
    if (!match) return fail('Close each quoted value with a double quote.');
    position = pattern.lastIndex;
    if (position < input.length && !/\s/.test(input[position]!))
      return fail('Separate filters with a space.');
    const field = (match[2]?.toLowerCase() ?? 'text') as AuditSearchField;
    if (!SEARCH_FIELDS.has(field))
      return fail(
        `Unknown field "${field}". Use person, action, type, record, source, after, before, or text.`,
      );
    const raw = match[3]!;
    const value = (
      raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(["\\])/g, '$1') : raw
    ).trim();
    if (!value || (field === 'text' && /^[a-z]+:$/i.test(value)))
      return fail('Enter a value after each field name.');
    if (
      field === 'source' &&
      !['person', 'system'].includes(value.toLowerCase())
    )
      return fail('Source must be person or system.');
    if (field === 'after' || field === 'before') {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        return fail('Use a real date in YYYY-MM-DD format.');
    }
    terms.push({ field, value, exclude: match[1] === '-' });
    if (terms.length > 30) return fail('Use at most 30 search terms.');
  }
  return { terms, error: null };
}
export type SearchableAuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  createdAt: string;
  meta?: unknown;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    uniqueId: string;
  } | null;
  context?: {
    title: string;
    subtitle: string | null;
    references: { id: string; label: string; name: string }[];
    links?: { id: string; label: string; name: string; href: string | null }[];
  } | null;
};
export function isAuditSystem(event: SearchableAuditEvent): boolean {
  const meta = event.meta && typeof event.meta === 'object' ? event.meta as Record<string, unknown> : {};
  return !event.actorId && !event.actor && (meta.auditSource === 'system' || ['auth.login_locked', 'user.legacy_credential_rotated', 'FEEDBACK_GITHUB_ISSUE_CREATED', 'FEEDBACK_GITHUB_ISSUE_FAILED', 'FEEDBACK_GITHUB_ISSUE_STATE_SYNCED'].includes(event.action));
}
export function auditPersonName(event: SearchableAuditEvent): string {
  return event.actor
    ? displayName(event.actor)
    : event.actorId
      ? 'Former user (name unavailable)'
      : isAuditSystem(event) ? 'System' : 'Unknown (not recorded)';
}
export function matchesAuditSearch(
  event: SearchableAuditEvent,
  terms: AuditSearchTerm[],
): boolean {
  const person = [
    auditPersonName(event),
    ...nameSearchValues(event.actor),
    event.actor?.uniqueId,
    event.actor?.id,
    event.actorId,
  ]
    .filter(Boolean)
    .join(' ');
  const action = `${event.action} ${auditLabel(event.action)} ${auditActionLabel(event.action)}`;
  const type = `${event.entityType} ${auditLabel(event.entityType)} ${auditRecordLabel(event.entityType)}`;
  const record = [
    event.entityId,
    event.context?.title,
    event.context?.subtitle,
    ...(event.context?.references.map((r) => `${r.name} ${r.id}`) ?? []),
  ].join(' ');
  const fields = {
    person,
    action,
    type,
    record,
    source: event.actorId || event.actor ? 'person' : isAuditSystem(event) ? 'system' : 'unknown',
    text: `${event.id} ${person} ${action} ${type} ${record} ${JSON.stringify(event.meta ?? {})}`,
  };
  return terms.every((term) => {
    const matched =
      term.field === 'after'
        ? event.createdAt.slice(0, 10) >= term.value
        : term.field === 'before'
          ? event.createdAt.slice(0, 10) <= term.value
          : fields[term.field].toLowerCase().includes(term.value.toLowerCase());
    return term.exclude ? !matched : matched;
  });
}

/** The record is meaningful content; opaque identifiers remain in Details. */
export function auditRecordTitle(event: SearchableAuditEvent): string {
  const meta = event.meta && typeof event.meta === 'object' ? event.meta as Record<string, unknown> : {};
  if (['Message', 'Comment'].includes(auditRecordLabel(event.entityType)) && typeof meta.bodyPreview === 'string' && meta.bodyPreview.trim()) return meta.bodyPreview;
  return event.context?.title || auditRecordLabel(event.entityType);
}

const ACTION_META_FIELDS: Record<string, readonly [string, string][]> = {
  CLUB_CHANNEL_MESSAGE_UPDATED: [['previousBodyPreview', 'Before'], ['bodyPreview', 'After']],
  USER_CSV_IMPORT: [['created', 'People added'], ['skipped', 'Rows skipped']],
  ADMINISTRATOR_CSV_IMPORT: [['created', 'Administrators added'], ['skipped', 'Rows skipped']],
  USER_CSV_BULK_UPDATED: [['updated', 'People updated'], ['skipped', 'Rows skipped']],
  'user.roles_assigned': [['roles', 'Roles']],
  REPORT_UPDATED: [['status', 'Status']],
  KEYWORD_ADDED: [['keyword', 'Keyword']],
  KEYWORD_REMOVED: [['keyword', 'Keyword']],
};
const CATEGORY_META_FIELDS: Record<AuditCategory, readonly string[]> = {
  'people-access': ['roles', 'reason', 'enabled', 'count'],
  'clubs-chat': ['reason', 'emoji', 'roleName', 'permissions', 'visibility', 'joinPolicy', 'added', 'removed', 'skipped'],
  announcements: ['reason', 'status', 'audience'],
  moderation: ['reason', 'status', 'keyword', 'response'],
  schedules: ['reason', 'startDate', 'endDate', 'academicYear'],
  'flex-events': ['reason', 'status', 'capacity', 'location'],
};
/** Human details use known fields; complete unrecognized metadata stays technical. */
export function auditMetaFields(event: SearchableAuditEvent): { key: string; label: string; value: unknown }[] {
  if (!event.meta || typeof event.meta !== 'object' || Array.isArray(event.meta)) return [];
  const meta = event.meta as Record<string, unknown>;
  const fields = ACTION_META_FIELDS[event.action] ?? CATEGORY_META_FIELDS[auditCategory(event.entityType, event.action)].map((key) => [key, auditLabel(key)] as const);
  return fields.flatMap(([key, label]) => {
    const value = key === 'enabled' && typeof meta[key] === 'boolean' ? meta[key] ? 'Enabled' : 'Disabled' : meta[key];
    if (value == null || value === false || value === 0 || value === '' || Array.isArray(value) && !value.length) return [];
    return [{ key, label, value }];
  });
}
