import { v } from "convex/values";

export const clubValidator = v.object({
  _id: v.id("clubs"),
  name: v.string(),
  description: v.string(),
  createdAt: v.number(),
});

export const memberValidator = v.object({
  _id: v.id("clubMembers"),
  clubId: v.id("clubs"),
  userId: v.id("users"),
  role: v.union(v.literal("MEMBER"), v.literal("LEADER"), v.literal("SPONSOR")),
});

export const channelValidator = v.object({
  _id: v.id("channels"),
  clubId: v.id("clubs"),
  name: v.string(),
  isPrivate: v.boolean(),
});
