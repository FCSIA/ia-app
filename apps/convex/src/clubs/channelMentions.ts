import { ConvexError } from "convex/values";
import { portableMentionTokens } from "./channelMarkdown";

export const MAX_CHANNEL_MENTION_TOKENS = 20;
export const MAX_CHANNEL_MENTION_RECIPIENTS = 50;

/**
 * Group mentions use a compact token so `School Leads`, `school-leads`, and
 * `@schoolleads` resolve to the same role or substructure target.
 */
export function toMentionGroupToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function boundedPortableMentionTokens(body: string, bodyMarkdown?: string) {
  const tokens = portableMentionTokens(body, bodyMarkdown);
  const byNormalizedToken = new Map<string, string>();
  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    if (!byNormalizedToken.has(normalizedToken)) {
      byNormalizedToken.set(normalizedToken, token);
    }
  }
  const deduplicated = Array.from(byNormalizedToken.values());
  if (deduplicated.length > MAX_CHANNEL_MENTION_TOKENS) {
    throw new ConvexError("A message can include at most 20 mentions");
  }
  return deduplicated;
}

export function assertCanMentionEveryone(
  tokens: string[],
  canManageChannels: boolean,
) {
  if (
    tokens.some((token) => token.toLowerCase() === "all") &&
    !canManageChannels
  ) {
    throw new ConvexError("Only channel managers can mention everyone");
  }
}

export function addBoundedMentionRecipients<T>(
  recipients: Set<T>,
  additions: Iterable<T>,
) {
  for (const recipient of additions) {
    recipients.add(recipient);
    if (recipients.size > MAX_CHANNEL_MENTION_RECIPIENTS) {
      throw new ConvexError("Mention groups can include at most 50 people");
    }
  }
}
