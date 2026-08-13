import type { ScheduleWeekday } from "../validators";

export type GroupComparisonEntry<TCourseId extends string = string> = {
  /** Legacy copies may identify the weekday, but comparisons are period-based. */
  weekday?: ScheduleWeekday;
  periodNumber: number;
  courseId: TCourseId | null;
  className: string;
};

export type GroupComparisonParticipant<
  TUserId extends string = string,
  TCourseId extends string = string,
> = {
  userId: TUserId;
  entries: readonly GroupComparisonEntry<TCourseId>[] | null;
};

export type SharedClassCluster<
  TUserId extends string = string,
  TCourseId extends string = string,
> = {
  key: string;
  periodNumber: number;
  className: string;
  courseId: TCourseId | null;
  attendeeUserIds: TUserId[];
  participantCount: number;
  everyoneShared: boolean;
};

export function normalizeManualClassName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * Group identity stays on canonical personal assignments. Dated bell/template
 * resolution and legacy weekday copies must not change this period identity.
 */
export function scheduleComparisonKey<TCourseId extends string>(
  entry: GroupComparisonEntry<TCourseId>,
) {
  const classIdentity = entry.courseId
    ? `course:${entry.courseId}`
    : `manual:${normalizeManualClassName(entry.className)}`;
  return `${entry.periodNumber}:${classIdentity}`;
}

export function clusterSharedClasses<
  TUserId extends string,
  TCourseId extends string,
>(
  participants: readonly GroupComparisonParticipant<TUserId, TCourseId>[],
): SharedClassCluster<TUserId, TCourseId>[] {
  const clusters = new Map<
    string,
    Omit<
      SharedClassCluster<TUserId, TCourseId>,
      "attendeeUserIds" | "participantCount" | "everyoneShared"
    > & {
      attendeeUserIds: Set<TUserId>;
    }
  >();
  const participantIds = new Set(participants.map((participant) => participant.userId));

  for (const participant of participants) {
    for (const entry of participant.entries ?? []) {
      const key = scheduleComparisonKey(entry);
      const existing = clusters.get(key);
      if (existing) {
        existing.attendeeUserIds.add(participant.userId);
        continue;
      }
      clusters.set(key, {
        key,
        periodNumber: entry.periodNumber,
        className: entry.className.trim(),
        courseId: entry.courseId,
        attendeeUserIds: new Set([participant.userId]),
      });
    }
  }

  return Array.from(clusters.values())
    .filter((cluster) => cluster.attendeeUserIds.size >= 2)
    .map((cluster) => {
      const attendeeUserIds = Array.from(cluster.attendeeUserIds);
      return {
        ...cluster,
        attendeeUserIds,
        participantCount: participantIds.size,
        everyoneShared:
          participantIds.size > 1 && attendeeUserIds.length === participantIds.size,
      };
    })
    .sort(
      (left, right) =>
      left.periodNumber - right.periodNumber ||
        left.className.localeCompare(right.className),
    );
}
