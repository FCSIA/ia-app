import { describe, expect, test } from "vitest";
import {
  addBoundedMentionRecipients,
  assertCanMentionEveryone,
  boundedPortableMentionTokens,
  toMentionGroupToken,
} from "./channelMentions";

describe("club channel mention bounds", () => {
  test("deduplicates plain and portable mention tokens", () => {
    expect(
      boundedPortableMentionTokens(
        "Hello @STU001 and @leaders",
        "Hello [Sreyas](user://STU001), @stu001, and @leaders",
      ),
    ).toEqual(["STU001", "leaders"]);
  });

  test("caps semantic mention work", () => {
    expect(() =>
      boundedPortableMentionTokens(
        Array.from({ length: 21 }, (_, index) => `@student-${index}`).join(" "),
      ),
    ).toThrow("A message can include at most 20 mentions");

    const recipients = new Set(Array.from({ length: 49 }, (_, index) => index));
    expect(() => addBoundedMentionRecipients(recipients, [49])).not.toThrow();
    expect(() => addBoundedMentionRecipients(recipients, [50])).toThrow(
      "Mention groups can include at most 50 people",
    );
  });

  test("reserves the everyone mention for channel managers", () => {
    expect(() => assertCanMentionEveryone(["all"], false)).toThrow(
      "Only channel managers can mention everyone",
    );
    expect(() => assertCanMentionEveryone(["ALL"], true)).not.toThrow();
  });

  test("normalizes role and substructure mention tokens", () => {
    expect(toMentionGroupToken("School Leads")).toBe("schoolleads");
    expect(toMentionGroupToken("House-Leads")).toBe("houseleads");
    expect(toMentionGroupToken("Room 101")).toBe("room101");
  });
});
