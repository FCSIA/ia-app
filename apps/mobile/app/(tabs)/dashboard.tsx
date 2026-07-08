import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { ArrowDown, ArrowUp, EyeOff, GripVertical } from "lucide-react-native";
import { pickNavigationLoadingMessage } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge, Button, Card, ListRow, Section, Sheet, Stat, Txt, useToast } from "@/components/ui";
import { shortDate, timeRange } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";
import { useOfflineValue } from "@/lib/offline-cache";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const DEFAULT_WIDGETS = ["funFact", "schedule", "calendar", "announcements", "flex", "clubs", "events", "quickActions"] as const;
const WIDGET_LABELS: Record<string, string> = {
  schedule: "Today",
  quickActions: "Shortcuts",
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
  const [customizing, setCustomizing] = useState(false);
  const [funFact, setFunFact] = useState(pickNavigationLoadingMessage);
  const [layout, setLayout] = useState<string[]>([...DEFAULT_WIDGETS]);
  const { showToast } = useToast();

  useEffect(() => {
    const saved = user?.dashboardLayout?.filter((id) => id in WIDGET_LABELS);
    if (saved?.length) {
      const normalized = normalizeLayout(saved);
      setLayout((current) => (arraysEqual(current, normalized) ? current : normalized));
    }
  }, [user?.dashboardLayout]);

  const hiddenWidgets = useMemo(() => DEFAULT_WIDGETS.filter((id) => !layout.includes(id)), [layout]);

  async function saveLayout(next = layout) {
    const normalized = normalizeLayout(next);
    setLayout(normalized);
    await updateLayout({ layout: normalized });
    showToast({ title: "Home layout saved", tone: "success" });
  }

  function moveWidget(id: string, direction: -1 | 1) {
    setLayout((current) => {
      const normalized = normalizeLayout(current);
      const index = normalized.indexOf(id);
      if (index < 0) return normalized;
      const nextIndex = index + direction;
      if (nextIndex < 1 || nextIndex >= normalized.length) return normalized;
      const next = [...normalized];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      void saveLayout(next);
      return next;
    });
  }

  function hideWidget(id: string) {
    const next = normalizeLayout(layout.filter((item) => item !== id));
    setLayout(next);
    void saveLayout(next);
  }

  function addWidget(id: string) {
    const next = normalizeLayout([...layout, id]);
    setLayout(next);
    void saveLayout(next);
  }

  function renderWidget(id: string) {
    if (id === "schedule") {
      return (
        <Section
          key={id}
          title="Today"
          action={<Badge label={user?.roles?.[0] ?? "Student"} color="orange" />}
        >
          <Card style={{ gap: spacing.sm }}>
            <DataBoundary data={schedule.value} emptyTitle="No schedule yet">
              {(data) => (
                <View style={{ gap: spacing.sm }}>
                  {(data.mySchedule?.entries ?? []).slice(0, 4).map((entry: any) => (
                    <ListRow
                      key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`}
                      title={`Period ${entry.periodNumber}: ${entry.className}`}
                      subtitle={entry.weekday}
                    />
                  ))}
                </View>
              )}
            </DataBoundary>
          </Card>
        </Section>
      );
    }

    if (id === "announcements") {
      return (
        <Section
          key={id}
          title="Unread Announcements"
          action={<Txt variant="label" tone="primary" onPress={() => router.push("/announcements" as never)}>See all</Txt>}
        >
          <DataBoundary data={announcements} emptyTitle="All caught up">
            {(items) => <>{items.slice(0, 3).map((item: any) => <AnnouncementCard key={item._id} announcement={item} />)}</>}
          </DataBoundary>
        </Section>
      );
    }

    if (id === "quickActions") {
      return (
        <Section key={id} title="Shortcuts">
          <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Button title="Flex Pass" size="sm" variant="secondary" onPress={() => router.push("/flex-friday/pass" as never)} />
            <Button title="Courses" size="sm" variant="secondary" onPress={() => router.push("/courses" as never)} />
            <Button title="Discover" size="sm" variant="secondary" onPress={() => router.push("/discover" as never)} />
          </Card>
        </Section>
      );
    }

    if (id === "clubs") {
      const memberships = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])].slice(0, 4);
      return (
        <Section
          key={id}
          title="My Clubs"
          action={<Txt variant="label" tone="primary" onPress={() => router.push("/clubs" as never)}>See all</Txt>}
        >
          <Card style={{ gap: spacing.sm }}>
            {memberships.length ? memberships.map((club: any) => (
              <ListRow key={club._id} title={club.name} subtitle={club.role ?? "Sponsor"} onPress={() => router.push(`/clubs/${club._id}` as never)} />
            )) : <Txt tone="muted">No club memberships yet.</Txt>}
          </Card>
        </Section>
      );
    }

    if (id === "events") {
      return (
        <Section
          key={id}
          title="Coming Up"
          action={<Txt variant="label" tone="primary" onPress={() => router.push("/calendar" as never)}>See all</Txt>}
        >
          <Card style={{ gap: spacing.sm }}>
            <DataBoundary data={events} emptyTitle="No upcoming events">
              {(items) => (
                <View style={{ gap: spacing.sm }}>
                  {items.slice(0, 3).map((event: any) => (
                    <ListRow
                      key={event._id}
                      title={event.title}
                      subtitle={`${shortDate(event.startAt)} - ${timeRange(event.startAt, event.endAt)}`}
                      onPress={() => router.push(`/events/${event._id}` as never)}
                    />
                  ))}
                </View>
              )}
            </DataBoundary>
          </Card>
        </Section>
      );
    }

    if (id === "calendar") {
      return (
        <Section
          key={id}
          title="Calendar"
          action={<Txt variant="label" tone="primary" onPress={() => router.push("/calendar" as never)}>See all</Txt>}
        >
          <Card style={{ gap: spacing.sm }}>
            <DataBoundary data={calendarEntries} emptyTitle="No upcoming entries">
              {(items) => (
                <View style={{ gap: spacing.sm }}>
                  {items.slice(0, 4).map((entry: any) => (
                    <ListRow
                      key={entry._id}
                      title={entry.title}
                      subtitle={`${shortDate(entry.startAt)} - ${timeRange(entry.startAt, entry.endAt)}`}
                    />
                  ))}
                </View>
              )}
            </DataBoundary>
          </Card>
        </Section>
      );
    }

    if (id === "flex") {
      return (
        <Section
          key={id}
          title="Flex Friday"
          action={<Txt variant="label" tone="primary" onPress={() => router.push("/flex-friday" as never)}>See all</Txt>}
        >
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Stat value={flexCredits?.earned ?? 0} label="credits" />
            </View>
            <View style={{ flex: 1 }}>
              <Stat value={(registrations ?? []).length} label="registrations" />
            </View>
          </View>
        </Section>
      );
    }

    return (
      <Section
        key={id}
        title="Fun Fact"
        action={<Txt variant="label" tone="primary" onPress={() => setFunFact(pickNavigationLoadingMessage())}>Another</Txt>}
      >
        <Card>
          <Txt tone="muted">{funFact}</Txt>
        </Card>
      </Section>
    );
  }

  return (
    <Screen header={<AppHeader title={`Hi, ${user?.firstName ?? "there"}`} subtitle="Your school day at a glance." />}>
      {schedule.isOffline || schedule.isStale ? <OfflineBanner stale={schedule.isStale} /> : null}
      <Button title="Customize home" variant="secondary" onPress={() => setCustomizing(true)} />
      {layout.map((id) => renderWidget(id))}

      <Sheet open={customizing} onClose={() => setCustomizing(false)} title="Customize Home" snapPoints={["65%", "88%"]}>
        <Txt tone="muted">Fun Fact stays at the top. Reorder the rest with the arrows or drag handles.</Txt>
        <DraggableFlatList
          data={layout}
          keyExtractor={(item) => item}
          activationDistance={12}
          style={{ height: 330 }}
          contentContainerStyle={{ gap: spacing.sm }}
          onDragEnd={({ data }) => {
            void saveLayout(data);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<string>) => (
            <ListRow
              title={WIDGET_LABELS[item]}
              subtitle={item === "funFact" ? "Pinned to top" : isActive ? "Move widget" : "Use arrows or hold the handle to drag"}
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Button title="" size="sm" variant="ghost" icon={ArrowUp} disabled={item === "funFact"} onPress={() => moveWidget(item, -1)} />
                  <Button title="" size="sm" variant="ghost" icon={ArrowDown} disabled={item === "funFact"} onPress={() => moveWidget(item, 1)} />
                  <Button title="" size="sm" variant="ghost" icon={EyeOff} disabled={item === "funFact"} onPress={() => hideWidget(item)} />
                  <Button title="" size="sm" variant="ghost" icon={GripVertical} disabled={item === "funFact"} onLongPress={drag} onPress={drag} />
                </View>
              }
            />
          )}
        />
        {hiddenWidgets.map((id) => (
          <Button key={id} title={`Add ${WIDGET_LABELS[id]}`} variant="secondary" onPress={() => addWidget(id)} />
        ))}
      </Sheet>
    </Screen>
  );
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function normalizeLayout(layout: readonly string[]) {
  const allowed = new Set<string>(DEFAULT_WIDGETS);
  const withoutFunFact = layout.filter((id) => id !== "funFact" && allowed.has(id));
  return ["funFact", ...withoutFunFact] as string[];
}
