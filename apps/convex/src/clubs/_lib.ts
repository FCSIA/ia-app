import { v } from "convex/values";
import { 
  clubMemberRoleValidator,
  clubJoinPolicyValidator,
} from "../validators";
import { docs } from "../../lib/docs";

export const clubValidator = v.object({
  _id: v.id("clubs"),
  name: v.string(),
  description: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  bannerUrl: v.optional(v.string()),
  accentColor: v.optional(v.string()),
  overview: v.optional(v.string()),
  joinPolicy: clubJoinPolicyValidator,
  memberLimit: v.optional(v.number()),
  joinCode: v.optional(v.string()),
  joinCodeUpdatedAt: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const memberValidator = v.object({
  _id: v.id("clubMembers"),
  clubId: v.id("clubs"),
  userId: v.id("users"),
  role: v.optional(clubMemberRoleValidator),
  joinedAt: v.number(),
});

export const channelValidator = docs.clubChannels;
