import { ConvexError, v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import { internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { type NotificationCategory } from "../validators";

export const run = internalMutation({
  args: {
    reset: v.optional(v.boolean()),
  },
  returns: v.object({
    announcementsSeeded: v.number(),
    bookmarksSeeded: v.number(),
    keywordsSeeded: v.number(),
    preferencesSeeded: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const promotedUntil = now + oneMonth;
    const nextWeek = now + oneWeek;
    const lastWeek = now - oneWeek;

    if (args.reset) {
      const oldBookmarks = await ctx.db
        .query("announcementBookmarks")
        .take(5000);
      for (const b of oldBookmarks) await ctx.db.delete(b._id);

      const oldReads = await ctx.db.query("announcementReads").take(5000);
      for (const r of oldReads) await ctx.db.delete(r._id);

      const oldComments = await ctx.db.query("comments").take(5000);
      for (const c of oldComments) await ctx.db.delete(c._id);

      const oldAnnouncements = await ctx.db.query("announcements").take(5000);
      for (const a of oldAnnouncements) await ctx.db.delete(a._id);

      const oldKeywords = await ctx.db
        .query("moderationKeywordRules")
        .take(100);
      for (const k of oldKeywords) await ctx.db.delete(k._id);

      const oldPreferences = await ctx.db
        .query("notificationPreferences")
        .take(20000);
      for (const p of oldPreferences) await ctx.db.delete(p._id);

      const oldDeliveries = await ctx.db
        .query("notificationDeliveries")
        .take(20000);
      for (const delivery of oldDeliveries) await ctx.db.delete(delivery._id);
    }

    // Load necessary users
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "ADMIN001"))
      .unique();
    const teacherUser = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "TCH001"))
      .unique();
    const stu1 = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "STU001"))
      .unique();
    const stu3 = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "STU003"))
      .unique();

    if (!adminUser || !teacherUser) {
      throw new ConvexError("ADMIN001 or TCH001 must be seeded first.");
    }

    const adminId = adminUser._id;
    const teacherId = teacherUser._id;

    // Load clubs
    const roboticsClub = await ctx.db
      .query("clubs")
      .filter((q) => q.eq(q.field("name"), "Robotics Club"))
      .unique();
    const hosaClub = await ctx.db
      .query("clubs")
      .filter((q) => q.eq(q.field("name"), "HOSA"))
      .unique();
    const cyberClub = await ctx.db
      .query("clubs")
      .filter((q) => q.eq(q.field("name"), "CyberPatriot"))
      .unique();
    const beaconClub = await ctx.db
      .query("clubs")
      .filter((q) => q.eq(q.field("name"), "IA Beacon"))
      .unique();

    // Find Robotics Club leader
    let roboticsLeaderId = stu3?._id ?? teacherId;
    if (roboticsClub) {
      const leaderMember = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", roboticsClub._id))
        .filter((q) => q.eq(q.field("role"), "LEADER"))
        .first();
      if (leaderMember) {
        roboticsLeaderId = leaderMember.userId;
      }
    }

    const announcements: Array<WithoutSystemFields<Doc<"announcements">>> = [
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: now,
        title: "Welcome to IA School App",
        body: "This is the official school communication platform for schedules, clubs, events, and announcements across Innovation Academy.",
        targetType: "SCHOOL_WIDE",
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: true,
        allowComments: false,
        status: "ACTIVE",
        promotedUntil,
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: now,
        title: "April Flex Friday Registration Opens Monday",
        body: "Registration opens Monday at 8:00 AM in the events portal. Reserve workshop seats early so you can stay on pace for annual Flex Friday credits.",
        targetType: "SCHOOL_WIDE",
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: true,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: now,
        title: "Innovation Showcase Night This Thursday",
        body: "Families and partners are invited to walk project galleries, see pathway demos, and meet student teams across every grade level.",
        targetType: "SCHOOL_WIDE",
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: true,
        allowComments: true,
        status: "ACTIVE",
        expiresAt: nextWeek,
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: now,
        title: "Freshman GT Block Pathway Showcase",
        body: "Ninth graders will rotate through Health Science, Engineering, and IT labs during next week’s GT Block showcase. Bring your lanyard and Chromebook.",
        targetType: "GRADE",
        targetGrade: 9,
        targetGrades: [9],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: now,
        title: "Junior Pinnacle Proposal Window Opens",
        body: "Students preparing for junior research should submit proposal drafts before advisory next Wednesday so mentors can review placement needs.",
        targetType: "GRADE",
        targetGrade: 11,
        targetGrades: [11, 12],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: adminId,
        approvedAt: now,
        title: "AI Track Interest Meeting for IT Students",
        body: "Information Technology students interested in the AI sequence should join the after-school interest meeting in Lab 214 to review sequencing and project expectations.",
        targetType: "PATHWAY",
        targetPathway: "INFORMATION_TECHNOLOGY",
        targetMajorPathways: ["INFORMATION_TECHNOLOGY"],
        targetMinorPathways: ["INFORMATION_TECHNOLOGY"],
        targetGrades: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: adminId,
        approvedAt: now,
        title: "Engineering Fabrication Safety Refresh",
        body: "Engineering students using fabrication spaces this month need to complete the updated safety check before machine sign-off can be renewed.",
        targetType: "PATHWAY",
        targetPathway: "ENGINEERING",
        targetMajorPathways: ["ENGINEERING"],
        targetMinorPathways: [],
        targetGrades: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: adminId,
        approvedAt: now,
        title: "Health Science Simulation Lab Signups",
        body: "Simulation lab stations for clinical-skills practice are open this week. Review the posted procedure rubric before choosing a session block.",
        targetType: "PATHWAY",
        targetPathway: "HEALTH_SCIENCE",
        targetMajorPathways: ["HEALTH_SCIENCE"],
        targetMinorPathways: [],
        targetGrades: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: teacherId,
        approvedAt: now,
        title: "Robotics Club Scrimmage Build Saturday",
        body: "Robotics Club will run a Saturday build and driver practice session in the fabrication lab. Wear closed-toe shoes and check the officers channel for the task board.",
        targetType: "CLUB",
        clubId: roboticsClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        promotedUntil,
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: teacherId,
        approvedAt: now,
        title: "HOSA Clinical Skills Workshop Sign-Up",
        body: "HOSA members can sign up for the after-school clinical skills workshop focused on patient assessment and EMT scenarios. Space is limited to the first 20 registrations.",
        targetType: "CLUB",
        clubId: hosaClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: teacherId,
        approvedAt: now,
        title: "CyberPatriot Practice Image Released",
        body: "The new practice image is posted in the competition-prep channel. Teams should complete first-pass hardening before Wednesday review.",
        targetType: "CLUB",
        clubId: cyberClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: teacherId,
        submittedById: teacherId,
        approvedById: teacherId,
        approvedAt: now,
        title: "IA Beacon Story Pitch Round",
        body: "Beacon writers should submit one profile idea and one campus-news idea before Friday so the editorial board can lock next issue assignments.",
        targetType: "CLUB",
        clubId: beaconClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: roboticsLeaderId,
        submittedById: roboticsLeaderId,
        title: "Robotics fundraiser announcement draft",
        body: "Student leaders drafted this update for sponsor approval. It should appear in the sponsor review queue before it is published.",
        targetType: "CLUB",
        clubId: roboticsClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: true,
        status: "PENDING_APPROVAL",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: roboticsLeaderId,
        submittedById: roboticsLeaderId,
        approvedById: teacherId,
        title: "Rejected robotics travel note",
        body: "This seeded proposal demonstrates rejected copy and sponsor feedback.",
        targetType: "CLUB",
        clubId: roboticsClub?._id,
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: false,
        status: "REJECTED",
        rejectionNote:
          "Please confirm the travel date and remove unapproved cost language.",
        createdAt: now,
        updatedAt: now,
      },
      {
        authorId: adminId,
        submittedById: adminId,
        approvedById: adminId,
        approvedAt: lastWeek,
        title: "Expired parking reminder",
        body: "This announcement is intentionally expired so archive and expired filters have seeded data.",
        targetType: "SCHOOL_WIDE",
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        isAdminGeneral: false,
        allowComments: false,
        status: "EXPIRED",
        expiresAt: lastWeek,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const annIds: any[] = [];
    for (const ann of announcements) {
      const id = await ctx.db.insert("announcements", ann);
      annIds.push({ id, title: ann.title });
    }

    const annIdByTitle = new Map(annIds.map((a) => [a.title, a.id]));

    // Seed bookmarks
    let bookmarksSeeded = 0;
    if (stu1) {
      const aId = annIdByTitle.get("Welcome to IA School App");
      if (aId) {
        await ctx.db.insert("announcementBookmarks", {
          announcementId: aId,
          userId: stu1._id,
          createdAt: now,
        });
        bookmarksSeeded++;
      }
    }
    if (stu3) {
      const aId = annIdByTitle.get("Robotics Club Scrimmage Build Saturday");
      if (aId) {
        await ctx.db.insert("announcementBookmarks", {
          announcementId: aId,
          userId: stu3._id,
          createdAt: now,
        });
        bookmarksSeeded++;
      }
    }
    const aId2 = annIdByTitle.get("Innovation Showcase Night This Thursday");
    if (aId2) {
      await ctx.db.insert("announcementBookmarks", {
        announcementId: aId2,
        userId: teacherId,
        createdAt: now,
      });
      bookmarksSeeded++;
    }

    // Seed keyword rules
    const superUser = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "SUPER001"))
      .unique();
    const superId = superUser?._id ?? adminId;

    const keywords = ["violence", "weapon", "drugs"];
    for (const kw of keywords) {
      await ctx.db.insert("moderationKeywordRules", {
        keyword: kw,
        addedById: superId,
        isActive: true,
        createdAt: now,
      });
    }

    // Seed default notification preferences for all users
    let preferencesSeeded = 0;
    const allUsers = await ctx.db.query("users").take(5000);

    // Get general channel of robotics club
    let roboticsGeneralId: string | undefined;
    if (roboticsClub) {
      const chan = await ctx.db
        .query("clubChannels")
        .withIndex("by_clubId_and_visibility", (q) =>
          q.eq("clubId", roboticsClub._id),
        )
        .filter((q) => q.eq(q.field("name"), "general"))
        .first();
      if (chan) {
        roboticsGeneralId = chan._id;
      }
    }

    const roboticsClubMembers = roboticsClub
      ? await ctx.db
          .query("clubMembers")
          .withIndex("by_clubId", (q) => q.eq("clubId", roboticsClub._id))
          .collect()
      : [];
    const roboticsMemberIds = new Set(roboticsClubMembers.map((m) => m.userId));

    for (const u of allUsers) {
      const basePrefs: Array<{
        category: NotificationCategory;
        scopeKey: string;
        clubId?: string;
        channelId?: string;
        locked?: boolean;
      }> = [
        { category: "SCHOOL_ANNOUNCEMENT", scopeKey: "global", locked: true },
        { category: "EVENT", scopeKey: "global" },
        { category: "FLEX_FRIDAY", scopeKey: "global" },
        { category: "CLUB_CHANNEL_MENTION", scopeKey: "global" },
      ];

      // Check if user is in robotics club
      let isInRobotics = roboticsMemberIds.has(u._id);

      if (isInRobotics && roboticsClub) {
        basePrefs.push({
          category: "CLUB_ANNOUNCEMENT",
          clubId: roboticsClub._id,
          scopeKey: `club:${roboticsClub._id}`,
        });
        if (roboticsGeneralId) {
          basePrefs.push({
            category: "CLUB_CHANNEL_MENTION",
            clubId: roboticsClub._id,
            channelId: roboticsGeneralId,
            scopeKey: `channel:${roboticsGeneralId}`,
          });
        }
      }

      for (const bp of basePrefs) {
        await ctx.db.insert("notificationPreferences", {
          userId: u._id,
          category: bp.category,
          enabled: true,
          level: "IN_APP",
          locked: bp.locked ?? false,
          clubId: bp.clubId,
          channelId: bp.channelId,
          scopeKey: bp.scopeKey,
          createdAt: now,
          updatedAt: now,
        });
        preferencesSeeded++;
      }
    }

    // Add extra sample message and poll in Robotics Club General channel if they exist
    if (roboticsClub && roboticsGeneralId) {
      const pinnedMessageId = await ctx.db.insert("clubChannelMessages", {
        channelId: roboticsGeneralId as any,
        authorId: teacherId,
        body: "Pinned build checklist: charge batteries, confirm drive team, and bring safety glasses.",
        isPinned: true,
        pinnedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("clubChannelMessageAttachments", {
        messageId: pinnedMessageId,
        fileName: "build-checklist.pdf",
        fileUrl: "/uploads/seed/build-checklist.pdf",
        mimeType: "application/pdf",
        size: 128000,
        createdAt: now,
      });

      const pollOptions = [
        { id: "tuesday", label: "Tuesday after school" },
        { id: "thursday", label: "Thursday after school" },
        { id: "saturday", label: "Saturday morning" },
      ];

      const pollMessageId = await ctx.db.insert("clubChannelMessages", {
        channelId: roboticsGeneralId as any,
        authorId: roboticsLeaderId,
        body: "Vote for the next drive practice. You can use **markdown**, tables, and math like $v = d/t$ in chat.",
        pollQuestion: "When should we hold drive practice?",
        pollOptions,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      });

      // Vote mock data (18 votes)
      const clubMembers = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", roboticsClub._id))
        .take(18);

      for (let i = 0; i < clubMembers.length; i++) {
        const m = clubMembers[i]!;
        await ctx.db.insert("clubChannelMessagePollVotes", {
          messageId: pollMessageId,
          userId: m.userId,
          optionId: pollOptions[i % pollOptions.length]!.id,
          createdAt: now,
        });
      }
    }

    return {
      announcementsSeeded: announcements.length,
      bookmarksSeeded,
      keywordsSeeded: keywords.length,
      preferencesSeeded,
    };
  },
});
