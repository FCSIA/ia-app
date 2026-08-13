import { describe, expect, it } from "vitest";
import {
  canRespondToCalendarInvite,
  canShareCalendarEntryWithFriend,
} from "./calendarInvitePolicy";

describe("calendar invite policy", () => {
  it("only shares personal entries with active accepted student friends", () => {
    expect(
      canShareCalendarEntryWithFriend({
        senderId: "sender",
        recipientId: "friend",
        recipientIsActive: true,
        recipientIsStudent: true,
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(true);

    expect(
      canShareCalendarEntryWithFriend({
        senderId: "sender",
        recipientId: "friend",
        recipientIsActive: true,
        recipientIsStudent: true,
        friendshipStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      canShareCalendarEntryWithFriend({
        senderId: "sender",
        recipientId: "sender",
        recipientIsActive: true,
        recipientIsStudent: true,
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(false);
  });

  it("only lets the invited friend accept a still-valid pending invite", () => {
    expect(
      canRespondToCalendarInvite({
        isRecipient: true,
        inviteStatus: "PENDING",
        entryIsPersonal: true,
        entryOwnedBySender: true,
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(true);

    expect(
      canRespondToCalendarInvite({
        isRecipient: false,
        inviteStatus: "PENDING",
        entryIsPersonal: true,
        entryOwnedBySender: true,
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(false);
    expect(
      canRespondToCalendarInvite({
        isRecipient: true,
        inviteStatus: "ACCEPTED",
        entryIsPersonal: true,
        entryOwnedBySender: true,
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(false);
  });
});
