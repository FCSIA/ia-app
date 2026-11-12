import { ConvexError, type Infer } from "convex/values";
import { PATHWAY_LABELS } from "../../../shared/labels";
import type { Doc } from "../_generated/dataModel";
import type { clubJoinRulesValidator } from "../validators";

type JoinRules = Infer<typeof clubJoinRulesValidator>;
type StudentMetadata = Pick<Doc<"users">, "isStudent" | "gradeLevel" | "major" | "minor">;

export function clubJoinBlockedReason(rules: JoinRules | undefined, user: StudentMetadata): string | null {
  if (!rules || Object.keys(rules).length === 0) return null;
  const missing: string[] = [];
  if (!user.isStudent) missing.push("be a student");
  if (rules.gradeLevel !== undefined && rules.gradeLevel !== user.gradeLevel) {
    missing.push(`be in grade ${rules.gradeLevel}`);
  }
  if (rules.major !== undefined && rules.major !== user.major) {
    missing.push(`major in ${PATHWAY_LABELS[rules.major]}`);
  }
  if (rules.minor !== undefined && rules.minor !== user.minor) {
    missing.push(`minor in ${PATHWAY_LABELS[rules.minor]}`);
  }
  return missing.length ? `To join this club, you must ${missing.join(" and ")}.` : null;
}

export function requireClubJoinEligibility(rules: JoinRules | undefined, user: StudentMetadata) {
  const reason = clubJoinBlockedReason(rules, user);
  if (reason) throw new ConvexError(reason);
}
