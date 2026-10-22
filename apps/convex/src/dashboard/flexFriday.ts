import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { getCurrentAppUser } from '../../lib/currentUser';

/** Start from the next Friday, so a dashboard never hydrates registration history. */
export const snapshot = query({
  args: { from: v.number() },
  returns: v.union(v.null(), v.object({
    date: v.number(), student: v.boolean(), hasMore: v.boolean(),
    workshops: v.array(v.object({ id: v.id('flexWorkshops'), title: v.string(), location: v.optional(v.string()), startTime: v.string(), endTime: v.string(), registered: v.number(), hasMoreRegistrations: v.boolean() })),
  })),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const student = user.isStudent || user.roles.includes('STUDENT');
    const friday = await ctx.db.query('flexFridays').withIndex('by_date', (q) => q.gte('date', args.from)).first();
    if (!friday) return null;
    const sessions = await ctx.db.query('flexSessions').withIndex('by_flexFridayId', (q) => q.eq('flexFridayId', friday._id)).take(21);
    let hasMore = sessions.length > 20;
    let inspectedLinks = 0;
    const rows = new Map<string, { id: Id<'flexWorkshops'>; title: string; location?: string; startTime: string; endTime: string; registered: number; hasMoreRegistrations: boolean }>();
    for (const session of sessions.slice(0, 20).sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const links = await ctx.db.query('flexWorkshopSessions').withIndex('by_sessionId', (q) => q.eq('sessionId', session._id)).take(101);
      hasMore ||= links.length > 100;
      for (const link of links.slice(0, 100)) {
        if (++inspectedLinks > 200) { hasMore = true; break; }
        if (rows.has(link.workshopId)) continue;
        const workshop = await ctx.db.get(link.workshopId);
        if (!workshop) continue;
        if (student) {
          const registration = await ctx.db.query('flexRegistrations').withIndex('by_workshopId_and_studentId', (q) => q.eq('workshopId', workshop._id).eq('studentId', user._id)).first();
          const assignment = registration ? null : await ctx.db.query('flexAssignments').withIndex('by_workshopId_and_studentId', (q) => q.eq('workshopId', workshop._id).eq('studentId', user._id)).first();
          if (!registration && !assignment) continue;
        } else if (workshop.teacherId !== user._id) continue;
        const registrations = student ? [] : await ctx.db.query('flexRegistrations').withIndex('by_workshopId_and_studentId', (q) => q.eq('workshopId', workshop._id)).take(501);
        rows.set(workshop._id, { id: workshop._id, title: workshop.title, location: workshop.location, startTime: session.startTime, endTime: session.endTime, registered: Math.min(500, registrations.length), hasMoreRegistrations: registrations.length > 500 });
      }
    }
    return { date: friday.date, student, workshops: [...rows.values()].slice(0, 3), hasMore: hasMore || rows.size > 3 };
  },
});
