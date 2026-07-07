import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/lib/theme";
import { useOfflineValue } from "@/lib/offline-cache";
import { api } from "~/apps/convex/src/_generated/api";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const periods = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default function ScheduleScreen() {
  const liveData = useQuery(api.schedule.dashboard.get, {});
  const data = useOfflineValue("schedule", liveData);
  const courses = useQuery(api.courses.catalog.list, { limit: 500 }) ?? [];
  const saveSchedule = useMutation(api.schedule.dashboard.save);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);
  const acceptFriendRequest = useMutation(api.schedule.friends.acceptRequest);
  const removeFriend = useMutation(api.schedule.friends.remove);
  const { color } = useTheme();
  const [editing, setEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [draftEntries, setDraftEntries] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<(typeof weekdays)[number]>("MONDAY");
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [courseSearch, setCourseSearch] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const searchResults = useQuery(
    api.schedule.friends.search,
    friendSearch.trim().length >= 2 ? { query: friendSearch, limit: 10 } : "skip",
  );

  const courseMatches = useMemo(() => {
    const search = courseSearch.trim().toLowerCase();
    if (!search) return courses.slice(0, 8);
    return courses.filter((course: any) =>
      [course.title, ...(course.courseNumbers ?? []), course.department].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(search),
      ),
    ).slice(0, 12);
  }, [courses, courseSearch]);

  function startEditing(schedule: any) {
    setIsPublic(schedule.mySchedule?.isPublic ?? true);
    setDraftEntries([...(schedule.mySchedule?.entries ?? [])]);
    setEditing(true);
  }

  function setCourse(course: any) {
    setDraftEntries((current) => {
      const without = current.filter((entry) => !(entry.weekday === selectedDay && entry.periodNumber === selectedPeriod));
      return [
        ...without,
        {
          weekday: selectedDay,
          periodNumber: selectedPeriod,
          courseId: course.id,
          className: course.title,
          course,
        },
      ].sort((left, right) => left.weekday.localeCompare(right.weekday) || left.periodNumber - right.periodNumber);
    });
  }

  function clearCourse() {
    setDraftEntries((current) => current.filter((entry) => !(entry.weekday === selectedDay && entry.periodNumber === selectedPeriod)));
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
    } catch (error) {
      Alert.alert("Schedule not saved", error instanceof Error ? error.message : "Try again.");
    }
  }

  function renderSchedule(schedule: any, entries: any[]) {
    return weekdays.map((day) => {
      const dayEntries = entries.filter((entry: any) => entry.weekday === day);
      return (
        <Card key={day} style={{ gap: 10 }}>
          <Badge label={day} color="blue" />
          {dayEntries.length === 0 ? (
            <Text style={{ color: color("mutedForeground") }}>No classes saved.</Text>
          ) : (
            dayEntries.map((entry: any) => (
              <View key={entry.id ?? `${day}-${entry.periodNumber}`} style={{ gap: 2 }}>
                <Text style={{ color: color("foreground"), fontWeight: "900" }}>Period {entry.periodNumber}</Text>
                <Text style={{ color: color("mutedForeground") }}>{entry.className}</Text>
              </View>
            ))
          )}
        </Card>
      );
    });
  }

  return (
    <Screen title="Schedule" subtitle="Your classes, visibility, and shared friend schedule access.">
      {data.isOffline || data.isStale ? <OfflineBanner stale={data.isStale} /> : null}
      <DataBoundary data={data.value} emptyTitle="Schedule unavailable">
        {(schedule) => (
          <View style={{ gap: 14 }}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={schedule.mySchedule?.isPublic ? "Public to friends" : "Private"} color={schedule.mySchedule?.isPublic ? "emerald" : "gray"} />
                <Badge label={`${schedule.friends.length} friend${schedule.friends.length === 1 ? "" : "s"}`} color="blue" />
              </View>
              <Button title={editing ? "Done editing" : "Edit my schedule"} variant="secondary" onPress={() => editing ? setEditing(false) : startEditing(schedule)} />
            </Card>

            {editing ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Edit Schedule</Text>
                <Button title={isPublic ? "Visibility: public to friends" : "Visibility: private"} variant={isPublic ? "primary" : "secondary"} onPress={() => setIsPublic((value) => !value)} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {weekdays.map((day) => (
                    <Button key={day} title={day.slice(0, 3)} size="sm" variant={selectedDay === day ? "primary" : "secondary"} onPress={() => setSelectedDay(day)} />
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {periods.map((period) => (
                    <Button key={period} title={`P${period}`} size="sm" variant={selectedPeriod === period ? "primary" : "secondary"} onPress={() => setSelectedPeriod(period)} />
                  ))}
                </View>
                <TextField value={courseSearch} onChangeText={setCourseSearch} placeholder="Search courses to assign" />
                <Button title="Clear selected period" variant="tertiary" onPress={clearCourse} />
                {courseMatches.map((course: any) => (
                  <Button key={course.id} title={course.title} variant="secondary" onPress={() => setCourse(course)} />
                ))}
                <Button title="Save schedule" onPress={saveDraft} />
              </Card>
            ) : null}

            {renderSchedule(schedule, editing ? draftEntries : schedule.mySchedule?.entries ?? [])}

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Friends</Text>
              <TextField value={friendSearch} onChangeText={setFriendSearch} placeholder="Search students by name or ID" />
              {(searchResults ?? []).map((student: any) => (
                <View key={student._id} style={{ gap: 6 }}>
                  <Text style={{ color: color("foreground"), fontWeight: "900" }}>
                    {student.firstName} {student.lastName} ({student.uniqueId})
                  </Text>
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                    {student.friendshipStatus.replaceAll("_", " ")} - {student.visibility.toLowerCase()} schedule
                  </Text>
                  <Button
                    title={student.friendshipStatus === "REQUEST_RECEIVED" ? "Accept request" : student.friendshipStatus === "NONE" ? "Send request" : "Already connected"}
                    size="sm"
                    disabled={student.friendshipStatus === "FRIENDS" || student.friendshipStatus === "REQUEST_SENT"}
                    onPress={() =>
                      (student.friendshipStatus === "REQUEST_RECEIVED"
                        ? acceptFriendRequest({ requesterId: student._id })
                        : sendFriendRequest({ friendId: student._id })
                      ).catch((error) => Alert.alert("Friend request", error instanceof Error ? error.message : "Try again."))
                    }
                  />
                </View>
              ))}
              {schedule.incomingRequests.map((request: any) => (
                <View key={request.id} style={{ gap: 6 }}>
                  <Text style={{ color: color("foreground"), fontWeight: "900" }}>
                    {request.user.firstName} {request.user.lastName} wants schedule access
                  </Text>
                  <Button title="Accept" size="sm" onPress={() => acceptFriendRequest({ requesterId: request.user._id })} />
                </View>
              ))}
              {schedule.outgoingRequests.map((request: any) => (
                <Text key={request.id} style={{ color: color("mutedForeground") }}>
                  Pending: {request.user.firstName} {request.user.lastName}
                </Text>
              ))}
            </Card>

            {schedule.friends.map((friend: any) => (
              <Card key={friend.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Badge label={friend.visibility} color={friend.visibility === "PUBLIC" ? "emerald" : "gray"} />
                </View>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>
                  {friend.user.firstName} {friend.user.lastName}
                </Text>
                {friend.schedule?.entries?.slice(0, 8).map((entry: any) => (
                  <Text key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`} style={{ color: color("mutedForeground") }}>
                    {entry.weekday.slice(0, 3)} P{entry.periodNumber}: {entry.className}
                  </Text>
                ))}
                {!friend.schedule ? <Text style={{ color: color("mutedForeground") }}>Schedule is private.</Text> : null}
                <Button
                  title="Remove friend"
                  size="sm"
                  variant="tertiary"
                  onPress={() => removeFriend({ otherUserId: friend.user._id }).catch((error) => Alert.alert("Friend", error instanceof Error ? error.message : "Try again."))}
                />
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
