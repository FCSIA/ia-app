import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import {
  auditCategory,
  auditActionLabel,
  auditLabel,
  isFlexAudit,
  matchesAuditSearch,
  parseAuditSearch,
  isAuditSystem,
  auditEntityKey,
} from '../../../shared/audit';
import type { AuditCategory, SearchableAuditEvent } from '../../../shared/audit';
import { nameSearchValues } from '../../../shared/user-name';
import type { Doc } from '../_generated/dataModel';

export const auditFilters = {
  query: v.optional(v.string()),
  actor: v.optional(v.string()),
  actorId: v.optional(v.string()),
  recordId: v.optional(v.string()),
  entityId: v.optional(v.string()),
  action: v.optional(v.string()),
  actions: v.optional(v.array(v.string())),
  entityType: v.optional(v.string()),
  actorScope: v.optional(v.union(v.literal('USER'), v.literal('SYSTEM'))),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  advancedQuery: v.optional(v.string()),
  category: v.optional(v.union(v.literal('general'), v.literal('flex'), v.literal('people-access'), v.literal('clubs-chat'), v.literal('announcements'), v.literal('moderation'), v.literal('schedules'), v.literal('flex-events'))),
  categories: v.optional(v.array(v.union(v.literal('people-access'), v.literal('clubs-chat'), v.literal('announcements'), v.literal('moderation'), v.literal('schedules'), v.literal('flex-events')))),
};
export type AuditFilters = {
  query?: string;
  actor?: string;
  actorId?: string;
  recordId?: string;
  entityId?: string;
  action?: string;
  actions?: string[];
  entityType?: string;
  actorScope?: 'USER' | 'SYSTEM';
  startDate?: string;
  endDate?: string;
  startAt?: number;
  endAt?: number;
  advancedQuery?: string;
  category?: 'general' | 'flex' | AuditCategory;
  categories?: AuditCategory[];
};
/** Reject stored-field mismatches before reading actors and related records. */
export function auditRecordMatcher(args: AuditFilters) {
  const start = args.startAt ??
    (args.startDate ? Date.parse(`${args.startDate}T00:00:00Z`) : undefined);
  const end = args.endAt ??
    (args.endDate ? Date.parse(`${args.endDate}T23:59:59.999Z`) : undefined);
  const contains = (value: string | null | undefined, needle?: string) =>
    !needle?.trim() ||
    (value ?? '').toLowerCase().includes(needle.trim().toLowerCase());
  return (event: Pick<
    Doc<'auditEvents'>, 'action' | 'entityType' | 'entityId' | 'createdAt'
  > & { actorId?: string }) => {
    if (args.actorId && event.actorId !== args.actorId) return false;
    if (args.recordId && event.entityId !== args.recordId) return false;
    if (args.action && event.action !== args.action) return false;
    if (args.actions?.length && !args.actions.includes(event.action)) return false;
    if (args.entityType && auditEntityKey(event.entityType) !== auditEntityKey(args.entityType)) return false;
    if (
      args.category &&
      (args.category === 'general' || args.category === 'flex'
        ? isFlexAudit(event.entityType) !== (args.category === 'flex')
        : auditCategory(event.entityType, event.action) !== args.category)
    )
      return false;
    if (args.categories?.length && !args.categories.includes(auditCategory(event.entityType, event.action))) return false;
    const isPerson = !!event.actorId;
    // System rows never have an actor; auditMatcher checks the rest from meta.
    if (args.actorScope === 'SYSTEM' && isPerson) return false;
    if (args.actorScope === 'USER' && !isPerson) return false;
    const time = event.createdAt;
    if (
      (start !== undefined && time < start) ||
      (end !== undefined && time > end)
    )
      return false;
    if (!contains(event.entityId, args.entityId)) return false;
    return true;
  };
}
export function auditMatcher(args: AuditFilters) {
  if ((args.actions?.length ?? 0) > 200) throw new ConvexError('Choose at most 200 actions.');
  const parsed = parseAuditSearch(args.advancedQuery ?? '');
  if (parsed.error) throw new ConvexError(parsed.error);
  const matchesRecord = auditRecordMatcher(args);
  const contains = (value: string | null | undefined, needle?: string) =>
    !needle?.trim() ||
    (value ?? '').toLowerCase().includes(needle.trim().toLowerCase());
  return (event: SearchableAuditEvent) => {
    if (!matchesRecord({
      action: event.action,
      entityType: event.entityType,
      actorId: event.actorId ?? event.actor?.id ?? undefined,
      entityId: event.entityId ?? undefined,
      createdAt: Date.parse(event.createdAt),
    })) return false;
    if (args.actorScope === 'SYSTEM' && !isAuditSystem(event)) return false;
    if (
      !contains(
        [
          ...nameSearchValues(event.actor),
          event.actor?.uniqueId,
          event.actorId,
        ].join(' '),
        args.actor,
      )
    )
      return false;
    if (
      args.query &&
      !matchesAuditSearch(event, [
        { field: 'text', value: args.query.trim(), exclude: false },
      ])
    )
      return false;
    return matchesAuditSearch(event, parsed.terms);
  };
}
export { auditActionLabel, auditLabel };
