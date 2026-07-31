import { describe, expect, test } from "vitest";
import { clusterSharedClasses } from "./groupComparison";

describe("schedule group common-class clustering", () => {
  test("keeps disjoint attendee subsets explicit", () => {
    const clusters = clusterSharedClasses([
      {
        userId: "owner",
        entries: [
          { weekday: "MONDAY", periodNumber: 1, courseId: "math", className: "Math" },
          { weekday: "TUESDAY", periodNumber: 2, courseId: "science", className: "Science" },
          { weekday: "WEDNESDAY", periodNumber: 3, courseId: "english", className: "English" },
        ],
      },
      {
        userId: "friend-a",
        entries: [
          { weekday: "MONDAY", periodNumber: 1, courseId: "math", className: "Math" },
          { weekday: "WEDNESDAY", periodNumber: 3, courseId: "english", className: "English" },
        ],
      },
      {
        userId: "friend-b",
        entries: [
          { weekday: "TUESDAY", periodNumber: 2, courseId: "science", className: "Science" },
          { weekday: "WEDNESDAY", periodNumber: 3, courseId: "english", className: "English" },
        ],
      },
    ]);

    expect(clusters).toHaveLength(3);
    expect(clusters[0]).toMatchObject({
      className: "Math",
      attendeeUserIds: ["owner", "friend-a"],
      everyoneShared: false,
    });
    expect(clusters[1]).toMatchObject({
      className: "Science",
      attendeeUserIds: ["owner", "friend-b"],
      everyoneShared: false,
    });
    expect(clusters[2]).toMatchObject({
      className: "English",
      attendeeUserIds: ["owner", "friend-a", "friend-b"],
      everyoneShared: true,
    });
  });

  test("counts every current member, including a private schedule, for everyone-shared", () => {
    const clusters = clusterSharedClasses([
      {
        userId: "owner",
        entries: [{ weekday: "MONDAY", periodNumber: 1, courseId: "math", className: "Math" }],
      },
      {
        userId: "friend-a",
        entries: [{ weekday: "MONDAY", periodNumber: 1, courseId: "math", className: "Math" }],
      },
      { userId: "private-friend", entries: null },
    ]);

    expect(clusters[0]).toMatchObject({
      attendeeUserIds: ["owner", "friend-a"],
      everyoneShared: false,
    });
  });

  test("normalizes manual class names but never merges different slots", () => {
    const clusters = clusterSharedClasses([
      {
        userId: "owner",
        entries: [
          { weekday: "THURSDAY", periodNumber: 4, courseId: null, className: "  Robotics Lab " },
        ],
      },
      {
        userId: "friend-a",
        entries: [
          { weekday: "THURSDAY", periodNumber: 4, courseId: null, className: "robotics   lab" },
        ],
      },
      {
        userId: "friend-b",
        entries: [
          { weekday: "FRIDAY", periodNumber: 4, courseId: null, className: "Robotics Lab" },
        ],
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].attendeeUserIds).toEqual(["owner", "friend-a"]);
  });
});
