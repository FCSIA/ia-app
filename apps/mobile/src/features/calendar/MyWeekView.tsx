import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronDown, ChevronRight, UserMinus } from "lucide-react-native";
import { useMutation, useQuery } from "@/lib/convex-react";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import {
  Avatar,
  Button,
  IconButton,
  ListRow,
  PressableScale,
  Section,
  SegmentedControl,
  Switch,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { PeriodBadge } from "@/features/schedule/period-badge";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const fallbackPeriods = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const lunchPeriodOptions = [
  { value: "PERIOD_4", label: "Period 4" },
  { value: "PERIOD_5", label: "Period 5" },
] as const;
type Weekday = (typeof weekdays)[number];
type LunchPeriod = "PERIOD_4" | "PERIOD_5";

export function MyWeekView() {
  const liveData = useQuery(api.schedule.dashboard.get, {});
  const data = useOfflineValue("schedule", liveData);
  const courses = useQuery(api.courses.catalog.list, { limit: 500 }) ?? [];
  const saveSchedule = useMutation(api.schedule.dashboard.save);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);
  const acceptFriendRequest = useMutation(api.schedule.friends.acceptRequest);
  const removeFriend = useMutation(api.schedule.friends.remove);
  const { showToast } = useToast();
  const { color } = useTheme();
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [lunchPeriod, setLunchPeriod] = useState<LunchPeriod | null>(null);
  const [draftEntries, setDraftEntries] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Weekday>(initialWeekday);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [courseSearch, setCourseSearch] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [expandedFriendIds, setExpandedFriendIds] = useState<Set<string>>(
    () => new Set(),
  );
  const searchResults = useQuery(
    api.schedule.friends.search,
    friendSearch.trim().length >= 2 ? { query: friendSearch, limit: 10 } : "skip",
  );

  const courseMatches = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    if (!search) return [];
    return courses
      .filter((course: any) =>
        [course.title, ...(course.courseNumbers ?? []), course.department]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      )
      .slice(0, 10);
  }, [courses, courseSearch]);

  function startEditing(schedule: any) {
    const nextLunchPeriod = schedule.mySchedule?.lunchPeriod ?? null;
    setIsPublic(schedule.mySchedule?.isPublic ?? true);
    setLunchPeriod(nextLunchPeriod);
    setDraftEntries([...(schedule.mySchedule?.entries ?? [])]);
    if (nextLunchPeriod && selectedPeriod === lunchPeriodNumber(nextLunchPeriod)) {
      setSelectedPeriod(nextLunchPeriod === "PERIOD_4" ? 5 : 4);
    }
    setEditing(true);
  }

  function selectLunchPeriod(nextLunchPeriod: LunchPeriod) {
    const periodNumber = lunchPeriodNumber(nextLunchPeriod);
    const conflict = draftEntries.find(
      (entry) => entry.periodNumber === periodNumber,
    );
    if (conflict) {
      showToast({
        title: `Period ${periodNumber} has a class`,
        body: `Clear or move the ${formatWeekday(conflict.weekday)} class before making it lunch.`,
      });
      return;
    }

    setLunchPeriod(nextLunchPeriod);
    if (selectedPeriod === periodNumber) {
      setSelectedPeriod(nextLunchPeriod === "PERIOD_4" ? 5 : 4);
      setCourseSearch("");
    }
  }

  function setCourse(course: any) {
    setDraftEntries((current) => {
      const without = current.filter(
        (entry) => !(entry.weekday === selectedDay && entry.periodNumber === selectedPeriod),
      );
      return [
        ...without,
        {
          weekday: selectedDay,
          periodNumber: selectedPeriod,
          courseId: course.id,
          className: course.title,
          course,
        },
      ].sort(
        (left, right) =>
          weekdays.indexOf(left.weekday) - weekdays.indexOf(right.weekday) ||
          left.periodNumber - right.periodNumber,
      );
    });
    setCourseSearch("");
  }

  function clearCourse() {
    setDraftEntries((current) =>
      current.filter(
        (entry) => !(entry.weekday === selectedDay && entry.periodNumber === selectedPeriod),
      ),
    );
  }

  async function saveDraft() {
    if (!lunchPeriod) {
      showToast({
        title: "Choose a lunch period",
        body: "Lunch must be either Period 4 or Period 5.",
      });
      return;
    }

    try {
      await saveSchedule({
        isPublic,
        lunchPeriod,
        entries: draftEntries.reduce<any[]>((result, entry) => {
          if (!(entry.className ?? entry.course?.title)?.trim()) return result;
          result.push({
            weekday: entry.weekday,
            periodNumber: entry.periodNumber,
            courseId: entry.courseId ?? null,
            className: entry.className ?? entry.course?.title ?? "Class",
          });
          return result;
        }, []),
      });
      setEditing(false);
      showToast({ title: "Schedule saved", tone: "success" });
    } catch (error) {
      showToast({
        title: "Schedule not saved",
        body: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  return (
    <View style={{ gap: spacing.xl }}>
      {data.isOffline || data.isStale ? <OfflineBanner stale={data.isStale} /> : null}
      <DataBoundary data={data.value} emptyTitle="Schedule unavailable">
        {(schedule) => {
          const visibleEntries = editing
            ? draftEntries
            : (schedule.mySchedule?.entries ?? []);
          const selectedEntry = visibleEntries.find(
            (entry: any) =>
              entry.weekday === selectedDay && entry.periodNumber === selectedPeriod,
          );

          return (
            <View style={{ gap: spacing.xl }}>
              <Section
                title="My schedule"
                action={
                  <Button
                    title={editing ? "Cancel" : "Edit"}
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      editing ? setEditing(false) : startEditing(schedule)
                    }
                  />
                }
              >
                <SegmentedControl
                  value={selectedDay}
                  onChange={(day) => {
                    setSelectedDay(day);
                    setCourseSearch("");
                  }}
                  segments={weekdays.map((day) => ({
                    value: day,
                    label: `${day[0]}${day.slice(1, 3).toLowerCase()}`,
                  }))}
                />

                <ScheduleTable
                  day={selectedDay}
                  entries={visibleEntries}
                  blocks={schedule.blocks}
                  lunchPeriod={editing ? lunchPeriod : schedule.mySchedule?.lunchPeriod}
                  selectedPeriod={editing ? selectedPeriod : undefined}
                  onSelectPeriod={editing ? setSelectedPeriod : undefined}
                />
              </Section>

              {editing ? (
                <View
                  style={{
                    gap: spacing.md,
                    borderRadius: radii.xl,
                    backgroundColor: color("secondary"),
                    padding: spacing.lg,
                  }}
                >
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ gap: spacing.xs }}>
                      <Txt variant="label">Lunch period</Txt>
                      <Txt variant="caption" tone="muted">
                        Choose one lunch for every regular school day. Classes in the other slot stay unchanged.
                      </Txt>
                    </View>
                    <LunchPeriodPicker
                      value={lunchPeriod}
                      onChange={selectLunchPeriod}
                    />
                  </View>

                  <View
                    style={{
                      minHeight: spacing.xl * 2,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Txt variant="label">Share with friends</Txt>
                      <Txt variant="caption" tone="muted">
                        {isPublic ? "Friends can compare schedules." : "Only you can see this."}
                      </Txt>
                    </View>
                    <Switch label="Share schedule with friends" value={isPublic} onValueChange={setIsPublic} />
                  </View>

                  <View style={{ gap: spacing.sm }}>
                    <Txt variant="overline" tone="muted">
                      Period {selectedPeriod}
                    </Txt>
                    <TextField
                      value={courseSearch}
                      onChangeText={setCourseSearch}
                      placeholder={selectedEntry?.className ?? "Search courses"}
                    />
                    {courseMatches.map((course: any) => (
                      <ListRow
                        key={course.id}
                        title={course.title}
                        subtitle={course.department}
                        onPress={() => setCourse(course)}
                      />
                    ))}
                    {courseSearch.trim() && courseMatches.length === 0 ? (
                      <Txt variant="caption" tone="muted">
                        No matching courses.
                      </Txt>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      title="Clear"
                      variant="tertiary"
                      disabled={!selectedEntry}
                      onPress={clearCourse}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Save"
                      onPress={saveDraft}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : null}

              <Section
                title="Friends"
                action={
                  schedule.friends.length ? (
                    <Txt variant="caption" tone="muted">
                      {schedule.friends.length}
                    </Txt>
                  ) : null
                }
              >
                <TextField
                  value={friendSearch}
                  onChangeText={setFriendSearch}
                  placeholder="Find a student"
                />

                {(searchResults ?? []).map((student: any) => {
                  const canRespond =
                    student.friendshipStatus === "REQUEST_RECEIVED" ||
                    student.friendshipStatus === "NONE";
                  return (
                    <ListRow
                      key={student._id}
                      leading={
                        <Avatar
                          name={`${student.firstName} ${student.lastName}`}
                          size={36}
                        />
                      }
                      title={`${student.firstName} ${student.lastName}`}
                      trailing={
                        canRespond ? (
                          <Button
                            title={
                              student.friendshipStatus === "REQUEST_RECEIVED"
                                ? "Accept"
                                : "Add"
                            }
                            size="sm"
                            onPress={() =>
                              (student.friendshipStatus === "REQUEST_RECEIVED"
                                ? acceptFriendRequest({ requesterId: student._id })
                                : sendFriendRequest({ friendId: student._id })
                              ).catch((error) =>
                                showToast({
                                  title: "Friend request",
                                  body:
                                    error instanceof Error ? error.message : "Try again.",
                                }),
                              )
                            }
                          />
                        ) : (
                          <Txt variant="caption" tone="muted">
                            {student.friendshipStatus === "FRIENDS" ? "Added" : "Pending"}
                          </Txt>
                        )
                      }
                    />
                  );
                })}

                {schedule.incomingRequests.map((request: any) => (
                  <ListRow
                    key={request.id}
                    leading={
                      <Avatar
                        name={`${request.user.firstName} ${request.user.lastName}`}
                        size={36}
                      />
                    }
                    title={`${request.user.firstName} ${request.user.lastName}`}
                    subtitle="Wants to compare schedules"
                    trailing={
                      <Button
                        title="Accept"
                        size="sm"
                        onPress={() =>
                          acceptFriendRequest({ requesterId: request.user._id }).catch(
                            (error) =>
                              showToast({
                                title: "Friend request",
                                body: error instanceof Error ? error.message : "Try again.",
                              }),
                          )
                        }
                      />
                    }
                  />
                ))}

                {schedule.outgoingRequests.map((request: any) => (
                  <ListRow
                    key={request.id}
                    leading={
                      <Avatar
                        name={`${request.user.firstName} ${request.user.lastName}`}
                        size={36}
                      />
                    }
                    title={`${request.user.firstName} ${request.user.lastName}`}
                    subtitle="Request pending"
                    trailing={
                      <Txt variant="caption" tone="muted">
                        Pending
                      </Txt>
                    }
                  />
                ))}

                {!friendSearch.trim() &&
                schedule.friends.length === 0 &&
                schedule.incomingRequests.length === 0 &&
                schedule.outgoingRequests.length === 0 ? (
                  <Txt tone="muted">Search for a classmate to compare schedules.</Txt>
                ) : null}

                {schedule.friends.map((friend: any) => {
                  const friendId = String(friend.id);
                  const isExpanded = expandedFriendIds.has(friendId);

                  return (
                    <View
                      key={friend.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: radii.xl,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: color("border"),
                      backgroundColor: color("card"),
                    }}
                  >
                    <View
                      style={{
                        minHeight: spacing.xl * 2 + spacing.sm,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                      }}
                    >
                      <Avatar
                        name={`${friend.user.firstName} ${friend.user.lastName}`}
                        size={36}
                      />
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Txt variant="label" numberOfLines={1}>
                          {friend.user.firstName} {friend.user.lastName}
                        </Txt>
                        <Txt variant="caption" tone="muted">
                          {friend.visibility === "PUBLIC"
                            ? "Shared schedule"
                            : friend.visibility === "PRIVATE"
                              ? "Private schedule"
                              : "No schedule yet"}
                        </Txt>
                      </View>
                      {friend.schedule ? (
                        <IconButton
                          icon={isExpanded ? ChevronDown : ChevronRight}
                          label={`${isExpanded ? "Collapse" : "Expand"} ${friend.user.firstName}'s schedule`}
                          size="sm"
                          variant="ghost"
                          onPress={() =>
                            setExpandedFriendIds((current) => {
                              const next = new Set(current);
                              if (next.has(friendId)) next.delete(friendId);
                              else next.add(friendId);
                              return next;
                            })
                          }
                        />
                      ) : null}
                      <IconButton
                        icon={UserMinus}
                        label={`Remove ${friend.user.firstName}`}
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          Alert.alert(
                            `Remove ${friend.user.firstName}?`,
                            "You will no longer be able to compare schedules.",
                            [
                              { text: "Keep", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () =>
                                  removeFriend({ otherUserId: friend.user._id }).catch(
                                    (error) =>
                                      showToast({
                                        title: "Friend not removed",
                                        body:
                                          error instanceof Error
                                            ? error.message
                                            : "Try again.",
                                      }),
                                  ),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                    {friend.schedule && isExpanded ? (
                      <ScheduleTable
                        day={selectedDay}
                        entries={friend.schedule.entries}
                        blocks={schedule.blocks}
                        lunchPeriod={friend.schedule.lunchPeriod}
                        embedded
                      />
                    ) : null}
                    </View>
                  );
                })}
              </Section>
            </View>
          );
        }}
      </DataBoundary>
    </View>
  );
}

function ScheduleTable({
  day,
  entries,
  blocks,
  lunchPeriod,
  selectedPeriod,
  onSelectPeriod,
  embedded = false,
}: {
  day: Weekday;
  entries: any[];
  blocks: any[];
  lunchPeriod?: LunchPeriod | null;
  selectedPeriod?: number;
  onSelectPeriod?: (period: number) => void;
  embedded?: boolean;
}) {
  const { color } = useTheme();
  const lunchNumber = lunchPeriod ? lunchPeriodNumber(lunchPeriod) : null;
  const dayEntries = entries.filter((entry) => entry.weekday === day);
  const dayBlocks = blocks
    .filter(
      (block) =>
        block.weekday === day &&
        (block.periodNumber !== null || block.label.trim().toLowerCase() !== "lunch"),
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const blockPeriods = new Set<number>();
  for (const block of dayBlocks) {
    if (typeof block.periodNumber === "number") blockPeriods.add(block.periodNumber);
  }
  const displayedPeriods = dayBlocks.length
    ? blockPeriods
    : new Set<number>(fallbackPeriods);
  const rows = [
    ...(dayBlocks.length
      ? dayBlocks.map((block) => ({
          key: block.id,
          periodNumber: block.periodNumber as number | null,
          label: block.label as string,
          startTime: block.startTime as string,
          endTime: block.endTime as string,
        }))
      : fallbackPeriods.map((period) => ({
          key: `${day}-${period}`,
          periodNumber: period as number | null,
          label: `Period ${period}`,
          startTime: "",
          endTime: "",
        }))),
    ...dayEntries
      .filter((entry) => !displayedPeriods.has(entry.periodNumber))
      .map((entry) => ({
        key: entry.id ?? `${day}-${entry.periodNumber}`,
        periodNumber: entry.periodNumber as number,
        label: `Period ${entry.periodNumber}`,
        startTime: "",
        endTime: "",
      })),
  ];

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: embedded ? 0 : radii.xl,
        borderWidth: embedded ? 0 : StyleSheet.hairlineWidth,
        borderColor: color("border"),
        backgroundColor: color("card"),
      }}
    >
      <View
        style={{
          minHeight: spacing.xl + spacing.md,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderTopWidth: embedded ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: color("border"),
          backgroundColor: color("muted"),
        }}
      >
        <Txt
          variant="overline"
          tone="muted"
          style={{ width: spacing["2xl"], textAlign: "center" }}
        >
          P
        </Txt>
        <Txt variant="overline" tone="muted" style={{ flex: 1 }}>
          Class
        </Txt>
        <Txt
          variant="overline"
          tone="muted"
          style={{ width: spacing.xl * 3, textAlign: "right" }}
        >
          Time
        </Txt>
        <View style={{ width: 18 }} />
      </View>

      {rows.map((row, index) => {
        const isLunch = row.periodNumber === lunchNumber;
        const entry =
          typeof row.periodNumber === "number" && !isLunch
            ? dayEntries.find((item) => item.periodNumber === row.periodNumber)
            : null;
        const selectable =
          !!onSelectPeriod && typeof row.periodNumber === "number" && !isLunch;
        const selected = row.periodNumber === selectedPeriod;
        const courseSlug = !selectable ? entry?.course?.slug : undefined;
        const content = (
          <View
            style={{
              minHeight: spacing.xl * 2,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              borderBottomWidth:
                index === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderColor: color("border"),
              backgroundColor: selected
                ? color("accent")
                : isLunch
                  ? color("secondary")
                  : "transparent",
            }}
          >
            <View
              style={{
                width: spacing["2xl"],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {typeof row.periodNumber === "number" ? (
                <PeriodBadge periodNumber={row.periodNumber} emphasized={selected} />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
              <Txt
                variant="label"
                tone={entry || row.periodNumber === null || isLunch ? "default" : "muted"}
                numberOfLines={2}
              >
                {isLunch
                  ? "Lunch"
                  : entry?.className ?? (row.periodNumber === null ? row.label : "—")}
              </Txt>
              {isLunch ? (
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  Period {row.periodNumber}
                </Txt>
              ) : entry?.course?.department ? (
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {entry.course.department}
                </Txt>
              ) : null}
            </View>
            <Txt
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={{
                width: spacing.xl * 3,
                textAlign: "right",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatSchoolTime(row.startTime, row.endTime)}
            </Txt>
            <View style={{ width: 18, alignItems: "flex-end" }}>
              {courseSlug ? (
                <ChevronRight size={18} color={color("mutedForeground")} />
              ) : null}
            </View>
          </View>
        );

        return selectable ? (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={`Period ${row.periodNumber}${entry ? `, ${entry.className}` : ", unassigned"}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectPeriod(row.periodNumber as number)}
          >
            {content}
          </Pressable>
        ) : courseSlug ? (
          <PressableScale
            key={row.key}
            accessibilityRole="link"
            accessibilityLabel={`Period ${row.periodNumber}, ${entry.className}. Open course details`}
            onPress={() => router.push(`/courses/${courseSlug}` as never)}
          >
            {content}
          </PressableScale>
        ) : (
          <View key={row.key}>{content}</View>
        );
      })}
    </View>
  );
}

function LunchPeriodPicker({
  value,
  onChange,
}: {
  value: LunchPeriod | null;
  onChange: (value: LunchPeriod) => void;
}) {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Lunch period"
      style={{ flexDirection: "row", gap: spacing.sm }}
    >
      {lunchPeriodOptions.map((option) => {
        const selected = value === option.value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${option.label} lunch`}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: selected ? color("primary") : color("border"),
              backgroundColor: selected ? color("accent") : color("card"),
              paddingHorizontal: spacing.md,
            }}
          >
            <Txt
              variant="label"
              style={{ color: selected ? color("primary") : color("foreground") }}
            >
              {option.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

function lunchPeriodNumber(lunchPeriod: LunchPeriod) {
  return lunchPeriod === "PERIOD_4" ? 4 : 5;
}

function formatWeekday(weekday: string) {
  const label = weekday.toLowerCase();
  return `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`;
}

function initialWeekday(): Weekday {
  const day = new Date().getDay();
  return weekdays[day - 1] ?? "MONDAY";
}

function formatSchoolTime(startTime: string, endTime: string) {
  if (!startTime || !endTime) return "—";
  return `${formatClock(startTime)}–${formatClock(endTime)}`;
}

function formatClock(value: string) {
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${minutes}`;
}
