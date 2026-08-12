import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { type AppRole } from "../../lib/roles";
import {
  CLUB_DEFINITIONS,
  type SeedClubCategory,
  type SeedClubDefinition,
} from "../../seed-data/clubs";
import { createInitialClubRoles } from "./rolePermissions";

class SeedRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  element<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = clone[i]!;
      clone[i] = clone[j]!;
      clone[j] = temp;
    }
    return clone;
  }
  string(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let res = "";
    for (let i = 0; i < length; i++) {
      res += chars[Math.floor(this.next() * chars.length)];
    }
    return res;
  }
}

function buildChannelBlueprints(club: SeedClubDefinition, rng: SeedRandom) {
  const channels: Array<{
    name: string;
    description: string;
    visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";
  }> = [
    {
      name: "general",
      description: `Main conversation space for ${club.name}.`,
      visibility: "PUBLIC",
    },
    {
      name: "announcements",
      description: `Read-only updates and reminders for ${club.name}.`,
      visibility: "MEMBER_READONLY",
    },
  ];

  if (club.category === "PATHWAY") {
    channels.push(
      {
        name: "projects",
        description:
          "Build logs, project checkpoints, and student work reviews.",
        visibility: "PUBLIC",
      },
      {
        name: "resources",
        description: "Reference links, competition docs, and mentor notes.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "officers",
        description: "Leadership planning and sponsor coordination.",
        visibility: "PRIVATE",
      },
    );
  } else if (club.category === "COMPETITIVE") {
    channels.push(
      {
        name: "competition-prep",
        description: "Roster prep, study plans, and event readiness.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "practice",
        description: "Weekly drills, scrimmage notes, and improvement goals.",
        visibility: "PUBLIC",
      },
      {
        name: "officers",
        description: "Leadership logistics and travel coordination.",
        visibility: "PRIVATE",
      },
    );
  } else if (club.category === "LEADERSHIP") {
    channels.push(
      {
        name: "planning",
        description: "Event planning, service ideas, and leadership updates.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "class-voice",
        description: "Student feedback, concerns, and classwide ideas.",
        visibility: "PUBLIC",
      },
      {
        name: "officers",
        description: "Officer-only planning and sponsor communication.",
        visibility: "PRIVATE",
      },
    );
  } else if (club.category === "HONOR") {
    channels.push(
      {
        name: "service",
        description: "Honor society service projects and outreach updates.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "tutoring",
        description: "Peer support, study help, and academic mentoring.",
        visibility: "PUBLIC",
      },
      {
        name: "officers",
        description: "Leadership and sponsor planning.",
        visibility: "PRIVATE",
      },
    );
  } else if (club.category === "CREATIVE") {
    channels.push(
      {
        name: "showcases",
        description: "Works in progress, prompts, and spotlight opportunities.",
        visibility: "PUBLIC",
      },
      {
        name: "feedback",
        description: "Structured critique notes and reference material.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "officers",
        description: "Editorial and leadership planning.",
        visibility: "PRIVATE",
      },
    );
  } else if (club.category === "SERVICE") {
    channels.push(
      {
        name: "service-events",
        description: "Volunteer signups and event updates.",
        visibility: "PUBLIC",
      },
      {
        name: "logistics",
        description: "Planning docs and sponsor-approved operational notes.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "officers",
        description: "Core planning team coordination.",
        visibility: "PRIVATE",
      },
    );
  } else {
    channels.push(
      {
        name: "resources",
        description: "Study materials, reference links, and member notes.",
        visibility: "MEMBER_READONLY",
      },
      {
        name: "officers",
        description: "Leadership planning and sponsor coordination.",
        visibility: "PRIVATE",
      },
    );
  }

  if (club.category !== "LEADERSHIP" && rng.int(0, 99) < 60) {
    channels.push({
      name: "events",
      description: "Meeting reminders, calendars, and event logistics.",
      visibility: "PUBLIC",
    });
  }

  return channels.slice(0, 10);
}

export const run = internalMutation({
  args: {
    reset: v.optional(v.boolean()),
  },
  returns: v.object({
    clubsSeeded: v.number(),
    membersSeeded: v.number(),
    sponsorsSeeded: v.number(),
    channelsSeeded: v.number(),
    joinRequestsSeeded: v.number(),
  }),
  handler: async (ctx, args) => {
    const rng = new SeedRandom(20260417);
    const now = Date.now();

    if (args.reset) {
      // Clean up previous seeds
      const oldMentions = await ctx.db
        .query("clubChannelMessageMentions")
        .take(5000);
      for (const mention of oldMentions) await ctx.db.delete(mention._id);

      const oldReactions = await ctx.db
        .query("clubChannelMessageReactions")
        .take(5000);
      for (const reaction of oldReactions) await ctx.db.delete(reaction._id);

      const oldAttachments = await ctx.db
        .query("clubChannelMessageAttachments")
        .take(5000);
      for (const attachment of oldAttachments)
        await ctx.db.delete(attachment._id);

      const oldVotes = await ctx.db
        .query("clubChannelMessagePollVotes")
        .take(5000);
      for (const vote of oldVotes) await ctx.db.delete(vote._id);

      const oldMessages = await ctx.db.query("clubChannelMessages").take(5000);
      for (const message of oldMessages) await ctx.db.delete(message._id);

      const oldTagMembers = await ctx.db.query("clubTagMembers").take(5000);
      for (const tagMember of oldTagMembers) await ctx.db.delete(tagMember._id);

      const oldTags = await ctx.db.query("clubTags").take(5000);
      for (const tag of oldTags) await ctx.db.delete(tag._id);

      const oldInvites = await ctx.db.query("clubInvites").take(5000);
      for (const invite of oldInvites) await ctx.db.delete(invite._id);

      const oldMembers = await ctx.db.query("clubMembers").take(5000);
      for (const m of oldMembers) await ctx.db.delete(m._id);

      const oldSponsors = await ctx.db.query("clubSponsors").take(5000);
      for (const s of oldSponsors) await ctx.db.delete(s._id);

      const oldChannels = await ctx.db.query("clubChannels").take(5000);
      for (const c of oldChannels) await ctx.db.delete(c._id);

      const oldMemberships = await ctx.db
        .query("clubChannelMemberships")
        .take(5000);
      for (const m of oldMemberships) await ctx.db.delete(m._id);

      const oldRequests = await ctx.db.query("clubJoinRequests").take(5000);
      for (const r of oldRequests) await ctx.db.delete(r._id);

      const oldRoles = await ctx.db.query("clubRoles").take(5000);
      for (const role of oldRoles) await ctx.db.delete(role._id);

      const oldClubs = await ctx.db.query("clubs").take(5000);
      for (const c of oldClubs) await ctx.db.delete(c._id);
    }

    // Load users
    const allUsers = await ctx.db.query("users").take(5000);
    const studentUsers = allUsers.filter(
      (u) => u.roles.includes("STUDENT") && u.gradeLevel,
    );
    const sponsorUsers = allUsers.filter((u) => u.roles.includes("SPONSOR"));

    const userByUniqueId = new Map(allUsers.map((u) => [u.uniqueId, u]));
    const roleActor = allUsers[0];
    if (!roleActor) throw new Error("Seed users before seeding clubs");

    // Seed clubs
    const clubIdByName = new Map<string, any>();
    const defaultRoleIdByClub = new Map<string, Id<"clubRoles">>();
    const leaderRoleIdByClub = new Map<string, Id<"clubRoles">>();
    for (const clubDef of CLUB_DEFINITIONS) {
      const clubId = await ctx.db.insert("clubs", {
        name: clubDef.name,
        description: clubDef.description,
        joinPolicy: clubDef.joinPolicy,
        memberLimit:
          clubDef.category === "LEADERSHIP"
            ? 80
            : clubDef.category === "PATHWAY"
              ? 60
              : 40,
        joinCode: rng.string(6),
        joinCodeUpdatedAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      clubIdByName.set(clubDef.name, clubId);
      const [memberRole, leaderRole] = await createInitialClubRoles(ctx, clubId, roleActor._id);
      defaultRoleIdByClub.set(clubDef.name, memberRole._id);
      leaderRoleIdByClub.set(clubDef.name, leaderRole._id);
    }

    // Build user memberships
    const membershipsByStudent = new Map<string, Set<string>>();
    const membersByClub = new Map<string, Set<string>>();
    for (const student of studentUsers) {
      membershipsByStudent.set(student.uniqueId, new Set());
    }
    for (const club of CLUB_DEFINITIONS) {
      membersByClub.set(club.name, new Set());
    }

    const canJoinClub = (
      student: (typeof studentUsers)[0],
      club: SeedClubDefinition,
    ) => {
      if (
        club.gradeLevels &&
        student.gradeLevel &&
        !club.gradeLevels.includes(student.gradeLevel)
      )
        return false;
      return true;
    };

    const addMembership = (studentUniqueId: string, clubName: string) => {
      const studentMemberships = membershipsByStudent.get(studentUniqueId)!;
      if (studentMemberships.has(clubName) || studentMemberships.size >= 3) {
        return false;
      }
      studentMemberships.add(clubName);
      membersByClub.get(clubName)!.add(studentUniqueId);
      return true;
    };

    for (const student of studentUsers) {
      const matchingPathwayClubs = CLUB_DEFINITIONS.filter(
        (club) => club.pathway === student.major && canJoinClub(student, club),
      );
      const fallbackPathwayClubs = CLUB_DEFINITIONS.filter(
        (club) => club.pathway === student.minor && canJoinClub(student, club),
      );

      const primaryClub = rng.element(
        matchingPathwayClubs.length > 0
          ? matchingPathwayClubs
          : fallbackPathwayClubs,
      );
      if (primaryClub) {
        addMembership(student.uniqueId, primaryClub.name);
      }

      const weightedExtras = [
        ...CLUB_DEFINITIONS.filter(
          (club) =>
            student.gradeLevel &&
            club.gradeLevels?.includes(student.gradeLevel),
        ),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "ACADEMIC"),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "CREATIVE"),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "SERVICE"),
        ...CLUB_DEFINITIONS.filter((club) => club.pathway === student.minor),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "COMPETITIVE"),
      ].filter((club) => canJoinClub(student, club));

      const targetCount =
        1 + (rng.int(0, 99) < 78 ? 1 : 0) + (rng.int(0, 99) < 33 ? 1 : 0);

      let attempts = 0;
      while (
        membershipsByStudent.get(student.uniqueId)!.size < targetCount &&
        attempts < 40
      ) {
        attempts += 1;
        const nextClub = rng.element(weightedExtras);
        if (nextClub) {
          addMembership(student.uniqueId, nextClub.name);
        }
      }
    }

    // Fill clubs to minimum sizes
    for (const club of CLUB_DEFINITIONS) {
      const minimumSize =
        club.category === "LEADERSHIP"
          ? 18
          : club.category === "HONOR"
            ? 20
            : 24;
      while (membersByClub.get(club.name)!.size < minimumSize) {
        const eligibleStudents = studentUsers.filter(
          (student) =>
            canJoinClub(student, club) &&
            !membershipsByStudent.get(student.uniqueId)!.has(club.name) &&
            membershipsByStudent.get(student.uniqueId)!.size < 3,
        );
        if (eligibleStudents.length === 0) break;
        const student = rng.element(eligibleStudents);
        addMembership(student.uniqueId, club.name);
      }
    }

    // Insert memberships & sponsors & channels
    const leadershipTitlesByCategory: Record<SeedClubCategory, string[]> = {
      PATHWAY: ["President", "Vice President", "Project Lead"],
      ACADEMIC: ["President", "Vice President"],
      LEADERSHIP: ["President", "Vice President", "Secretary", "Treasurer"],
      CREATIVE: ["Editor", "Producer", "Creative Lead"],
      SERVICE: ["President", "Outreach Lead", "Operations Lead"],
      HONOR: ["President", "Vice President", "Secretary"],
      COMPETITIVE: ["Captain", "Vice Captain", "Logistics Lead"],
    };

    let membersSeeded = 0;
    let channelsSeeded = 0;
    const clubLeaderIds = new Map<string, Id<"users">[]>();

    for (const club of CLUB_DEFINITIONS) {
      const clubId = clubIdByName.get(club.name)!;
      const memberUniqueIds = [...membersByClub.get(club.name)!];
      const rankedMembers = memberUniqueIds
        .map((uniqueId) => userByUniqueId.get(uniqueId)!)
        .filter(Boolean)
        .sort((left, right) => {
          const leftGrade = left.gradeLevel ?? 0;
          const rightGrade = right.gradeLevel ?? 0;
          return (
            rightGrade - leftGrade ||
            left.uniqueId.localeCompare(right.uniqueId)
          );
        });

      const roleTitles = leadershipTitlesByCategory[club.category];
      const leaderCount = Math.min(roleTitles.length, rankedMembers.length);
      const leaderIds = rankedMembers.slice(0, leaderCount).map((s) => s._id);
      clubLeaderIds.set(club.name, leaderIds as Id<"users">[]);

      const roleByUserId = new Map<string, string>();
      for (let i = 0; i < leaderCount; i++) {
        roleByUserId.set(rankedMembers[i]!._id, roleTitles[i]!);
      }

      for (const member of rankedMembers) {
        const isLeader = roleByUserId.has(member._id);
        await ctx.db.insert("clubMembers", {
          clubId,
          userId: member._id,
          roleId: isLeader
            ? leaderRoleIdByClub.get(club.name)!
            : defaultRoleIdByClub.get(club.name)!,
          joinedAt: now,
        });
        membersSeeded++;
      }
    }

    // Seed Sponsors
    let sponsorsSeeded = 0;
    const sponsorUniqueIds = sponsorUsers.map((u) => u.uniqueId);
    for (const [index, club] of CLUB_DEFINITIONS.entries()) {
      const clubId = clubIdByName.get(club.name)!;
      const primarySponsor = sponsorUniqueIds[index % sponsorUniqueIds.length]!;
      const secondarySponsor =
        sponsorUniqueIds[(index + 9) % sponsorUniqueIds.length]!;

      const sponsorIds =
        club.category === "LEADERSHIP" || club.category === "HONOR"
          ? [primarySponsor, secondarySponsor]
          : [primarySponsor];

      for (const uniqueId of sponsorIds) {
        const user = userByUniqueId.get(uniqueId);
        if (user) {
          await ctx.db.insert("clubSponsors", {
            clubId,
            userId: user._id,
            addedAt: now,
          });
          await ctx.db.insert("clubMembers", {
            clubId,
            userId: user._id,
            roleId: defaultRoleIdByClub.get(club.name)!,
            joinedAt: now,
          });
          sponsorsSeeded++;
        }
      }
    }

    // Seed Channels and Channel Memberships
    let channelMembershipsSeeded = 0;
    for (const club of CLUB_DEFINITIONS) {
      const clubId = clubIdByName.get(club.name)!;
      const leaderId =
        clubLeaderIds.get(club.name)?.[0] ?? userByUniqueId.get("TCH001")!._id;
      const blueprints = buildChannelBlueprints(club, rng);
      const memberIds = studentUsers
        .filter((u) => membersByClub.get(club.name)?.has(u.uniqueId))
        .map((u) => u._id);
      const leaderIds = clubLeaderIds.get(club.name) ?? [];

      for (const bp of blueprints) {
        const channelId = await ctx.db.insert("clubChannels", {
          clubId,
          name: bp.name,
          description: bp.description,
          visibility: bp.visibility,
          createdById: leaderId,
          createdAt: now,
          updatedAt: now,
        });
        channelsSeeded++;

        // Private / officers channel gets restricted membership
        if (bp.name === "officers") {
          const extraCount = Math.min(
            6,
            Math.max(2, Math.floor(memberIds.length / 20)),
          );
          const extraIds = rng
            .shuffle(memberIds.filter((mid) => !leaderIds.includes(mid)))
            .slice(0, extraCount);

          for (const userId of [...leaderIds, ...extraIds]) {
            await ctx.db.insert("clubChannelMemberships", {
              channelId,
              userId,
              createdAt: now,
            });
            channelMembershipsSeeded++;
          }
        }
      }
    }

    // Seed Join Requests
    let joinRequestsSeeded = 0;
    const requestClubs = CLUB_DEFINITIONS.filter(
      (c) => c.joinPolicy === "REQUEST",
    );
    const sampleRequests = requestClubs.slice(0, 12);
    for (const [index, club] of sampleRequests.entries()) {
      const clubId = clubIdByName.get(club.name)!;
      const nonMembers = studentUsers.filter(
        (u) => !membersByClub.get(club.name)?.has(u.uniqueId),
      );
      const requesters = rng
        .shuffle(nonMembers)
        .slice(0, index % 2 === 0 ? 2 : 1);

      for (const student of requesters) {
        await ctx.db.insert("clubJoinRequests", {
          clubId,
          requesterId: student._id,
          status: "PENDING",
          createdAt: now,
          updatedAt: now,
        });
        joinRequestsSeeded++;
      }
    }

    return {
      clubsSeeded: CLUB_DEFINITIONS.length,
      membersSeeded,
      sponsorsSeeded,
      channelsSeeded,
      joinRequestsSeeded,
    };
  },
});
