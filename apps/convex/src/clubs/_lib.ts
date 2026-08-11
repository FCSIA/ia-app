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
  logoStorageId: v.optional(v.id("_storage")),
  bannerUrl: v.optional(v.string()),
  bannerStorageId: v.optional(v.id("_storage")),
  accentColor: v.optional(v.string()),
  overview: v.optional(v.string()),
  joinPolicy: clubJoinPolicyValidator,
  memberLimit: v.optional(v.number()),
  joinCode: v.optional(v.string()),
  joinCodeUpdatedAt: v.optional(v.number()),
  joinCodeExpiresAt: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const memberValidator = v.object({
  _id: v.id("clubMembers"),
  clubId: v.id("clubs"),
  userId: v.id("users"),
  role: v.optional(clubMemberRoleValidator),
  customRoleId: v.optional(v.id("clubRoles")),
  roleId: v.optional(v.id("clubRoles")),
  joinedAt: v.number(),
});

export const channelValidator = docs.clubChannels;
