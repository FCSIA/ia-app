import type { Doc, Id, TableNames } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { auditLabel, auditRecordLabel } from '../../../shared/audit';
import { displayName } from '../../../shared/user-name';

const ENTITY_TABLES: Record<string, TableNames> = {
  user: 'users',
  club: 'clubs',
  clubchannel: 'clubChannels',
  clubchannelmessage: 'clubChannelMessages',
  clubunit: 'clubUnits',
  clubwhiteboard: 'clubWhiteboards',
  clubpeoplegroup: 'clubPeopleGroups',
  clubjoinrequest: 'clubJoinRequests',
  announcement: 'announcements',
  comment: 'comments',
  event: 'events',
  flexfriday: 'flexFridays',
  flexsession: 'flexSessions',
  flexworkshop: 'flexWorkshops',
  flexregistration: 'flexRegistrations',
  flexassignment: 'flexAssignments',
  flexattendance: 'flexAttendances',
  keywordrule: 'moderationKeywordRules',
  report: 'moderationReports',
  studentschedule: 'studentSchedules',
  studentschedulegroup: 'studentScheduleGroups',
  studentfriendsharelink: 'studentFriendShareLinks',
  schooldayblock: 'schoolDayBlocks',
  schooldaytemplate: 'schoolDayTemplates',
  schooldaydateoverride: 'schoolDayDateOverrides',
};
const REFERENCE_TABLES: Record<string, TableNames> = {
  userId: 'users',
  studentId: 'users',
  targetUserId: 'users',
  teacherId: 'users',
  assignedBy: 'users',
  markedById: 'users',
  impersonatedByUserId: 'users',
  requesterId: 'users',
  recipientId: 'users',
  clubId: 'clubs',
  channelId: 'clubChannels',
  workshopId: 'flexWorkshops',
  sessionId: 'flexSessions',
  boardId: 'clubWhiteboards',
  announcementId: 'announcements',
  eventId: 'events',
  unitId: 'clubUnits',
  groupId: 'studentScheduleGroups',
  templateId: 'schoolDayTemplates',
  courseId: 'courses',
};
export function auditMetaRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function recordName(value: Record<string, unknown>): string | null {
  if (typeof value.firstName === 'string') return displayName({
    firstName: value.firstName,
    lastName: typeof value.lastName === 'string' ? value.lastName : undefined,
    preferredName: typeof value.preferredName === 'string' ? value.preferredName : undefined,
  });
  for (const key of ['title', 'name', 'keyword', 'date']) {
    if (typeof value[key] === 'string' && value[key])
      return value[key] as string;
  }
  return null;
}
/** Messages and comments are named by their text, as their own events record it. */
const TEXT_RECORD_TABLES = new Set<TableNames>(['clubChannelMessages', 'comments']);
const TEXT_RECORD_PREVIEW_CHARACTERS = 240;
function recordText(table: TableNames, value: Record<string, unknown>): string | null {
  return TEXT_RECORD_TABLES.has(table) && typeof value.body === 'string' && value.body.trim()
    ? value.body.trim().slice(0, TEXT_RECORD_PREVIEW_CHARACTERS)
    : null;
}
/** Per-page memoization keeps repeated people, clubs, and channels to one read. */
export function auditContextResolver(ctx: QueryCtx) {
  const reads = new Map<string, Promise<Record<string, unknown> | null>>();
  const read = (table: TableNames, rawId: string) => {
    const key = `${table}:${rawId}`;
    let result = reads.get(key);
    if (!result) {
      const id = ctx.db.normalizeId(table, rawId);
      result = id
        ? ctx.db
            .get(id as Id<TableNames>)
            .then((doc) => doc as Record<string, unknown> | null)
        : Promise.resolve(null);
      reads.set(key, result);
    }
    return result;
  };
  return async (event: Doc<'auditEvents'>) => {
    const meta = auditMetaRecord(event.meta);
    const type = event.entityType.replace(/[_\s]/g, '').toLowerCase();
    const table = ENTITY_TABLES[type];
    const entity =
      table && event.entityId ? await read(table, event.entityId) : null;
    // A soft-deleted message keeps its row but is no longer a destination.
    // Only a real record ID can be deleted (bulk rows record e.g. "bulk").
    const live = !!entity && !entity.deletedAt;
    const deleted = !live && !!table && !!event.entityId && ctx.db.normalizeId(table, event.entityId) !== null;
    // Historical labels take precedence; current names fill in missing context
    // (e.g. a reaction names the message it was added to).
    const title =
      recordName(meta) ??
      (entity ? recordName(entity) : null) ??
      (live && table && entity ? recordText(table, entity) : null) ??
      auditRecordLabel(event.entityType);
    const references = (
      await Promise.all(
        Object.entries(REFERENCE_TABLES).map(async ([key, refTable]) => {
          const id = meta[key] ?? entity?.[key];
          if (typeof id !== 'string') return null;
          const doc = await read(refTable, id);
          const name = doc ? recordName(doc) : null;
          return name
            ? { id, label: auditLabel(key.replace(/Id$/, '')), name }
            : null;
        }),
      )
    ).filter(
      (ref): ref is { id: string; label: string; name: string } => ref !== null,
    );
    const contextNames = references.filter((ref) =>
      ['Club', 'Channel', 'Student', 'Workshop'].includes(ref.label),
    );
    const subtitle =
      contextNames
        .map((ref) => (ref.label === 'Channel' ? `#${ref.name}` : ref.name))
        .join(' · ') || null;
    const clubId = typeof meta.clubId === 'string' ? meta.clubId : typeof entity?.clubId === 'string' ? entity.clubId : null;
    const channelId = typeof meta.channelId === 'string' ? meta.channelId : typeof entity?.channelId === 'string' ? entity.channelId : null;
    const href = (targetTable: TableNames | undefined, id: string): string | null => {
      if (targetTable === 'users') return `/admin/users?user=${id}`;
      if (targetTable === 'clubs') return `/clubs/${id}`;
      if (targetTable === 'clubChannels' && clubId) return `/clubs/${clubId}/channels/${id}`;
      if (targetTable === 'clubChannelMessages' && clubId && channelId) return `/clubs/${clubId}/channels/${channelId}?message=${id}`;
      if (targetTable === 'clubWhiteboards' && clubId && channelId) return `/clubs/${clubId}/channels/${channelId}?view=whiteboard&board=${id}`;
      if (targetTable === 'announcements') return `/announcements/${id}`;
      if (targetTable === 'comments' && typeof (meta.announcementId ?? entity?.announcementId) === 'string') return `/announcements/${meta.announcementId ?? entity?.announcementId}`;
      if (targetTable === 'events') return `/events/${id}`;
      if (targetTable?.startsWith('flex')) return '/flex-friday';
      if (targetTable === 'moderationReports' || targetTable === 'moderationKeywordRules') return '/admin/moderation';
      if (targetTable?.startsWith('club') && clubId) return `/clubs/${clubId}`;
      return null;
    };
    const links = [
      ...(event.entityId ? [{ id: event.entityId, label: 'Record', name: title, href: live ? href(table, event.entityId) : null }] : []),
      ...references.map((ref) => ({ ...ref, href: href(REFERENCE_TABLES[Object.keys(REFERENCE_TABLES).find((key) => auditLabel(key.replace(/Id$/, '')) === ref.label) ?? ''], ref.id) })),
    ];
    return { title, subtitle, references, links, deleted };
  };
}
