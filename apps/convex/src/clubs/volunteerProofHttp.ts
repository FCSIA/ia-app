import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/** Authenticated image serving keeps proof access tied to current club permissions. */
export const getVolunteerProof = httpAction(async (ctx, request) => {
  if (!(await ctx.auth.getUserIdentity())) return new Response(null, { status: 401 });
  const logId = new URL(request.url).searchParams.get("logId");
  if (!logId) return new Response(null, { status: 400 });
  try {
    const storageId = await ctx.runQuery(internal.clubs.volunteering.getProofStorageId, {
      logId: logId as Id<"clubVolunteerLogs">,
    });
    if (!storageId) return new Response(null, { status: 404 });
    const blob = await ctx.storage.get(storageId);
    if (!blob) return new Response(null, { status: 404 });
    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
});
