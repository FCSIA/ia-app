import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentAppUser } from "../../lib/currentUser";
import { requireStudentUser } from "./_lib";
import { claimUploadIntent } from "../uploads/uploadIntents";
import {
  assertSafeStoredFile,
  normalizeStoredFileMime,
} from "../uploads/fileSignatures";
import { scheduleOcrRateLimiter } from "../rateLimits";
import { extractVisionScheduleLines } from "../../../shared/schedule/vision-ocr";

const MAX_SCHEDULE_IMAGE_BYTES = 10 * 1024 * 1024;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";

const ocrLineValidator = v.object({
  text: v.string(),
  confidence: v.number(),
  left: v.number(),
  top: v.number(),
  right: v.number(),
  bottom: v.number(),
});

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function base64Url(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function bytesToBase64(bytes: ArrayBuffer) {
  const values = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < values.length; index += 0x8000) {
    binary += String.fromCharCode(...values.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function privateKeyBytes(privateKey: string) {
  const base64 = privateKey.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    "",
  );
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readServiceAccount(): GoogleServiceAccount {
  const raw = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new ConvexError("Schedule import is not configured yet.");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as GoogleServiceAccount).client_email !== "string" ||
      typeof (parsed as GoogleServiceAccount).private_key !== "string"
    ) {
      throw new Error("Invalid service account");
    }
    return parsed as GoogleServiceAccount;
  } catch {
    throw new ConvexError("Schedule import is not configured yet.");
  }
}

async function googleAccessToken() {
  const account = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: GOOGLE_VISION_SCOPE,
      aud: account.token_uri ?? GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 60 * 60,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${bytesToBase64Url(signature)}`;
  const response = await fetch(account.token_uri ?? GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    typeof (body as { access_token?: unknown }).access_token !== "string"
  ) {
    throw new ConvexError(
      "Schedule import could not connect to Google Vision.",
    );
  }
  return (body as { access_token: string }).access_token;
}

export const prepareImage = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage") },
  returns: v.object({ url: v.string(), mimeType: v.string() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const rate = await scheduleOcrRateLimiter.limit(ctx, "scansByUser", {
      key: user._id,
    });
    if (!rate.ok)
      throw new ConvexError("Too many schedule imports. Try again later.");
    const metadata = await claimUploadIntent(ctx, {
      ...args,
      uploaderId: user._id,
      purpose: "SCHEDULE_OCR",
    });
    const mimeType = normalizeStoredFileMime(metadata.contentType ?? "");
    if (
      !new Set(["image/jpeg", "image/png", "image/webp"]).has(mimeType) ||
      metadata.size > MAX_SCHEDULE_IMAGE_BYTES
    ) {
      throw new ConvexError(
        "Choose a PNG, JPEG, or WebP image smaller than 10 MB.",
      );
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Schedule image not found.");
    return { url, mimeType };
  },
});

export const discardImage = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const intent = await ctx.db.get(args.uploadIntentId);
    if (
      !intent ||
      intent.uploaderId !== user._id ||
      intent.storageId !== args.storageId ||
      intent.purpose !== "SCHEDULE_OCR"
    )
      throw new ConvexError("Unauthorized");
    await ctx.storage.delete(args.storageId).catch(() => {});
    await ctx.db.delete(args.uploadIntentId);
    return null;
  },
});

export const scanImage = action({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage") },
  returns: v.object({ fullText: v.string(), lines: v.array(ocrLineValidator) }),
  handler: async (ctx, args) => {
    try {
      const prepared = await ctx.runMutation(
        internal.schedule.importOcr.prepareImage,
        args,
      );
      const imageResponse = await fetch(prepared.url);
      if (!imageResponse.ok) throw new ConvexError("Schedule image not found.");
      const image = await imageResponse.arrayBuffer();
      assertSafeStoredFile(image, prepared.mimeType);
      const accessToken = await googleAccessToken();
      const visionResponse = await fetch(GOOGLE_VISION_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: bytesToBase64(image) },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      });
      const body: unknown = await visionResponse.json().catch(() => null);
      const result =
        body &&
        typeof body === "object" &&
        Array.isArray((body as { responses?: unknown }).responses)
          ? (body as { responses: unknown[] }).responses[0]
          : null;
      if (
        !visionResponse.ok ||
        !result ||
        (result as { error?: unknown }).error
      )
        throw new ConvexError("Google Vision could not read this image.");
      const annotation = (result as { fullTextAnnotation?: unknown })
        .fullTextAnnotation;
      const fullText =
        annotation &&
        typeof annotation === "object" &&
        typeof (annotation as { text?: unknown }).text === "string"
          ? (annotation as { text: string }).text
          : "";
      return { fullText, lines: extractVisionScheduleLines(annotation) };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      throw new ConvexError("Schedule import could not read this image.");
    } finally {
      await ctx
        .runMutation(internal.schedule.importOcr.discardImage, args)
        .catch(() => {});
    }
  },
});
