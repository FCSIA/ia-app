import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  scheduleMateriallyChanged,
  shouldNotifyFriendsOfScheduleChange,
  uniqueFriendIds,
  type MaterialScheduleSnapshot,
} from "./scheduleChangeNotifications";

const courseId = "course" as Id<"courses">;
const publicSchedule: MaterialScheduleSnapshot = {
  isPublic: true,
  entries: [
    {
      weekday: "MONDAY",
      periodNumber: 1,
      courseId,
      className: "Geometry",
    },
  ],
};

describe("friend schedule change notifications", () => {
  test("detects canonical personal assignment changes without order noise", () => {
    expect(scheduleMateriallyChanged(publicSchedule, publicSchedule)).toBe(false);
    expect(
      scheduleMateriallyChanged(
        { ...publicSchedule, entries: [...publicSchedule.entries].reverse() },
        publicSchedule,
      ),
    ).toBe(false);
    expect(
      scheduleMateriallyChanged(publicSchedule, {
        ...publicSchedule,
        entries: [{ ...publicSchedule.entries[0], className: "Algebra" }],
      }),
    ).toBe(true);
  });

  test("never fans out private resulting schedules or a public-to-private change", () => {
    const privateSchedule = { ...publicSchedule, isPublic: false };
    expect(shouldNotifyFriendsOfScheduleChange(publicSchedule, privateSchedule)).toBe(false);
    expect(
      shouldNotifyFriendsOfScheduleChange(privateSchedule, {
        ...privateSchedule,
        entries: [{ ...privateSchedule.entries[0], className: "Private change" }],
      }),
    ).toBe(false);
    expect(shouldNotifyFriendsOfScheduleChange(privateSchedule, publicSchedule)).toBe(true);
  });

  test("deduplicates accepted friend fanout and excludes the actor", () => {
    const actorId = "actor" as Id<"users">;
    const friendId = "friend" as Id<"users">;
    const otherId = "other" as Id<"users">;
    expect(
      uniqueFriendIds(
        actorId,
        [{ addresseeId: friendId }, { addresseeId: actorId }],
        [{ requesterId: friendId }, { requesterId: otherId }],
      ),
    ).toEqual([friendId, otherId]);
  });
});
