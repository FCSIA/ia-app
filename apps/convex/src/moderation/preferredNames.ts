import { ConvexError } from "convex/values";
import { Filter } from "glin-profanity";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { deliverNotification } from "../notifications/delivery";

const MAX_ACTIVE_RULES = 1_000;

/** Match the original English dictionary plus school rules, with evasion checks. */
export function filterPreferredName(text: string, keywords: string[]) {
  const filter = new Filter({
    languages: ["english"],
    customWords: ["crap", ...keywords],
    wordBoundaries: true,
    detectLeetspeak: true,
    normalizeUnicode: true,
    replaceWith: "***",
  });
  const result = filter.checkProfanity(text);
  if (!result.containsProfanity) {
    return { masked: text, wasFiltered: false, matchedWords: [] as string[] };
  }

  let masked = result.processedText ?? text;
  // The library detects normalized/obfuscated terms but can leave their original
  // spelling unmasked. Never save or index that spelling as a display name.
  if (masked === text || filter.checkProfanity(masked).containsProfanity) {
    masked = "*".repeat(Array.from(text).length);
  }
  return { masked, wasFiltered: true, matchedWords: result.profaneWords };
}

export async function moderatePreferredName(
  ctx: MutationCtx,
  user: Doc<"users">,
  preferredName: string,
) {
  if (!preferredName) return preferredName;
  const rules = await ctx.db.query("moderationKeywordRules")
    .withIndex("by_isActive_and_createdAt", (q) => q.eq("isActive", true))
    .take(MAX_ACTIVE_RULES + 1);
  if (rules.length > MAX_ACTIVE_RULES) {
    throw new ConvexError("Safety rules are temporarily unavailable. Try again later.");
  }
  const result = filterPreferredName(preferredName, rules.map((rule) => rule.keyword));
  if (!result.wasFiltered) return preferredName;

  // Keep the original short name only in the staff report so later name changes
  // cannot erase review context. Notifications never repeat the flagged text.
  const reportId = await ctx.db.insert("moderationReports", {
    submitterId: user._id,
    reportedUserId: user._id,
    contentType: "PREFERRED_NAME",
    contentId: user._id,
    reason: `Automated: Preferred name filtered for language. Submitted name: “${preferredName}”.`,
    status: "PENDING",
    isEscalated: false,
    createdAt: Date.now(),
  });
  await logAuditEvent(ctx, {
    actorId: user._id,
    action: "AUTO_MODERATION_FLAGGED",
    entityType: "Report",
    entityId: reportId,
    meta: { contentType: "PREFERRED_NAME", contentId: user._id, matchedWords: result.matchedWords },
  });
  await deliverNotification(ctx, {
    userId: user._id,
    category: "CONTENT_MODERATED",
    title: "Preferred name filtered for language",
    body: "Your preferred name was masked. Choose another name in Profile & Settings.",
    href: "/profile",
    subject: { kind: "moderationReport", reportId },
  });
  return result.masked;
}
