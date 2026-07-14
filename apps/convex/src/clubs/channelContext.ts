export const MAX_CHANNEL_CONTEXT_MEMBERS = 60;
export const MAX_CHANNEL_CONTEXT_SOURCE_ROWS = MAX_CHANNEL_CONTEXT_MEMBERS * 2;

type ClubMemberRole = "MEMBER" | "LEADER" | "SPONSOR";

type ClubMemberRow<UserId extends string> = {
  userId: UserId;
  role?: ClubMemberRole;
};

type UserRow<UserId extends string> = {
  userId: UserId;
};

export type ChannelContextMemberCandidate<UserId extends string> = {
  userId: UserId;
  role: ClubMemberRole;
};

export function selectChannelContextMemberCandidates<UserId extends string>({
  visibility,
  sponsors,
  clubMembers,
  channelMembers,
}: {
  visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";
  sponsors: UserRow<UserId>[];
  clubMembers: ClubMemberRow<UserId>[];
  channelMembers: UserRow<UserId>[];
}): ChannelContextMemberCandidate<UserId>[] {
  const candidates = new Map<UserId, ChannelContextMemberCandidate<UserId>>();
  const roles = new Map(
    clubMembers.map((member) => [member.userId, normalizeRole(member.role)] as const),
  );

  for (const sponsor of sponsors) {
    candidates.set(sponsor.userId, { userId: sponsor.userId, role: "SPONSOR" });
  }

  const audience = visibility === "PRIVATE" ? channelMembers : clubMembers;
  for (const member of audience) {
    if (candidates.has(member.userId)) continue;
    candidates.set(member.userId, {
      userId: member.userId,
      role: roles.get(member.userId) ?? "MEMBER",
    });
  }

  return Array.from(candidates.values()).slice(0, MAX_CHANNEL_CONTEXT_MEMBERS);
}

function normalizeRole(role?: ClubMemberRole): ClubMemberRole {
  return role ?? "MEMBER";
}
