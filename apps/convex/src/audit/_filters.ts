import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import {
  auditActionLabel,
  auditLabel,
  isFlexAudit,
  matchesAuditSearch,
  parseAuditSearch,
} from '../../../shared/audit';
import type { SearchableAuditEvent } from '../../../shared/audit';
import { nameSearchValues } from '../../../shared/user-name';
import type { Doc } from '../_generated/dataModel';

export const auditFilters = {
  query: v.optional(v.string()),
  actor: v.optional(v.string()),
  entityId: v.optional(v.string()),
  action: v.optional(v.string()),
  entityType: v.optional(v.string()),
  actorScope: v.optional(v.union(v.literal('USER'), v.literal('SYSTEM'))),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  advancedQuery: v.optional(v.string()),
  category: v.optional(v.union(v.literal('general'), v.literal('flex'))),
};
export type AuditFilters = {
  query?: string;
  actor?: string;
  entityId?: string;
  action?: string;
  entityType?: string;
  actorScope?: 'USER' | 'SYSTEM';
  startDate?: string;
  endDate?: string;
  startAt?: number;
  endAt?: number;
  advancedQuery?: string;
  category?: 'general' | 'flex';
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
    if (args.action && event.action !== args.action) return false;
    if (args.entityType && event.entityType !== args.entityType) return false;
    if (
      args.category &&
      isFlexAudit(event.entityType) !== (args.category === 'flex')
    )
      return false;
    const isPerson = !!event.actorId;
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
