import { v } from "convex/values";
import {
  approvalStatusValidator,
  calendarSourceValidator,
  eventStatusValidator,
  eventTypeValidator,
  pathwayValidator,
} from "../validators";

export const eventCategoryValidator = {
  title: v.string(),
  description: v.optional(v.string()),
};

export const eventValidator = {
  authorId: v.id("users"),
  ownerId: v.optional(v.id("users")),
  clubId: v.optional(v.id("clubs")),
  categoryId: v.optional(v.id("eventCategories")),
  status: eventStatusValidator,
  type: eventTypeValidator,
  title: v.string(),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  flyerUrl: v.optional(v.string()),
  startAt: v.number(),
  endAt: v.optional(v.number()),
  registrationOpensAt: v.optional(v.number()),
  registrationClosesAt: v.optional(v.number()),
  allowedMajorPathways: v.array(pathwayValidator),
  allowedMinorPathways: v.array(pathwayValidator),
  requiredMajorWorkshopCount: v.number(),
  isInactive: v.boolean(),
  deactivatedAt: v.optional(v.number()),
  publishedAt: v.optional(v.number()),
};

export const eventApprovalValidator = {
  eventId: v.id("events"),
  sponsorId: v.id("users"),
  status: approvalStatusValidator,
  note: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
};

export const calendarEntryValidator = {
  eventId: v.optional(v.id("events")),
  flexFridayId: v.optional(v.id("flexFridays")),
  title: v.string(),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  startAt: v.number(),
  endAt: v.optional(v.number()),
  tags: v.array(v.string()),
  source: calendarSourceValidator,
  createdById: v.optional(v.id("users")),
};
