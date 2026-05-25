import { v } from "convex/values";
import { clubMemberRoleValidator } from "../validators";

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
  role: clubMemberRoleValidator,
});

export const channelValidator = v.object({
  _id: v.id("channels"),
  clubId: v.id("clubs"),
  name: v.string(),
  isPrivate: v.boolean(),
});
