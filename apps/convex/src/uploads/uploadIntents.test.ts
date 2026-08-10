import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { assertUploadIntentClaim } from "./uploadIntents";

const intentId = "intent" as Id<"uploadIntents">;
const uploaderId = "owner" as Id<"users">;
const otherUserId = "attacker" as Id<"users">;
const storageId = "storage" as Id<"_storage">;

function validInput() {
  return {
    intent: {
      _id: intentId,
      uploaderId,
      purpose: "USER_IMAGE" as const,
      createdAt: 100,
      expiresAt: 1_000,
    },
    metadata: { _creationTime: 101 },
    existingClaim: null,
    storageId,
    uploaderId,
    purpose: "USER_IMAGE" as const,
    now: 500,
  };
}

describe("upload intent ownership", () => {
  test("accepts the owner, purpose, storage object, and validity window together", () => {
    expect(() => assertUploadIntentClaim(validInput())).not.toThrow();
  });

  test("rejects a storage id finalized by a different user", () => {
    expect(() =>
      assertUploadIntentClaim({ ...validInput(), uploaderId: otherUserId }),
    ).toThrow("Upload authorization not found");
  });

  test("rejects old storage ids, expired intents, and reuse", () => {
    expect(() =>
      assertUploadIntentClaim({
        ...validInput(),
        metadata: { _creationTime: 99 },
      }),
    ).toThrow("Upload does not belong");
    expect(() =>
      assertUploadIntentClaim({ ...validInput(), now: 1_001 }),
    ).toThrow("Upload authorization not found");
    expect(() =>
      assertUploadIntentClaim({
        ...validInput(),
        intent: { ...validInput().intent, storageId: "other" as Id<"_storage"> },
      }),
    ).toThrow("already used");
  });
});
