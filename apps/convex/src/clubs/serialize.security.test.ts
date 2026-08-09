import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { clubSummaryWithCounts, toClubUserRef } from "./serialize";

describe("club payload serialization", () => {
  test("never exposes member email addresses", () => {
    const user = {
      _id: "user",
      uniqueId: "student-1",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: ["STUDENT"],
      avatarUrl: "https://example.test/avatar.png",
      email: "private@example.test",
    } as unknown as Doc<"users">;

    expect(toClubUserRef(user)).toEqual({
      _id: "user",
      uniqueId: "student-1",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: ["STUDENT"],
      avatarUrl: "https://example.test/avatar.png",
    });
  });

  test("never exposes club join codes in list summaries", async () => {
    const collect = async () => [];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ collect }),
        }),
      },
    };
    const club = {
      _id: "club",
      _creationTime: 1,
      name: "Robotics",
      joinCode: "SECRET-CODE",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Doc<"clubs">;

    const summary = await clubSummaryWithCounts(ctx as never, club);
    expect(summary).not.toHaveProperty("joinCode");
  });
});
