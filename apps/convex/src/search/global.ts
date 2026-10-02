import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getMaybeCurrentAppUser } from "../../lib/currentUser";
import { getChannelViewerContext } from "../clubs/access";

const MAX_PEOPLE_RESULTS = 12;
const MAX_CHANNEL_RESULTS = 18;
const MAX_CLUBS_TO_SCAN = 36;
const MAX_CHANNELS_PER_CLUB = 40;

const personResultValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
  preferredName: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  isDeveloper: v.optional(v.boolean()),
});

const channelResultValidator = v.object({
  _id: v.id("clubChannels"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  visibility: v.union(
    v.literal("PUBLIC"),
    v.literal("PRIVATE"),
    v.literal("MEMBER_READONLY"),
  ),
  club: v.object({
    _id: v.id("clubs"),
    name: v.string(),
  }),
});

function matchesSearch(value: string, search: string) {
  const normalized = value.toLocaleLowerCase();
  return search.split(/\s+/).every((term) => normalized.includes(term));
}

async function getSearchableClubs(
  ctx: QueryCtx,
  user: Doc<"users">,
) {
  if (user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN")) {
    return await ctx.db
      .query("clubs")
      .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
      .take(MAX_CLUBS_TO_SCAN);
  }

  const [memberships, sponsorships] = await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", user._id))
      .take(MAX_CLUBS_TO_SCAN),
    ctx.db
      .query("clubSponsors")
      .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
      .take(MAX_CLUBS_TO_SCAN),
  ]);
  const clubIds = Array.from(
    new Set<Id<"clubs">>([
      ...memberships.map((membership) => membership.clubId),
      ...sponsorships.map((sponsorship) => sponsorship.clubId),
    ]),
  ).slice(0, MAX_CLUBS_TO_SCAN);
  const clubs = await Promise.all(clubIds.map((clubId) => ctx.db.get(clubId)));
  return clubs.filter(
    (club): club is Doc<"clubs"> => !!club?.isActive,
  );
}

export const palette = query({
  args: { search: v.string() },
  returns: v.object({
    people: v.array(personResultValidator),
    channels: v.array(channelResultValidator),
  }),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    const search = args.search.trim().toLocaleLowerCase().slice(0, 80);
    if (!user || search.length < 2) return { people: [], channels: [] };

    const [peopleRows, clubs] = await Promise.all([
      ctx.db
        .query("users")
        .withSearchIndex("search_users", (q) => q.search("searchText", search))
        .take(MAX_PEOPLE_RESULTS * 3),
      getSearchableClubs(ctx, user),
    ]);

    const people = peopleRows
      .filter((person) => person.isActive && person._id !== user._id && (!user.isStudent || (person.isStudent && person.gradeLevel === user.gradeLevel)))
      .slice(0, MAX_PEOPLE_RESULTS)
      .map((person) => ({
        _id: person._id,
        firstName: person.firstName,
        lastName: person.lastName,
        preferredName: person.preferredName,
        avatarUrl: person.avatarUrl ?? null,
        isDeveloper: person.isDeveloper,
      }));

    const channels: Array<{
      _id: Id<"clubChannels">;
      name: string;
      description: string | null;
      visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";
      club: { _id: Id<"clubs">; name: string };
    }> = [];

    for (const club of clubs) {
      if (channels.length >= MAX_CHANNEL_RESULTS) break;
      const context = await getChannelViewerContext(ctx, club, user);
      if (!context.canAccessWorkspace) continue;
      const channelRows = await ctx.db
        .query("clubChannels")
        .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", club._id))
        .take(MAX_CHANNELS_PER_CLUB);

      for (const channel of channelRows) {
        if (channels.length >= MAX_CHANNEL_RESULTS) break;
        if (
          !matchesSearch(
            `${channel.name} ${channel.description ?? ""} ${club.name}`,
            search,
          )
        ) {
          continue;
        }

        if (channel.visibility === "PRIVATE" && !context.canSeePrivateChannels) {
          const membership = await ctx.db
            .query("clubChannelMemberships")
            .withIndex("by_channelId_and_userId", (q) =>
              q.eq("channelId", channel._id).eq("userId", user._id),
            )
            .unique();
          if (!membership) continue;
        }

        channels.push({
          _id: channel._id,
          name: channel.name,
          description: channel.description ?? null,
          visibility: channel.visibility,
          club: { _id: club._id, name: club.name },
        });
      }
    }

    return {
      people,
      channels: channels.sort((left, right) =>
        `${left.club.name} ${left.name}`.localeCompare(
          `${right.club.name} ${right.name}`,
        ),
      ),
    };
  },
});
