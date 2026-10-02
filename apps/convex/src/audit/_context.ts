import type { Doc, Id, TableNames } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { auditLabel, auditRecordLabel } from '../../../shared/audit';

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
  if (typeof value.firstName === 'string') return [value.firstName, value.lastName].filter(Boolean).join(' ');
  for (const key of ['title', 'name', 'keyword', 'date']) {
    if (typeof value[key] === 'string' && value[key])
      return value[key] as string;
  }
  return null;
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
    // Historical labels take precedence; current names fill in missing context.
    const title =
      recordName(meta) ??
      (entity ? recordName(entity) : null) ??
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
    return { title, subtitle, references };
  };
}
