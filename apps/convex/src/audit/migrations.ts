import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { auditCategory } from '../../../shared/audit';
import { auditByActor, auditByCategory } from './_aggregates';

/** Widen-first, idempotent backfill; invoke only on an authorized deployment. */
export const backfill = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db.query('auditEvents').withIndex('by_createdAt')
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    for (const row of result.page) {
      const category = auditCategory(row.entityType, row.action);
      if (row.category !== category) await ctx.db.patch(row._id, { category });
      // The legacy CLUB_JOINED writer retained the actor in meta. Other
      // omitted actors cannot be recovered and remain explicitly unknown.
      const candidate = row.action === 'CLUB_JOINED' && !row.actorId && row.meta && typeof row.meta.userId === 'string'
        ? ctx.db.normalizeId('users', row.meta.userId) : null;
      const actorId = candidate && await ctx.db.get(candidate) ? candidate : row.actorId;
      if (actorId !== row.actorId) await ctx.db.patch(row._id, { actorId });
      const doc = { ...row, category, actorId };
      await auditByCategory.insertIfDoesNotExist(ctx, doc);
      await auditByActor.insertIfDoesNotExist(ctx, doc);
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.audit.migrations.backfill, { cursor: result.continueCursor });
    } else {
      const state = await ctx.db.query('auditIndexState').withIndex('by_key', (q) => q.eq('key', 'v1')).unique();
      if (state) await ctx.db.patch(state._id, { ready: true });
      else await ctx.db.insert('auditIndexState', { key: 'v1', ready: true });
    }
    return null;
  },
});
