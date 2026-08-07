import { ConvexError, v } from "convex/values";
import type { AppRole } from "../../lib/roles";
import { getCurrentAppUser } from "../../lib/currentUser";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { schoolDayTemplateKindValidator } from "../validators";
import { requireScheduleAdmin } from "./_lib";
import {
  MAX_DAY_BLOCKS,
  normalizeDateKey,
  normalizeDayBlocks,
  weekdayForDateKey,
  type DayBlockInput,
} from "./dayResolver";

const SETTINGS_KEY = "default";
const MAX_TEMPLATES = 100;

export const dayPlanBlockInputValidator = v.object({
  label: v.string(),
  periodNumber: v.union(v.number(), v.null()),
  startTime: v.string(),
  endTime: v.string(),
});

const templateBlockValidator = v.object({
  id: v.id("schoolDayTemplateBlocks"),
  position: v.number(),
  label: v.string(),
  periodNumber: v.union(v.number(), v.null()),
  startTime: v.string(),
  endTime: v.string(),
  durationMinutes: v.number(),
});

const dateBlockValidator = v.object({
  id: v.id("schoolDayDateBlocks"),
  position: v.number(),
  label: v.string(),
  periodNumber: v.union(v.number(), v.null()),
  startTime: v.string(),
  endTime: v.string(),
  durationMinutes: v.number(),
});

export const dayTemplateValidator = v.object({
  id: v.id("schoolDayTemplates"),
  name: v.string(),
  kind: schoolDayTemplateKindValidator,
  blocks: v.array(templateBlockValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const dateOverrideValidator = v.object({
  id: v.id("schoolDayDateOverrides"),
  dateKey: v.string(),
  name: v.string(),
  sourceTemplateId: v.union(v.id("schoolDayTemplates"), v.null()),
  blocks: v.array(dateBlockValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const adminWorkspaceValidator = v.object({
  dateKey: v.string(),
  regularTemplateId: v.union(v.id("schoolDayTemplates"), v.null()),
  templates: v.array(dayTemplateValidator),
  override: v.union(dateOverrideValidator, v.null()),
});

type DatabaseCtx = QueryCtx | MutationCtx;

export function canManageDayPlans(roles: AppRole[]) {
  return roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN");
}

export function assertDateOverrideIsUnique(
  existingId: string | null,
  requestedId: string | undefined,
) {
  if (existingId && existingId !== requestedId) {
    throw new ConvexError("That date already has an override.");
  }
}

function serializePlanBlockFields(
  block: Doc<"schoolDayTemplateBlocks"> | Doc<"schoolDayDateBlocks">,
) {
  const [normalized] = normalizeDayBlocks([
    {
      label: block.label,
      periodNumber: block.periodNumber ?? null,
      startTime: block.startTime,
      endTime: block.endTime,
    },
  ]);
  return {
    position: block.position,
    label: normalized.label,
    periodNumber: normalized.periodNumber,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    durationMinutes: normalized.durationMinutes,
  };
}

function serializeTemplateBlock(block: Doc<"schoolDayTemplateBlocks">) {
  return { id: block._id, ...serializePlanBlockFields(block) };
}

function serializeDateBlock(block: Doc<"schoolDayDateBlocks">) {
  return { id: block._id, ...serializePlanBlockFields(block) };
}

async function getTemplateBlocks(
  ctx: DatabaseCtx,
  templateId: Id<"schoolDayTemplates">,
) {
  return await ctx.db
    .query("schoolDayTemplateBlocks")
    .withIndex("by_templateId_and_position", (q) =>
      q.eq("templateId", templateId),
    )
    .take(MAX_DAY_BLOCKS + 1);
}

async function getDateBlocks(
  ctx: DatabaseCtx,
  overrideId: Id<"schoolDayDateOverrides">,
) {
  return await ctx.db
    .query("schoolDayDateBlocks")
    .withIndex("by_overrideId_and_position", (q) =>
      q.eq("overrideId", overrideId),
    )
    .take(MAX_DAY_BLOCKS + 1);
}

async function serializeTemplate(
  ctx: DatabaseCtx,
  template: Doc<"schoolDayTemplates">,
) {
  const blocks = await getTemplateBlocks(ctx, template._id);
  if (blocks.length > MAX_DAY_BLOCKS) {
    throw new ConvexError("Template has too many blocks to edit safely.");
  }
  return {
    id: template._id,
    name: template.name,
    kind: template.kind,
    blocks: blocks.map(serializeTemplateBlock),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

async function getOverrideByDate(ctx: DatabaseCtx, dateKey: string) {
  return await ctx.db
    .query("schoolDayDateOverrides")
    .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
    .unique();
}

async function serializeOverride(
  ctx: DatabaseCtx,
  override: Doc<"schoolDayDateOverrides">,
) {
  const blocks = await getDateBlocks(ctx, override._id);
  if (blocks.length > MAX_DAY_BLOCKS) {
    throw new ConvexError("Date override has too many blocks to edit safely.");
  }
  return {
    id: override._id,
    dateKey: override.dateKey,
    name: override.name,
    sourceTemplateId: override.sourceTemplateId ?? null,
    blocks: blocks.map(serializeDateBlock),
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  };
}

async function replaceTemplateBlocks(
  ctx: MutationCtx,
  templateId: Id<"schoolDayTemplates">,
  blocks: DayBlockInput[],
  now: number,
) {
  const existing = await getTemplateBlocks(ctx, templateId);
  for (const block of existing) await ctx.db.delete(block._id);
  for (const block of normalizeDayBlocks(blocks)) {
    await ctx.db.insert("schoolDayTemplateBlocks", {
      templateId,
      position: block.position,
      label: block.label,
      periodNumber: block.periodNumber ?? undefined,
      startTime: block.startTime,
      endTime: block.endTime,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function replaceDateBlocks(
  ctx: MutationCtx,
  overrideId: Id<"schoolDayDateOverrides">,
  blocks: DayBlockInput[],
  now: number,
) {
  const existing = await getDateBlocks(ctx, overrideId);
  for (const block of existing) await ctx.db.delete(block._id);
  for (const block of normalizeDayBlocks(blocks)) {
    await ctx.db.insert("schoolDayDateBlocks", {
      overrideId,
      position: block.position,
      label: block.label,
      periodNumber: block.periodNumber ?? undefined,
      startTime: block.startTime,
      endTime: block.endTime,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function loadDayPlanSource(ctx: DatabaseCtx, rawDateKey: string) {
  const dateKey = normalizeDateKey(rawDateKey);
  const override = await getOverrideByDate(ctx, dateKey);
  if (override) {
    const blocks = await getDateBlocks(ctx, override._id);
    if (blocks.length > MAX_DAY_BLOCKS) {
      throw new ConvexError("Date override has too many blocks.");
    }
    return {
      dateKey,
      source: "DATE_OVERRIDE" as const,
      sourceId: override._id,
      sourceTemplateId: override.sourceTemplateId ?? null,
      name: override.name,
      blocks: blocks.map((block) => ({
        label: block.label,
        periodNumber: block.periodNumber ?? null,
        startTime: block.startTime,
        endTime: block.endTime,
      })),
    };
  }

  const settings = await ctx.db
    .query("schoolScheduleSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
  const template = settings
    ? await ctx.db.get(settings.regularTemplateId)
    : null;
  if (template) {
    const blocks = await getTemplateBlocks(ctx, template._id);
    if (blocks.length > MAX_DAY_BLOCKS) {
      throw new ConvexError("Regular template has too many blocks.");
    }
    return {
      dateKey,
      source: "REGULAR_TEMPLATE" as const,
      sourceId: template._id,
      sourceTemplateId: template._id,
      name: template.name,
      blocks: blocks.map((block) => ({
        label: block.label,
        periodNumber: block.periodNumber ?? null,
        startTime: block.startTime,
        endTime: block.endTime,
      })),
    };
  }

  const weekday = weekdayForDateKey(dateKey);
  const legacyBlocks = weekday
    ? await ctx.db
        .query("schoolDayBlocks")
        .withIndex("by_weekday_and_startTime", (q) => q.eq("weekday", weekday))
        .take(MAX_DAY_BLOCKS + 1)
    : [];
  if (legacyBlocks.length > MAX_DAY_BLOCKS) {
    throw new ConvexError("Legacy day plan has too many blocks.");
  }
  return {
    dateKey,
    source: "LEGACY" as const,
    sourceId: null,
    sourceTemplateId: null,
    name: weekday ? "Regular schedule" : "No school schedule",
    blocks: legacyBlocks.map((block) => ({
      label: block.label,
      periodNumber: block.periodNumber ?? null,
      startTime: block.startTime,
      endTime: block.endTime,
    })),
  };
}

export const getAdminWorkspace = query({
  args: { dateKey: v.string() },
  returns: adminWorkspaceValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const dateKey = normalizeDateKey(args.dateKey);
    const [templates, settings, override] = await Promise.all([
      ctx.db.query("schoolDayTemplates").withIndex("by_name").take(MAX_TEMPLATES),
      ctx.db
        .query("schoolScheduleSettings")
        .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
        .unique(),
      getOverrideByDate(ctx, dateKey),
    ]);
    return {
      dateKey,
      regularTemplateId: settings?.regularTemplateId ?? null,
      templates: await Promise.all(
        templates.map((template) => serializeTemplate(ctx, template)),
      ),
      override: override ? await serializeOverride(ctx, override) : null,
    };
  },
});

export const saveTemplate = mutation({
  args: {
    templateId: v.optional(v.id("schoolDayTemplates")),
    name: v.string(),
    kind: schoolDayTemplateKindValidator,
    blocks: v.array(dayPlanBlockInputValidator),
  },
  returns: dayTemplateValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Template name is required.");
    const normalizedBlocks = normalizeDayBlocks(args.blocks);
    const sameName = await ctx.db
      .query("schoolDayTemplates")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (sameName && sameName._id !== args.templateId) {
      throw new ConvexError("A template with that name already exists.");
    }

    const now = Date.now();
    let templateId = args.templateId;
    if (templateId) {
      const template = await ctx.db.get(templateId);
      if (!template) throw new ConvexError("Template not found.");
      await ctx.db.patch(templateId, { name, kind: args.kind, updatedAt: now });
    } else {
      templateId = await ctx.db.insert("schoolDayTemplates", {
        name,
        kind: args.kind,
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }
    await replaceTemplateBlocks(ctx, templateId, normalizedBlocks, now);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: args.templateId
        ? "schoolDayTemplate.updated"
        : "schoolDayTemplate.created",
      entityType: "schoolDayTemplate",
      entityId: templateId,
      meta: { name, kind: args.kind, blockCount: normalizedBlocks.length },
    });
    const template = await ctx.db.get(templateId);
    if (!template) throw new ConvexError("Template not found.");
    return await serializeTemplate(ctx, template);
  },
});

export const setRegularTemplate = mutation({
  args: { templateId: v.id("schoolDayTemplates") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template not found.");
    if (template.kind !== "REGULAR") {
      throw new ConvexError("Only a regular template can be the default schedule.");
    }
    const existing = await ctx.db
      .query("schoolScheduleSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        regularTemplateId: template._id,
        updatedById: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("schoolScheduleSettings", {
        key: SETTINGS_KEY,
        regularTemplateId: template._id,
        updatedById: user._id,
        updatedAt: now,
      });
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayTemplate.set_regular",
      entityType: "schoolDayTemplate",
      entityId: template._id,
    });
    return { success: true };
  },
});

export const applyTemplateToDate = mutation({
  args: {
    dateKey: v.string(),
    templateId: v.id("schoolDayTemplates"),
    name: v.optional(v.string()),
  },
  returns: dateOverrideValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const dateKey = normalizeDateKey(args.dateKey);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template not found.");
    const templateBlocks = await getTemplateBlocks(ctx, template._id);
    const normalizedBlocks = normalizeDayBlocks(templateBlocks.map((block) => ({
      label: block.label,
      periodNumber: block.periodNumber ?? null,
      startTime: block.startTime,
      endTime: block.endTime,
    })));
    const existing = await getOverrideByDate(ctx, dateKey);
    const now = Date.now();
    const name = args.name?.trim() || template.name;
    const overrideId = existing?._id ??
      (await ctx.db.insert("schoolDayDateOverrides", {
        dateKey,
        name,
        sourceTemplateId: template._id,
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      }));
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        sourceTemplateId: template._id,
        updatedAt: now,
      });
    }
    await replaceDateBlocks(ctx, overrideId, normalizedBlocks, now);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayDateOverride.applied_template",
      entityType: "schoolDayDateOverride",
      entityId: overrideId,
      meta: { dateKey, templateId: template._id },
    });
    const override = await ctx.db.get(overrideId);
    if (!override) throw new ConvexError("Date override not found.");
    return await serializeOverride(ctx, override);
  },
});

export const saveDateOverride = mutation({
  args: {
    overrideId: v.optional(v.id("schoolDayDateOverrides")),
    dateKey: v.string(),
    name: v.string(),
    sourceTemplateId: v.union(v.id("schoolDayTemplates"), v.null()),
    blocks: v.array(dayPlanBlockInputValidator),
  },
  returns: dateOverrideValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const dateKey = normalizeDateKey(args.dateKey);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Day-plan name is required.");
    const normalizedBlocks = normalizeDayBlocks(args.blocks);
    const dateMatch = await getOverrideByDate(ctx, dateKey);
    assertDateOverrideIsUnique(dateMatch?._id ?? null, args.overrideId);
    if (args.sourceTemplateId) {
      const source = await ctx.db.get(args.sourceTemplateId);
      if (!source) throw new ConvexError("Source template not found.");
    }
    const now = Date.now();
    let overrideId = args.overrideId;
    if (overrideId) {
      const existing = await ctx.db.get(overrideId);
      if (!existing) throw new ConvexError("Date override not found.");
      await ctx.db.patch(overrideId, {
        dateKey,
        name,
        sourceTemplateId: args.sourceTemplateId ?? undefined,
        updatedAt: now,
      });
    } else {
      overrideId = await ctx.db.insert("schoolDayDateOverrides", {
        dateKey,
        name,
        sourceTemplateId: args.sourceTemplateId ?? undefined,
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }
    await replaceDateBlocks(ctx, overrideId, normalizedBlocks, now);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: args.overrideId
        ? "schoolDayDateOverride.updated"
        : "schoolDayDateOverride.created",
      entityType: "schoolDayDateOverride",
      entityId: overrideId,
      meta: { dateKey, name, blockCount: normalizedBlocks.length },
    });
    const override = await ctx.db.get(overrideId);
    if (!override) throw new ConvexError("Date override not found.");
    return await serializeOverride(ctx, override);
  },
});

export const resetDateOverride = mutation({
  args: { dateKey: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const dateKey = normalizeDateKey(args.dateKey);
    const override = await getOverrideByDate(ctx, dateKey);
    if (!override) return { success: true };
    const blocks = await getDateBlocks(ctx, override._id);
    for (const block of blocks) await ctx.db.delete(block._id);
    await ctx.db.delete(override._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayDateOverride.reset",
      entityType: "schoolDayDateOverride",
      entityId: override._id,
      meta: { dateKey },
    });
    return { success: true };
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("schoolDayTemplates") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template not found.");
    const [settings, referenced] = await Promise.all([
      ctx.db
        .query("schoolScheduleSettings")
        .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
        .unique(),
      ctx.db
        .query("schoolDayDateOverrides")
        .withIndex("by_sourceTemplateId", (q) =>
          q.eq("sourceTemplateId", args.templateId),
        )
        .take(1),
    ]);
    if (settings?.regularTemplateId === args.templateId) {
      throw new ConvexError("Choose another regular template before deleting this one.");
    }
    if (referenced.length > 0) {
      throw new ConvexError("This template is still referenced by a dated schedule.");
    }
    const blocks = await getTemplateBlocks(ctx, template._id);
    for (const block of blocks) await ctx.db.delete(block._id);
    await ctx.db.delete(template._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayTemplate.deleted",
      entityType: "schoolDayTemplate",
      entityId: template._id,
      meta: { name: template.name },
    });
    return { success: true };
  },
});
