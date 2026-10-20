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
const ACTION_LABELS: Record<string, string> = {
  CLUB_CHANNEL_MESSAGE_POSTED: 'Posted a message',
  CLUB_CHANNEL_MESSAGE_UPDATED: 'Edited a message',
  CLUB_CHANNEL_MESSAGE_DELETED: 'Deleted a message',
  CLUB_CHANNEL_MESSAGE_REACTION_ADDED: 'Added a reaction',
  CLUB_CHANNEL_MESSAGE_REACTION_REMOVED: 'Removed a reaction',
  CLUB_CHANNEL_MESSAGE_PINNED: 'Pinned a message',
  CLUB_CHANNEL_MESSAGE_UNPINNED: 'Unpinned a message',
  'schedule.updated': 'Updated a schedule',
  FLEX_WORKSHOP_REGISTERED: 'Registered for a workshop',
  FLEX_WORKSHOP_ASSIGNED: 'Assigned a workshop',
  FLEX_REGISTRATION_REMOVED: 'Removed a workshop registration',
  FLEX_ATTENDANCE_MARKED: 'Recorded attendance',
  FLEX_ATTENDANCE_CLEARED: 'Cleared attendance',
  'auth.login_locked': 'Temporarily locked sign-in',
  'auth.login_unlocked': 'Unlocked sign-in',
};
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? auditLabel(action);
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

    uniqueId: string;
  } | null;
  context?: {
    title: string;
    subtitle: string | null;
    references: { id: string; label: string; name: string }[];
  } | null;
};
export function auditPersonName(event: SearchableAuditEvent): string {
  return event.actor
    ? `${event.actor.firstName} ${event.actor.lastName}`.trim()
    : event.actorId
      ? 'Former user (name unavailable)'
      : 'System';
}
export function matchesAuditSearch(
  event: SearchableAuditEvent,
  terms: AuditSearchTerm[],
): boolean {
  const person = [
    auditPersonName(event),
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
    source: event.actorId || event.actor ? 'person' : 'system',
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
