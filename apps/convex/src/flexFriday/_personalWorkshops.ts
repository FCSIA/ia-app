import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { schema } from "../schema";
import { schoolDaySpan, schoolTimestamp } from "../../lib/schoolTime";

const TIME_ZONE = "America/New_York" as const;
const MAX_WORKSHOP_SESSIONS = 128;
const MAX_FRIDAYS = 16;
const MAX_FRIDAY_SESSIONS = 32;
const MAX_CANDIDATE_LINKS = 512;

const sessionValidator = schema
  .doc("flexSessions")
  .pick("_id", "title", "description", "startTime", "endTime", "sessionType")
  .extend({ startAt: v.number(), endAt: v.number() });
const fridayValidator = schema
  .doc("flexFridays")
  .pick("_id", "date", "type", "isSchoolDay", "notes");
const viewerValidator = v.object({
  registered: v.boolean(),
  assigned: v.boolean(),
  teaching: v.boolean(),
});

export const workshopDetailValidator = v.union(
  v.null(),
  v.object({
    friday: fridayValidator,
    workshop: schema.doc("flexWorkshops"),
    sessions: v.array(sessionValidator),
    teacher: v.union(
      v.null(),
      schema.doc("users").pick("_id", "firstName", "lastName", "preferredName"),
    ),
    viewer: viewerValidator,
    timeZone: v.literal(TIME_ZONE),
  }),
);

export const upcomingPersonalValidator = v.object({
  friday: v.union(v.null(), schema.doc("flexFridays").pick("_id", "date")),
  student: v.boolean(),
  timeZone: v.literal(TIME_ZONE),
  hasMore: v.boolean(),
  items: v.array(
    v.object({
      workshopId: v.id("flexWorkshops"),
      title: v.string(),
      location: v.optional(v.string()),
      sessions: v.array(sessionValidator),
      ...viewerValidator.fields,
    }),
  ),
});

function schoolSessionTimes(date: number, session: Doc<"flexSessions">) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, Number(value)]),
  );
  const timestamp = (time: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      throw new ConvexError("Workshop session has an invalid school time");
    }
    return schoolTimestamp({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: Number(match[1]),
      minute: Number(match[2]),
    });
  };
  return {
    _id: session._id,
    title: session.title,
    description: session.description,
    startTime: session.startTime,
    endTime: session.endTime,
    sessionType: session.sessionType,
    startAt: timestamp(session.startTime),
    endAt: timestamp(session.endTime),
  };
}

/** Never return an apparently complete detail with silently dropped segments. */
async function linkedSessions(
  ctx: QueryCtx,
  workshopId: Id<"flexWorkshops">,
  friday: Doc<"flexFridays">,
) {
  const links = await ctx.db
    .query("flexWorkshopSessions")
    .withIndex("by_workshopId_and_sessionId", (q) =>
      q.eq("workshopId", workshopId),
    )
    .take(MAX_WORKSHOP_SESSIONS + 1);
  if (links.length > MAX_WORKSHOP_SESSIONS) {
    throw new ConvexError("Workshop exceeds the supported session limit");
  }
  const sessions = await Promise.all(
    [...new Set(links.map((link) => link.sessionId))].map((id) =>
      ctx.db.get(id),
    ),
  );
  return sessions
    .filter(
      (session): session is Doc<"flexSessions"> =>
        session !== null && session.flexFridayId === friday._id,
    )
    .map((session) => schoolSessionTimes(friday.date, session))
    .sort(
      (a, b) =>
        a.startAt - b.startAt ||
        a.endAt - b.endAt ||
        a._id.localeCompare(b._id),
    );
}

async function viewerRelationship(
  ctx: QueryCtx,
  workshop: Doc<"flexWorkshops">,
  user: Doc<"users">,
) {
  const [registration, assignment] = await Promise.all([
    ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", workshop._id).eq("studentId", user._id),
      )
      .first(),
    ctx.db
      .query("flexAssignments")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", workshop._id).eq("studentId", user._id),
      )
      .first(),
  ]);
  return {
    registered: registration !== null,
    assigned: assignment !== null,
    teaching: workshop.teacherId === user._id,
  };
}

export async function getWorkshopDetail(
  ctx: QueryCtx,
  user: Doc<"users">,
  args: { flexFridayId: Id<"flexFridays">; workshopId: Id<"flexWorkshops"> },
) {
  const [friday, workshop] = await Promise.all([
    ctx.db.get(args.flexFridayId),
    ctx.db.get(args.workshopId),
  ]);
  if (!friday || !workshop) return null;
  const sessions = await linkedSessions(ctx, workshop._id, friday);
  if (sessions.length === 0) return null;
  const teacher = workshop.teacherId
    ? await ctx.db.get(workshop.teacherId)
    : null;
  return {
    friday: {
      _id: friday._id,
      date: friday.date,
      type: friday.type,
      isSchoolDay: friday.isSchoolDay,
      notes: friday.notes,
    },
    workshop,
    sessions,
    teacher: teacher
      ? {
          _id: teacher._id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          preferredName: teacher.preferredName,
        }
      : null,
    viewer: await viewerRelationship(ctx, workshop, user),
    timeZone: TIME_ZONE,
  };
}

/** Bounded day-first search avoids hydrating the viewer's registration history. */
export async function getUpcomingPersonalWorkshops(
  ctx: QueryCtx,
  user: Doc<"users">,
  args: { now: number; limit?: number },
) {
  if (!Number.isFinite(args.now) || !Number.isFinite(args.limit ?? 3)) {
    throw new ConvexError("A finite current time and limit are required");
  }
  const limit = Math.max(1, Math.min(10, Math.floor(args.limit ?? 3)));
  const student =
    user.isStudent ||
    user.roles.some((role) =>
      ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role),
    );
  const empty = {
    friday: null,
    student,
    timeZone: TIME_ZONE,
    items: [],
    hasMore: false,
  };
  // Compare school-day boundaries, not Friday's stored noon with the current clock.
  const fridays = await ctx.db
    .query("flexFridays")
    .withIndex("by_date", (q) => q.gte("date", schoolDaySpan(args.now).startAt))
    .take(MAX_FRIDAYS + 1);
  let inspectedLinks = 0;
  for (const friday of fridays.slice(0, MAX_FRIDAYS)) {
    const sessions = await ctx.db
      .query("flexSessions")
      .withIndex("by_flexFridayId", (q) => q.eq("flexFridayId", friday._id))
      .take(MAX_FRIDAY_SESSIONS + 1);
    let truncated = sessions.length > MAX_FRIDAY_SESSIONS;
    const seen = new Set<Id<"flexWorkshops">>();
    const items: {
      workshopId: Id<"flexWorkshops">;
      title: string;
      location?: string;
      sessions: Awaited<ReturnType<typeof linkedSessions>>;
      registered: boolean;
      assigned: boolean;
      teaching: boolean;
    }[] = [];
    sessionSearch: for (const session of sessions
      .slice(0, MAX_FRIDAY_SESSIONS)
      .map((session) => ({
        session,
        times: schoolSessionTimes(friday.date, session),
      }))
      .sort((a, b) => a.times.startAt - b.times.startAt)) {
      if (session.times.endAt <= args.now) continue;
      const remaining = MAX_CANDIDATE_LINKS - inspectedLinks;
      if (remaining === 0) {
        truncated = true;
        break;
      }
      const links = await ctx.db
        .query("flexWorkshopSessions")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", session.session._id),
        )
        .take(remaining + 1);
      truncated ||= links.length > remaining;
      for (const link of links.slice(0, remaining)) {
        inspectedLinks += 1;
        if (seen.has(link.workshopId)) continue;
        seen.add(link.workshopId);
        const workshop = await ctx.db.get(link.workshopId);
        if (!workshop) continue;
        // Staff suggestions are their own teaching responsibilities, never a school roster.
        if (!student && workshop.teacherId !== user._id) continue;
        const viewer = await viewerRelationship(ctx, workshop, user);
        if (student && !viewer.registered && !viewer.assigned) continue;
        items.push({
          workshopId: workshop._id,
          title: workshop.title,
          location: workshop.location,
          sessions: await linkedSessions(ctx, workshop._id, friday),
          ...viewer,
        });
        if (items.length > limit) break sessionSearch;
      }
    }
    if (items.length) {
      const nextStart = (item: (typeof items)[number]) =>
        item.sessions.find((session) => session.endAt > args.now)?.startAt ??
        Infinity;
      items.sort(
        (a, b) =>
          nextStart(a) - nextStart(b) ||
          a.title.localeCompare(b.title) ||
          a.workshopId.localeCompare(b.workshopId),
      );
      return {
        friday: { _id: friday._id, date: friday.date },
        student,
        timeZone: TIME_ZONE,
        items: items.slice(0, limit),
        hasMore: truncated || items.length > limit,
      };
    }
    // A partially inspected nearer Friday may contain the relevant commitment.
    if (truncated) return { ...empty, hasMore: true };
  }
  return { ...empty, hasMore: fridays.length > MAX_FRIDAYS };
}
