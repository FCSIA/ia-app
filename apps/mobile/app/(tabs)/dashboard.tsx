import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { ChevronRight, EyeOff, GripVertical, RefreshCw, SlidersHorizontal } from "lucide-react-native";
import { pickNavigationLoadingMessage } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import {
  Button,
  IconButton,
  ListRow,
  PressableScale,
  Section,
  Sheet,
  Skeleton,
  Txt,
  useToast,
} from "@/components/ui";
import { shortDate, timeRange } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const DEFAULT_WIDGETS = ["schedule", "announcements", "calendar", "flex", "clubs", "funFact"] as const;
const WIDGET_LABELS: Record<string, string> = {
  schedule: "Schedule",
  announcements: "Announcements",
  calendar: "Coming up",
  events: "Coming up",
  flex: "Flex Friday",
  clubs: "Clubs",
  funFact: "Fun fact",
};
const EMPTY_ARGS = {};
const UNREAD_ANNOUNCEMENTS_ARGS = { unreadOnly: true };

export default function DashboardScreen() {
  const user = useCurrentUser();
  const { color } = useTheme();
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const calendarWindow = useMemo(() => {
    const startDate = Date.now();
    return { startDate, endDate: startDate + 30 * 24 * 60 * 60 * 1000 };
  }, []);
  const announcements = useQuery(api.announcements.feed.list, UNREAD_ANNOUNCEMENTS_ARGS);
  const liveSchedule = useQuery(api.schedule.dashboard.get, EMPTY_ARGS);
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
    try {
      await updateLayout({ layout: normalized });
      showToast({ title: "Home updated", tone: "success" });
    } catch (error) {
      showToast({
        title: "Home not updated",
        body: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  function hideWidget(id: string) {
    if (layout.length === 1) {
      showToast({ title: "Keep one home section" });
      return;
    }
    void saveLayout(layout.filter((item) => item !== id));
  }

  function addWidget(id: string) {
    void saveLayout([...layout, id]);
  }

  function renderWidget(id: string) {
    if (id === "schedule") {
      return (
        <Section
          key={id}
          title={schoolDay.isToday ? "Today" : schoolDay.label}
          action={<SectionLink label="View week" onPress={() => router.push("/calendar" as never)} />}
        >
          {schedule.value === undefined ? (
            <HomeSkeleton count={4} />
          ) : schedule.value === null ? (
            <HomeSurface><HomeEmpty text="No schedule saved." /></HomeSurface>
          ) : (
            <ScheduleSummary data={schedule.value} schoolDay={schoolDay} />
          )}
        </Section>
      );
    }

    if (id === "announcements") {
      return (
        <Section
          key={id}
          title="Announcements"
          action={<SectionLink label="Open feed" onPress={() => router.push("/announcements" as never)} />}
        >
          {announcements === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeSurface>
              {announcements.length ? announcements.slice(0, 3).map((item: any, index: number) => (
                <HomeRow
                  key={item._id}
                  divider={index > 0}
                  leading={
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: radii.pill,
                        backgroundColor: color("primary"),
                      }}
                    />
                  }
                  title={item.title}
                  subtitle={item.body}
                  onPress={() => router.push(`/announcements/${item._id}` as never)}
                />
              )) : <HomeEmpty text="You’re caught up." />}
            </HomeSurface>
          )}
        </Section>
      );
    }

    if (id === "calendar") {
      return (
        <Section
          key={id}
          title="Coming up"
          action={<SectionLink label="Open calendar" onPress={() => router.push("/calendar" as never)} />}
        >
          {calendarEntries === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeSurface>
              {calendarEntries.length ? calendarEntries.slice(0, 4).map((entry: any, index: number) => (
                <HomeRow
                  key={entry._id}
                  divider={index > 0}
                  title={entry.title}
                  subtitle={entry.location}
                  meta={`${shortDate(entry.startAt)} · ${timeRange(entry.startAt)}`}
                  onPress={() => entry.eventId
                    ? router.push(`/events/${entry.eventId}` as never)
                    : router.push("/calendar" as never)}
                />
              )) : <HomeEmpty text="Nothing coming up." />}
            </HomeSurface>
          )}
        </Section>
      );
    }

    if (id === "flex") {
      const summary = flexCredits === undefined || registrations === undefined
        ? undefined
        : { credits: flexCredits?.earned ?? 0, registrations: registrations.length };
      return (
        <Section
          key={id}
          title="Flex Friday"
          action={<SectionLink label="Open Flex" onPress={() => router.push("/flex-friday" as never)} />}
        >
          {summary === undefined ? (
            <HomeSkeleton />
          ) : (
            <HomeSurface>
              <HomeRow
                title={`${summary.credits} credit${summary.credits === 1 ? "" : "s"}`}
                subtitle={`${summary.registrations} registration${summary.registrations === 1 ? "" : "s"}`}
                onPress={() => router.push("/flex-friday" as never)}
              />
            </HomeSurface>
          )}
        </Section>
      );
    }

    if (id === "clubs") {
      const memberships = myClubs === undefined
        ? undefined
        : [
            ...(myClubs.memberOf ?? []),
            ...(myClubs.sponsoring ?? []).map((club: any) => ({ ...club, role: club.role ?? "SPONSOR" })),
          ]
            .filter((club: any, index: number, clubs: any[]) => clubs.findIndex((item) => item._id === club._id) === index)
            .slice(0, 4);
      return (
        <Section
          key={id}
          title="Clubs"
          action={<SectionLink label="Open clubs" onPress={() => router.push("/clubs" as never)} />}
        >
          {memberships === undefined ? (
            <HomeSkeleton count={2} />
          ) : (
            <HomeSurface>
              {memberships.length ? memberships.map((club: any, index: number) => (
                <HomeRow
                  key={club._id}
                  divider={index > 0}
                  title={club.name}
                  subtitle={club.role ? formatRole(club.role) : undefined}
                  onPress={() => router.push(`/clubs/${club._id}` as never)}
                />
              )) : <HomeEmpty text="No clubs yet." />}
            </HomeSurface>
          )}
        </Section>
      );
    }

    return (
      <Section
        key={id}
        title="Fun fact"
        action={
          <IconButton
            icon={RefreshCw}
            label="Show another fun fact"
            size="sm"
            variant="ghost"
            onPress={() => setFunFact(pickNavigationLoadingMessage())}
          />
        }
      >
        <Txt tone="muted">{funFact}</Txt>
      </Section>
    );
  }

  return (
    <Screen
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
      header={
        <AppHeader
          title={user?.firstName ? `Hi, ${user.firstName}` : "Home"}
          action={
            <IconButton
              icon={SlidersHorizontal}
              label="Customize home"
              onPress={() => setCustomizing(true)}
            />
          }
        />
      }
    >
      {schedule.isOffline || schedule.isStale ? <OfflineBanner stale={schedule.isStale} /> : null}
      {layout.length ? layout.map((id) => renderWidget(id)) : <HomeEmpty text="No sections shown." />}

      <Sheet open={customizing} onClose={() => setCustomizing(false)} title="Customize home" snapPoints={["68%", "90%"]}>
        <Txt tone="muted">Hold a handle to reorder. Hide sections you don’t use.</Txt>
        <DraggableFlatList
          data={layout}
          keyExtractor={(item) => item}
          activationDistance={12}
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ gap: spacing.sm }}
          onDragEnd={({ data }) => {
            void saveLayout(data);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<string>) => (
            <View style={{ opacity: isActive ? 0.72 : 1 }}>
              <ListRow
                title={WIDGET_LABELS[item]}
                trailing={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <IconButton
                      icon={EyeOff}
                      label={`Hide ${WIDGET_LABELS[item]}`}
                      size="sm"
                      variant="ghost"
                      disabled={layout.length === 1}
                      onPress={() => hideWidget(item)}
                    />
                    <PressableScale
                      accessibilityLabel={`Reorder ${WIDGET_LABELS[item]}`}
                      onLongPress={drag}
                      delayLongPress={180}
                      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                    >
                      <GripVertical size={20} color={color("mutedForeground")} />
                    </PressableScale>
                  </View>
                }
              />
            </View>
          )}
        />
        {hiddenWidgets.length ? (
          <Section title="Hidden">
            {hiddenWidgets.map((id) => (
              <Button
                key={id}
                title={`Show ${WIDGET_LABELS[id]}`}
                variant="tertiary"
                onPress={() => addWidget(id)}
              />
            ))}
          </Section>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function ScheduleSummary({ data, schoolDay }: { data: any; schoolDay: DashboardSchoolDay }) {
  const { color } = useTheme();
  const entries = (data?.mySchedule?.entries ?? [])
    .filter((entry: any) => entry.weekday === schoolDay.value)
    .sort((left: any, right: any) => left.periodNumber - right.periodNumber);
  const blocks = (data?.blocks ?? []).filter((block: any) => block.weekday === schoolDay.value);

  return (
    <HomeSurface>
      {entries.length ? entries.map((entry: any, index: number) => {
        const block = blocks.find((item: any) => item.periodNumber === entry.periodNumber);
        const isCurrent = isCurrentBlock(block, schoolDay.isToday);
        return (
          <HomeRow
            key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`}
            divider={index > 0}
            leading={
              <View
                accessibilityLabel={`Period ${entry.periodNumber}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isCurrent ? color("primary") : color("muted"),
                }}
              >
                <Txt
                  variant="label"
                  tone={isCurrent ? "default" : "muted"}
                  style={{ color: isCurrent ? color("primaryForeground") : undefined, fontWeight: "800" }}
                >
                  {entry.periodNumber}
                </Txt>
              </View>
            }
            title={entry.className}
            meta={block ? formatSchoolTime(block.startTime) : undefined}
          />
        );
      }) : (
        <HomeEmpty text={data?.mySchedule ? "No classes this day." : "No schedule saved."} />
      )}
    </HomeSurface>
  );
}

function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingLeft: spacing.sm }}
    >
      <Txt variant="label" tone="primary">
        {label}
      </Txt>
    </PressableScale>
  );
}

function HomeSurface({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: radii.xl,
        backgroundColor: color("secondary"),
        paddingHorizontal: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

function HomeRow({
  title,
  subtitle,
  meta,
  leading,
  divider = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) {
  const { color } = useTheme();
  const content = (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: color("border"),
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Txt variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>
            {title}
          </Txt>
          {meta ? (
            <Txt variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: "38%" }}>
              {meta}
            </Txt>
          ) : null}
        </View>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={color("mutedForeground")} /> : null}
    </View>
  );

  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}

function HomeEmpty({ text }: { text: string }) {
  return (
    <View style={{ minHeight: 52, justifyContent: "center", paddingVertical: spacing.sm }}>
      <Txt tone="muted">{text}</Txt>
    </View>
  );
}

function HomeSkeleton({ count = 1 }: { count?: number }) {
  return (
    <HomeSurface>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            minHeight: 52,
            justifyContent: "center",
            borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
            borderTopColor: "transparent",
          }}
        >
          <Skeleton style={{ width: index % 2 ? "72%" : "58%", height: 14 }} />
        </View>
      ))}
    </HomeSurface>
  );
}

type DashboardSchoolDay = ReturnType<typeof getDashboardSchoolDay>;

function getDashboardSchoolDay() {
  const today = new Date().getDay();
  const weekdays = [
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
  ] as const;
  if (today >= 1 && today <= 5) return { ...weekdays[today - 1], isToday: true };
  return { ...weekdays[0], isToday: false };
}

function formatSchoolTime(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function isCurrentBlock(block: { startTime: string; endTime: string } | undefined, isToday: boolean) {
  if (!block || !isToday) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= timeToMinutes(block.startTime) && minutes < timeToMinutes(block.endTime);
}

function timeToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatRole(role: string) {
  return role.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function normalizeLayout(layout: readonly string[]) {
  const allowed = new Set<string>(DEFAULT_WIDGETS);
  const migrated = layout.map((id) => id === "events" ? "calendar" : id);
  return [...new Set(migrated.filter((id) => allowed.has(id)))] as string[];
}
