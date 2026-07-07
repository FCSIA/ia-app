import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortDate, timeRange } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

const DEFAULT_WIDGETS = ["schedule", "calendar", "announcements", "quickActions", "flex", "clubs", "events", "funFact"] as const;
const WIDGET_LABELS: Record<string, string> = {
  schedule: "Today",
  quickActions: "Quick Actions",
  announcements: "Unread Announcements",
  clubs: "My Clubs",
  events: "Coming Up",
  calendar: "Calendar",
  flex: "Flex Friday",
  funFact: "Fun Fact",
};
const EMPTY_ARGS = {};
const UNREAD_ANNOUNCEMENTS_ARGS = { unreadOnly: true };

export default function DashboardScreen() {
  const user = useCurrentUser();
  const calendarWindow = useMemo(() => {
    const startDate = Date.now();
    return { startDate, endDate: startDate + 30 * 24 * 60 * 60 * 1000 };
  }, []);
  const announcements = useQuery(api.announcements.feed.list, UNREAD_ANNOUNCEMENTS_ARGS);
  const liveSchedule = useQuery(api.schedule.dashboard.get, EMPTY_ARGS);
  const events = useQuery(api.events.events.list, EMPTY_ARGS);
  const calendarEntries = useQuery(api.events.calendar.list, calendarWindow);
  const myClubs = useQuery(api.clubs.management.getMyClubs, EMPTY_ARGS);
  const flexCredits = useQuery(api.flexFriday.credits.getMyCredits, EMPTY_ARGS);
  const registrations = useQuery(api.flexFriday.registration.getMyRegistrations, EMPTY_ARGS);
  const updateLayout = useMutation(api.users.me.updateDashboardLayout);
  const schedule = useOfflineValue("dashboard-schedule", liveSchedule);
  const { color } = useTheme();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<string[]>([...DEFAULT_WIDGETS]);

  useEffect(() => {
    const saved = user?.dashboardLayout?.filter((id) => id in WIDGET_LABELS);
    if (saved?.length) {
      setLayout((current) => (arraysEqual(current, saved) ? current : saved));
    }
  }, [user?.dashboardLayout]);

  const hiddenWidgets = useMemo(
    () => DEFAULT_WIDGETS.filter((id) => !layout.includes(id)),
    [layout],
  );

  function moveWidget(id: string, direction: -1 | 1) {
    setLayout((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function renderWidget(id: string) {
    if (id === "schedule") {
      return (
        <Card key={id} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Today</Text>
            <Badge label={user?.roles?.[0] ?? "Student"} color="orange" />
          </View>
          <DataBoundary data={schedule.value} emptyTitle="No schedule yet">
            {(data) => (
              <View style={{ gap: 8 }}>
                {(data.mySchedule?.entries ?? []).slice(0, 4).map((entry: any) => (
                  <View key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`} style={{ gap: 2 }}>
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>
                      Period {entry.periodNumber}: {entry.className}
                    </Text>
                    <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{entry.weekday}</Text>
                  </View>
                ))}
              </View>
            )}
          </DataBoundary>
        </Card>
      );
    }

    if (id === "announcements") {
      return (
        <View key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Unread Announcements</Text>
          <DataBoundary data={announcements} emptyTitle="All caught up">
            {(items) => <>{items.slice(0, 3).map((item: any) => <AnnouncementCard key={item._id} announcement={item} />)}</>}
          </DataBoundary>
        </View>
      );
    }

    if (id === "quickActions") {
      return (
        <Card key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Quick Actions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button title="Courses" size="sm" variant="secondary" onPress={() => router.push("/courses" as never)} />
            <Button title="Events" size="sm" variant="secondary" onPress={() => router.push("/events" as never)} />
            <Button title="Flex Friday" size="sm" variant="secondary" onPress={() => router.push("/flex-friday" as never)} />
            <Button title="Flex Pass" size="sm" variant="secondary" onPress={() => router.push("/flex-friday/pass" as never)} />
            <Button title="Wrapped" size="sm" variant="secondary" onPress={() => router.push("/wrapped" as never)} />
          </View>
        </Card>
      );
    }

    if (id === "clubs") {
      const memberships = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])].slice(0, 4);
      return (
        <Card key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>My Clubs</Text>
          {memberships.length ? memberships.map((club: any) => (
            <View key={club._id} style={{ gap: 3 }}>
              <Text style={{ color: color("foreground"), fontWeight: "800" }}>{club.name}</Text>
              <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{club.role ?? "Sponsor"}</Text>
            </View>
          )) : <Text style={{ color: color("mutedForeground") }}>No club memberships yet.</Text>}
          <Button title="Browse clubs" size="sm" variant="secondary" onPress={() => router.push("/clubs" as never)} />
        </Card>
      );
    }

    if (id === "events") {
      return (
        <Card key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Coming Up</Text>
          <DataBoundary data={events} emptyTitle="No upcoming events">
            {(items) => (
              <View style={{ gap: 10 }}>
                {items.slice(0, 3).map((event: any) => (
                  <View key={event._id}>
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>{event.title}</Text>
                    <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                      {shortDate(event.startAt)} · {timeRange(event.startAt, event.endAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </DataBoundary>
        </Card>
      );
    }

    if (id === "calendar") {
      return (
        <Card key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Calendar</Text>
          <DataBoundary data={calendarEntries} emptyTitle="No upcoming entries">
            {(items) => (
              <View style={{ gap: 10 }}>
                {items.slice(0, 4).map((entry: any) => (
                  <View key={entry._id}>
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>{entry.title}</Text>
                    <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                      {shortDate(entry.startAt)} - {timeRange(entry.startAt, entry.endAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </DataBoundary>
        </Card>
      );
    }

    if (id === "flex") {
      return (
        <Card key={id} style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Flex Friday</Text>
          <Text style={{ color: color("foreground"), fontSize: 24, fontWeight: "900" }}>
            {flexCredits?.earned ?? 0} credits
          </Text>
          <Text style={{ color: color("mutedForeground") }}>
            Active registrations: {(registrations ?? []).length}
          </Text>
        </Card>
      );
    }

    return (
      <Card key={id} style={{ gap: 8 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Fun Fact</Text>
        <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
          Innovation Academy pathways connect student projects to real sponsors and community needs.
        </Text>
      </Card>
    );
  }

  return (
    <Screen title={`Hi, ${user?.firstName ?? "there"}`} subtitle="Your school day at a glance.">
      {schedule.isOffline || schedule.isStale ? <OfflineBanner stale={schedule.isStale} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={editing ? "Done" : "Edit widgets"} variant="secondary" onPress={() => setEditing((value) => !value)} />
        {editing ? (
          <Button
            title="Save"
            variant="tertiary"
            onPress={() => updateLayout({ layout }).then(() => setEditing(false))}
          />
        ) : null}
      </View>

      {editing ? (
        <Card style={{ gap: 10 }}>
          {layout.map((id) => (
            <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: color("foreground"), flex: 1, fontWeight: "800" }}>{WIDGET_LABELS[id]}</Text>
              <Button title="Up" size="sm" variant="ghost" onPress={() => moveWidget(id, -1)} />
              <Button title="Down" size="sm" variant="ghost" onPress={() => moveWidget(id, 1)} />
              <Button title="Hide" size="sm" variant="tertiary" onPress={() => setLayout((current) => current.filter((item) => item !== id))} />
            </View>
          ))}
          {hiddenWidgets.map((id) => (
            <Button key={id} title={`Add ${WIDGET_LABELS[id]}`} variant="secondary" onPress={() => setLayout((current) => [...current, id])} />
          ))}
        </Card>
      ) : null}

      {layout.map((id) => renderWidget(id))}
    </Screen>
  );
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
