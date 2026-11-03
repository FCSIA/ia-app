import { TableAggregate } from '@convex-dev/aggregate';
import { components } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { auditCategory, type AuditCategory } from '../../../shared/audit';

/**
 * Totals are exact once every stored row is in the aggregates. The backfill
 * records that explicitly (and records `ready: false` while it runs). Without a
 * state row, history needs no backfill when its oldest row was written by
 * `logAuditEvent`: rows written before the aggregates existed are older than
 * every logged row, and only logged or backfilled rows carry `category`.
 */
export async function auditIndexReady(ctx: QueryCtx): Promise<boolean> {
  const state = await ctx.db.query('auditIndexState').withIndex('by_key', (q) => q.eq('key', 'v1')).unique();
  if (state) return state.ready;
  const oldest = await ctx.db.query('auditEvents').withIndex('by_createdAt').order('asc').first();
  return !oldest || oldest.category !== undefined;
}

export const auditByCategory = new TableAggregate<{
  Namespace: AuditCategory; Key: number; DataModel: DataModel; TableName: 'auditEvents';
}>(components.auditByCategory, {
  namespace: (doc) => auditCategory(doc.entityType, doc.action),
  sortKey: (doc) => doc.createdAt,
});
// Category is part of the actor key, allowing actor+category+date counts without scans.
export const auditByActor = new TableAggregate<{
  Namespace: string; Key: [AuditCategory, number]; DataModel: DataModel; TableName: 'auditEvents';
}>(components.auditByActor, {
  namespace: (doc) => doc.actorId ?? 'system',
  sortKey: (doc) => [auditCategory(doc.entityType, doc.action), doc.createdAt],
});
