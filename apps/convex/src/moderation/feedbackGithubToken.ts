import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export async function feedbackGithubToken(ctx: ActionCtx): Promise<string | null> {
  return ctx.runAction(internal.moderation.feedbackGithubAuth.installationToken, {});
}
