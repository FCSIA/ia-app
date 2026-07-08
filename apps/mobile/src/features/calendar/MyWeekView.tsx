import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipGroup,
  ListRow,
  Section,
  SegmentedControl,
  Switch,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { useOfflineValue } from "@/lib/offline-cache";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const periods = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export function MyWeekView() {
  const liveData = useQuery(api.schedule.dashboard.get, {});
  const data = useOfflineValue("schedule", liveData);
  const courses = useQuery(api.courses.catalog.list, { limit: 500 }) ?? [];
  const saveSchedule = useMutation(api.schedule.dashboard.save);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);
  const acceptFriendRequest = useMutation(api.schedule.friends.acceptRequest);
  const removeFriend = useMutation(api.schedule.friends.remove);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [draftEntries, setDraftEntries] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<(typeof weekdays)[number]>("MONDAY");
  const [selectedPeriod, setSelectedPeriod] = useState("1");
  const [courseSearch, setCourseSearch] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const searchResults = useQuery(
    api.schedule.friends.search,
    friendSearch.trim().length >= 2 ? { query: friendSearch, limit: 10 } : "skip",
  );

  const courseMatches = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    const list = !search
      ? courses.slice(0, 8)
      : courses.filter((course: any) =>
          [course.title, ...(course.courseNumbers ?? []), course.department].filter(Boolean).some((value) =>
            String(value).toLowerCase().includes(search),
          ),
        ).slice(0, 12);
    return list;
  }, [courses, courseSearch]);

  function startEditing(schedule: any) {
    setIsPublic(schedule.mySchedule?.isPublic ?? true);
    setDraftEntries([...(schedule.mySchedule?.entries ?? [])]);
    setEditing(true);
  }

  function setCourse(course: any) {
    setDraftEntries((current) => {
      const periodNumber = Number(selectedPeriod);
      const without = current.filter((entry) => !(entry.weekday === selectedDay && entry.periodNumber === periodNumber));
      return [
        ...without,
        {
          weekday: selectedDay,
          periodNumber,
          courseId: course.id,
          className: course.title,
          course,
        },
      ].sort((left, right) => left.weekday.localeCompare(right.weekday) || left.periodNumber - right.periodNumber);
    });
  }

  function clearCourse() {
    const periodNumber = Number(selectedPeriod);
    setDraftEntries((current) => current.filter((entry) => !(entry.weekday === selectedDay && entry.periodNumber === periodNumber)));
  }

  async function saveDraft() {
    try {
      await saveSchedule({
        isPublic,
        entries: draftEntries.filter((entry) => entry.courseId).map((entry) => ({
          weekday: entry.weekday,
          periodNumber: entry.periodNumber,
          courseId: entry.courseId,
        })),
      });
      setEditing(false);
      showToast({ title: "Schedule saved", tone: "success" });
    } catch (error) {
      showToast({ title: "Schedule not saved", body: error instanceof Error ? error.message : "Try again." });
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      {data.isOffline || data.isStale ? <OfflineBanner stale={data.isStale} /> : null}
      <DataBoundary data={data.value} emptyTitle="Schedule unavailable">
        {(schedule) => (
          <View style={{ gap: spacing.md }}>
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Badge label={schedule.mySchedule?.isPublic ? "Public to friends" : "Private"} color={schedule.mySchedule?.isPublic ? "emerald" : "gray"} />
                <Badge label={`${schedule.friends.length} friend${schedule.friends.length === 1 ? "" : "s"}`} color="blue" />
              </View>
              <Button title={editing ? "Done editing" : "Edit my schedule"} variant="secondary" onPress={() => editing ? setEditing(false) : startEditing(schedule)} />
            </Card>

            {editing ? (
              <Card style={{ gap: spacing.md }}>
                <Section title="Edit Schedule">
                  <ListRow
                    title="Visible to friends"
                    subtitle={isPublic ? "Friends can see your class schedule." : "Only you can see your schedule."}
                    trailing={<Switch value={isPublic} onValueChange={setIsPublic} />}
                  />
                  <SegmentedControl
                    value={selectedDay}
                    onChange={setSelectedDay}
                    segments={weekdays.map((day) => ({ value: day, label: day.slice(0, 3) }))}
                  />
                  <ChipGroup values={periods} selected={[selectedPeriod]} labels={periods.reduce((acc, period) => ({ ...acc, [period]: `P${period}` }), {})} onToggle={setSelectedPeriod} />
                  <TextField value={courseSearch} onChangeText={setCourseSearch} placeholder="Search courses to assign" />
                  <Button title="Clear selected period" variant="tertiary" onPress={clearCourse} />
                  {courseMatches.map((course: any) => (
                    <ListRow key={course.id} title={course.title} subtitle={course.department} onPress={() => setCourse(course)} />
                  ))}
                  <Button title="Save schedule" onPress={saveDraft} />
                </Section>
              </Card>
            ) : null}

            <Section title="Week">
              {renderSchedule(editing ? draftEntries : schedule.mySchedule?.entries ?? [])}
            </Section>

            <Section title="Friends">
              <TextField value={friendSearch} onChangeText={setFriendSearch} placeholder="Search students by name or ID" />
              {(searchResults ?? []).map((student: any) => (
                <ListRow
                  key={student._id}
                  leading={<Avatar name={`${student.firstName} ${student.lastName}`} size={36} />}
                  title={`${student.firstName} ${student.lastName}`}
                  subtitle={`${student.friendshipStatus.replaceAll("_", " ")} - ${student.visibility.toLowerCase()} schedule`}
                  trailing={
                    <Button
                      title={student.friendshipStatus === "REQUEST_RECEIVED" ? "Accept" : student.friendshipStatus === "NONE" ? "Add" : "Connected"}
                      size="sm"
                      disabled={student.friendshipStatus === "FRIENDS" || student.friendshipStatus === "REQUEST_SENT"}
                      onPress={() =>
                        (student.friendshipStatus === "REQUEST_RECEIVED"
                          ? acceptFriendRequest({ requesterId: student._id })
                          : sendFriendRequest({ friendId: student._id })
                        ).catch((error) => showToast({ title: "Friend request", body: error instanceof Error ? error.message : "Try again." }))
                      }
                    />
                  }
                />
              ))}
              {schedule.incomingRequests.map((request: any) => (
                <ListRow
                  key={request.id}
                  leading={<Avatar name={`${request.user.firstName} ${request.user.lastName}`} size={36} />}
                  title={`${request.user.firstName} ${request.user.lastName}`}
                  subtitle="Wants schedule access"
                  trailing={<Button title="Accept" size="sm" onPress={() => acceptFriendRequest({ requesterId: request.user._id })} />}
                />
              ))}
              {schedule.outgoingRequests.map((request: any) => (
                <Txt key={request.id} tone="muted">
                  Pending: {request.user.firstName} {request.user.lastName}
                </Txt>
              ))}
            </Section>

            {schedule.friends.map((friend: any) => (
              <Card key={friend.id} style={{ gap: spacing.sm }}>
                <Badge label={friend.visibility} color={friend.visibility === "PUBLIC" ? "emerald" : "gray"} />
                <Txt variant="section">{friend.user.firstName} {friend.user.lastName}</Txt>
                {friend.schedule?.entries?.slice(0, 8).map((entry: any) => (
                  <Txt key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`} tone="muted">
                    {entry.weekday.slice(0, 3)} P{entry.periodNumber}: {entry.className}
                  </Txt>
                ))}
                {!friend.schedule ? <Txt tone="muted">Schedule is private.</Txt> : null}
                <Button
                  title="Remove friend"
                  size="sm"
                  variant="tertiary"
                  onPress={() =>
                    Alert.alert("Remove friend?", "They will lose access to your schedule.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => removeFriend({ otherUserId: friend.user._id }).catch((error) => showToast({ title: "Friend", body: error instanceof Error ? error.message : "Try again." })),
                      },
                    ])
                  }
                />
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </View>
  );
}

function renderSchedule(entries: any[]) {
  return weekdays.map((day) => {
    const dayEntries = entries.filter((entry: any) => entry.weekday === day);
    return (
      <Card key={day} variant="flat" style={{ gap: spacing.sm }}>
        <Badge label={day} color="blue" />
        {dayEntries.length === 0 ? (
          <Txt tone="muted">No classes saved.</Txt>
        ) : (
          dayEntries.map((entry: any) => (
            <View key={entry.id ?? `${day}-${entry.periodNumber}`} style={{ gap: 2 }}>
              <Txt variant="label">Period {entry.periodNumber}</Txt>
              <Txt tone="muted">{entry.className}</Txt>
            </View>
          ))
        )}
      </Card>
    );
  });
}
