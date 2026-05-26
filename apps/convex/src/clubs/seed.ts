import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { type Pathway } from "../validators";
import { type AppRole } from "../lib/roles";

type SeedClubCategory =
  | "PATHWAY"
  | "ACADEMIC"
  | "LEADERSHIP"
  | "CREATIVE"
  | "SERVICE"
  | "HONOR"
  | "COMPETITIVE";

interface SeedClubDefinition {
  name: string;
  description: string;
  joinPolicy: "OPEN" | "REQUEST";
  category: SeedClubCategory;
  pathway?: Pathway | null;
  gradeLevels?: number[];
}

const CLUB_DEFINITIONS: SeedClubDefinition[] = [
  {
    name: "Robotics Club",
    description: "Competition robotics, autonomous testing, fabrication sprints, and regional scrimmage prep.",
    joinPolicy: "OPEN",
    category: "PATHWAY",
    pathway: "ENGINEERING",
  },
  {
    name: "Girls Who Code",
    description: "Peer-led coding workshops, portfolio projects, and hackathon collaboration for students building in tech.",
    joinPolicy: "OPEN",
    category: "PATHWAY",
    pathway: "INFORMATION_TECHNOLOGY",
  },
  {
    name: "HOSA",
    description: "Health-science competition prep, clinical skills practice, and service events tied to pathway learning.",
    joinPolicy: "REQUEST",
    category: "PATHWAY",
    pathway: "HEALTH_SCIENCE",
  },
  {
    name: "Science Olympiad",
    description: "Build events, study events, and tournament preparation across biology, chemistry, and engineering.",
    joinPolicy: "REQUEST",
    category: "COMPETITIVE",
  },
  {
    name: "Math Team",
    description: "Problem-solving sessions, contest practice, and collaborative coaching for AMC-style competition math.",
    joinPolicy: "REQUEST",
    category: "ACADEMIC",
  },
  {
    name: "Quiz Bowl",
    description: "Fast-paced tossup and bonus practice spanning literature, science, social studies, and current events.",
    joinPolicy: "REQUEST",
    category: "COMPETITIVE",
  },
  {
    name: "Technology Student Association",
    description: "Hands-on technical challenges, design presentations, and TSA event teams across pathway disciplines.",
    joinPolicy: "REQUEST",
    category: "COMPETITIVE",
    pathway: "ENGINEERING",
  },
  {
    name: "CyberPatriot",
    description: "Defensive cybersecurity training, image hardening, and competition drills for security-minded students.",
    joinPolicy: "REQUEST",
    category: "COMPETITIVE",
    pathway: "INFORMATION_TECHNOLOGY",
  },
  {
    name: "AI Research Club",
    description: "Applied machine-learning demos, ethics discussions, and student-built AI experiments outside class.",
    joinPolicy: "REQUEST",
    category: "PATHWAY",
    pathway: "INFORMATION_TECHNOLOGY",
  },
  {
    name: "Biotechnology Club",
    description: "Wet-lab skill building, biotech news breakdowns, and student-led bioscience exploration.",
    joinPolicy: "REQUEST",
    category: "PATHWAY",
    pathway: "HEALTH_SCIENCE",
  },
  {
    name: "Engineering Design Guild",
    description: "Prototype critiques, CAD showcases, and applied design-challenge workshops for makers across grades.",
    joinPolicy: "OPEN",
    category: "PATHWAY",
    pathway: "ENGINEERING",
  },
  {
    name: "Game Design Collective",
    description: "Game jams, playtesting, animation critiques, and level-design reviews for interactive-media students.",
    joinPolicy: "OPEN",
    category: "PATHWAY",
    pathway: "INFORMATION_TECHNOLOGY",
  },
  {
    name: "eSports",
    description: "Competitive gaming, strategy review, streaming, and team coordination for IA’s eSports community.",
    joinPolicy: "OPEN",
    category: "COMPETITIVE",
    pathway: "INFORMATION_TECHNOLOGY",
  },
  {
    name: "Fencing Club",
    description: "Competitive gaming, strategy review, streaming, and team coordination for IA’s competitive fencing program.",
    joinPolicy: "OPEN",
    category: "COMPETITIVE",
  },
  {
    name: "Mu Alpha Theta",
    description: "Math honor society programming built around tutoring, enrichment, and competition support.",
    joinPolicy: "REQUEST",
    category: "HONOR",
  },
  {
    name: "Science National Honor Society",
    description: "Science honor society service, speaker events, outreach, and STEM mentorship projects.",
    joinPolicy: "REQUEST",
    category: "HONOR",
  },
  {
    name: "National English Honor Society",
    description: "Reading initiatives, writing workshops, and literary programming for students active in English studies.",
    joinPolicy: "REQUEST",
    category: "HONOR",
  },
  {
    name: "9th Grade Student Government",
    description: "Freshman student voice, event planning, and service coordination for the class of ninth graders.",
    joinPolicy: "REQUEST",
    category: "LEADERSHIP",
    gradeLevels: [9],
  },
  {
    name: "10th Grade Student Government",
    description: "Sophomore student leadership focused on class culture, event planning, and service projects.",
    joinPolicy: "REQUEST",
    category: "LEADERSHIP",
    gradeLevels: [10],
  },
  {
    name: "11th Grade Student Government",
    description: "Junior student leadership focused on school events, student advocacy, and class initiatives.",
    joinPolicy: "REQUEST",
    category: "LEADERSHIP",
    gradeLevels: [11],
  },
  {
    name: "12th Grade Student Government",
    description: "Senior leadership team responsible for traditions, showcases, and large school-community events.",
    joinPolicy: "REQUEST",
    category: "LEADERSHIP",
    gradeLevels: [12],
  },
  {
    name: "IA Beacon",
    description: "Student publication staff collaborating on reporting, editing, photography, and feature planning.",
    joinPolicy: "OPEN",
    category: "CREATIVE",
  },
  {
    name: "Debate Union",
    description: "Argument clinics, policy and public-forum practice, and speaking workshops for students who like live reasoning.",
    joinPolicy: "OPEN",
    category: "ACADEMIC",
  },
  {
    name: "Art & Design Lab",
    description: "Collaborative studio sessions, critiques, poster design, and showcase prep for visual-art students.",
    joinPolicy: "OPEN",
    category: "CREATIVE",
  },
  {
    name: "Music Production Club",
    description: "Beat sessions, songwriting swaps, live recording experiments, and peer feedback on student tracks.",
    joinPolicy: "OPEN",
    category: "CREATIVE",
  },
  {
    name: "Service Leadership Council",
    description: "Community impact planning, volunteer logistics, and schoolwide service initiatives.",
    joinPolicy: "OPEN",
    category: "SERVICE",
  },
];

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
        description: "Build logs, project checkpoints, and student work reviews.",
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

export const run = mutation({
  args: {
    secret: v.string(),
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
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const rng = new SeedRandom(20260417);
    const now = Date.now();

    if (args.reset) {
      // Clean up previous seeds
      const oldMembers = await ctx.db.query("clubMembers").take(5000);
      for (const m of oldMembers) await ctx.db.delete(m._id);

      const oldSponsors = await ctx.db.query("clubSponsors").take(5000);
      for (const s of oldSponsors) await ctx.db.delete(s._id);

      const oldChannels = await ctx.db.query("clubChannels").take(5000);
      for (const c of oldChannels) await ctx.db.delete(c._id);

      const oldMemberships = await ctx.db.query("clubChannelMemberships").take(5000);
      for (const m of oldMemberships) await ctx.db.delete(m._id);

      const oldRequests = await ctx.db.query("clubJoinRequests").take(5000);
      for (const r of oldRequests) await ctx.db.delete(r._id);

      const oldClubs = await ctx.db.query("clubs").take(5000);
      for (const c of oldClubs) await ctx.db.delete(c._id);
    }

    // Load users
    const allUsers = await ctx.db.query("users").take(5000);
    const studentUsers = allUsers.filter((u) => u.roles.includes("STUDENT") && u.gradeLevel);
    const sponsorUsers = allUsers.filter((u) => u.roles.includes("SPONSOR"));

    const userByUniqueId = new Map(allUsers.map((u) => [u.uniqueId, u]));

    // Seed clubs
    const clubIdByName = new Map<string, any>();
    for (const clubDef of CLUB_DEFINITIONS) {
      const clubId = await ctx.db.insert("clubs", {
        name: clubDef.name,
        description: clubDef.description,
        joinPolicy: clubDef.joinPolicy,
        memberLimit: clubDef.category === "LEADERSHIP" ? 80 : clubDef.category === "PATHWAY" ? 60 : 40,
        joinCode: rng.string(6),
        joinCodeUpdatedAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      clubIdByName.set(clubDef.name, clubId);
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

    const canJoinClub = (student: typeof studentUsers[0], club: SeedClubDefinition) => {
      if (club.gradeLevels && student.gradeLevel && !club.gradeLevels.includes(student.gradeLevel)) return false;
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
        matchingPathwayClubs.length > 0 ? matchingPathwayClubs : fallbackPathwayClubs,
      );
      if (primaryClub) {
        addMembership(student.uniqueId, primaryClub.name);
      }

      const weightedExtras = [
        ...CLUB_DEFINITIONS.filter((club) => student.gradeLevel && club.gradeLevels?.includes(student.gradeLevel)),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "ACADEMIC"),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "CREATIVE"),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "SERVICE"),
        ...CLUB_DEFINITIONS.filter((club) => club.pathway === student.minor),
        ...CLUB_DEFINITIONS.filter((club) => club.category === "COMPETITIVE"),
      ].filter((club) => canJoinClub(student, club));

      const targetCount =
        1 +
        (rng.int(0, 99) < 78 ? 1 : 0) +
        (rng.int(0, 99) < 33 ? 1 : 0);

      let attempts = 0;
      while ((membershipsByStudent.get(student.uniqueId)!.size) < targetCount && attempts < 40) {
        attempts += 1;
        const nextClub = rng.element(weightedExtras);
        if (nextClub) {
          addMembership(student.uniqueId, nextClub.name);
        }
      }
    }

    // Fill clubs to minimum sizes
    for (const club of CLUB_DEFINITIONS) {
      const minimumSize = club.category === "LEADERSHIP" ? 18 : club.category === "HONOR" ? 20 : 24;
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
          return rightGrade - leftGrade || left.uniqueId.localeCompare(right.uniqueId);
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
          role: isLeader ? "LEADER" : "MEMBER",
          joinedAt: now,
        });
        membersSeeded++;
      }
    }

    // Seed Sponsors
    let sponsorsSeeded = 0;
    const sponsorUniqueIds = sponsorUsers.map((u) => u.uniqueId);
    CLUB_DEFINITIONS.forEach((club, index) => {
      const clubId = clubIdByName.get(club.name)!;
      const primarySponsor = sponsorUniqueIds[index % sponsorUniqueIds.length]!;
      const secondarySponsor = sponsorUniqueIds[(index + 9) % sponsorUniqueIds.length]!;
      
      const sponsorIds =
        club.category === "LEADERSHIP" || club.category === "HONOR"
          ? [primarySponsor, secondarySponsor]
          : [primarySponsor];

      for (const uniqueId of sponsorIds) {
        const user = userByUniqueId.get(uniqueId);
        if (user) {
          ctx.db.insert("clubSponsors", {
            clubId,
            userId: user._id,
            addedAt: now,
          });
          ctx.db.insert("clubMembers", {
            clubId,
            userId: user._id,
            role: "SPONSOR",
            joinedAt: now,
          });
          sponsorsSeeded++;
        }
      }
    });

    // Seed Channels and Channel Memberships
    let channelMembershipsSeeded = 0;
    for (const club of CLUB_DEFINITIONS) {
      const clubId = clubIdByName.get(club.name)!;
      const leaderId = clubLeaderIds.get(club.name)?.[0] ?? userByUniqueId.get("TCH001")!._id;
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
          const extraCount = Math.min(6, Math.max(2, Math.floor(memberIds.length / 20)));
          const extraIds = rng.shuffle(memberIds.filter((mid) => !leaderIds.includes(mid))).slice(0, extraCount);

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
    const requestClubs = CLUB_DEFINITIONS.filter((c) => c.joinPolicy === "REQUEST");
    const sampleRequests = requestClubs.slice(0, 12);
    sampleRequests.forEach((club, index) => {
      const clubId = clubIdByName.get(club.name)!;
      const nonMembers = studentUsers.filter((u) => !membersByClub.get(club.name)?.has(u.uniqueId));
      const requesters = rng.shuffle(nonMembers).slice(0, index % 2 === 0 ? 2 : 1);

      for (const student of requesters) {
        ctx.db.insert("clubJoinRequests", {
          clubId,
          requesterId: student._id,
          status: "PENDING",
          createdAt: now,
          updatedAt: now,
        });
        joinRequestsSeeded++;
      }
    });

    return {
      clubsSeeded: CLUB_DEFINITIONS.length,
      membersSeeded,
      sponsorsSeeded,
      channelsSeeded,
      joinRequestsSeeded,
    };
  },
});
