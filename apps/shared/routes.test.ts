import { describe, expect, test } from "vitest";
import {
  adminFeedbackHref,
  clubChannelHref,
  clubJoinHref,
  clubPeopleRequestsHref,
  matchClubChannelPath,
  matchClubPath,
  matchClubPeoplePath,
  parseClubChannelLink,
  parseClubJoinLink,
  parseClubPeopleLink,
  scheduleFriendHref,
} from "./routes";

describe("routes", () => {
  test("build the exact paths the server has always emitted", () => {
    expect(clubChannelHref("c1", "ch1")).toBe("/clubs/c1/channels/ch1");
    expect(clubChannelHref("c1", "ch1", { messageId: "m1" })).toBe("/clubs/c1/channels/ch1?message=m1");
    expect(clubChannelHref("c1", "ch1", { whiteboardId: "b1" })).toBe("/clubs/c1/channels/ch1?view=whiteboard&board=b1");
    expect(clubPeopleRequestsHref("c1")).toBe("/clubs/c1/people?tab=requests");
    expect(adminFeedbackHref("r1")).toBe("/admin/feedback/r1");
    expect(scheduleFriendHref("u1")).toBe("/schedule?tab=friends&friend=u1");
    expect(clubJoinHref("c1", { code: "ABC" })).toBe("/clubs/c1?joinCode=ABC");
    expect(clubJoinHref("c1", { unitId: "u1", unitCode: "XYZ" })).toBe("/clubs/c1?unitId=u1&unitCode=XYZ");
  });

  test("parse what the builders write", () => {
    const channel = new URLSearchParams("view=whiteboard&board=b1&message=m1");
    expect(parseClubChannelLink(channel)).toEqual({ whiteboardRequested: true, whiteboardId: "b1", messageId: "m1" });
    expect(parseClubChannelLink(new URLSearchParams())).toEqual({ whiteboardRequested: false, whiteboardId: null, messageId: null });
    expect(parseClubPeopleLink(new URLSearchParams("tab=requests")).requestsTab).toBe(true);
    expect(parseClubJoinLink(new URLSearchParams("unitId=u1&unitCode=XYZ"))).toEqual({ code: null, unitId: "u1", unitCode: "XYZ" });
  });

  test("match club paths, ignoring queries", () => {
    expect(matchClubChannelPath("/clubs/c1/channels/ch1?message=m1")).toEqual({ clubId: "c1", channelId: "ch1" });
    expect(matchClubPeoplePath("/clubs/c1/people?tab=requests")).toEqual({ clubId: "c1" });
    expect(matchClubPath("/clubs/c1?joinCode=A")).toEqual({ clubId: "c1" });
    expect(matchClubPath("/events/e1")).toBeNull();
  });
});
