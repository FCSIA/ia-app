import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { ChevronRight, RefreshCw, SlidersHorizontal } from "lucide-react-native";
import { pickNavigationLoadingMessage } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import {
  IconButton,
  PressableScale,
  Section,
  Skeleton,
  Txt,
} from "@/components/ui";
import { shortDate, timeRange } from "@/lib/format";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  dashboardLayoutsEqual,
  resolveDashboardLayout,
  type DashboardWidgetId,
} from "@/features/dashboard/dashboard-layout";
import {
  getAppPersona,
  useCurrentUser,
  useLiveCurrentUser,
  type AppUser,
} from "@/lib/auth";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const EMPTY_ARGS = {};
const UNREAD_ANNOUNCEMENTS_ARGS = { unreadOnly: true };

export default function DashboardScreen() {
  const cachedUser = useCurrentUser();
  const liveUser = useLiveCurrentUser();
  const user = liveUser === undefined ? cachedUser : liveUser;
  const persona = getAppPersona(user);

  if (persona === "unknown") {
    return <DashboardLoading />;
  }

  if (persona === "student") {
    return <StudentDashboardScreen user={user!} />;
  }

  return <OperationalDashboardScreen user={user!} />;
}

function DashboardLoading() {
  return (
    <Screen
      header={<AppHeader title="Home" />}
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      <HomeSkeleton count={4} />
      <HomeSkeleton count={3} />
    </Screen>
  );
}

function OperationalDashboardScreen({ user }: { user: AppUser }) {
  const { color } = useTheme();
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const calendarWindow = useMemo(() => {
    const startDate = Date.now();
    return { startDate, endDate: startDate + 30 * 24 * 60 * 60 * 1000 };
  }, []);
  const schedule = useQuery(api.schedule.dashboard.get, EMPTY_ARGS);
  const announcements = useQuery(api.announcements.feed.list, UNREAD_ANNOUNCEMENTS_ARGS);
  const calendarEntries = useQuery(api.events.calendar.list, calendarWindow);
  const flexFridays = useQuery(api.flexFriday.fridays.list, EMPTY_ARGS);
  const schoolStatus = resolveSchoolDayStatus(schedule?.blocks ?? [], schoolDay);
  const nextFlexFriday = resolveNextFlexFriday(flexFridays ?? []);

  return (
    <Screen
      header={<AppHeader title={user.firstName ? `Hi, ${user.firstName}` : "Home"} />}
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      <Section title="School day">
        {schedule === undefined ? (
          <HomeSkeleton />
        ) : (
          <HomeSurface>
            <HomeRow
              title={schoolStatus.title}
              subtitle={schoolStatus.subtitle}
              meta={schoolStatus.meta}
            />
          </HomeSurface>
        )}
      </Section>

      <Section
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

      <Section
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

      <Section
        title="Flex Friday"
        action={<SectionLink label="Open Flex" onPress={() => router.push("/flex-friday" as never)} />}
      >
        {flexFridays === undefined ? (
          <HomeSkeleton />
        ) : (
          <HomeSurface>
            {nextFlexFriday ? (
              <HomeRow
                title={shortDate(nextFlexFriday.date)}
                subtitle={[
                  sentenceCase(nextFlexFriday.type),
                  `${nextFlexFriday._count?.sessions ?? 0} session${(nextFlexFriday._count?.sessions ?? 0) === 1 ? "" : "s"}`,
                ].join(" · ")}
                onPress={() => router.push("/flex-friday" as never)}
              />
            ) : (
              <HomeEmpty text="No Flex Friday scheduled." />
            )}
          </HomeSurface>
        )}
      </Section>
    </Screen>
  );
}

function StudentDashboardScreen({ user }: { user: AppUser }) {
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
  const schedule = useOfflineValue("dashboard-schedule", liveSchedule);
  const [funFact, setFunFact] = useState(pickNavigationLoadingMessage);
  const [layout, setLayout] = useState<DashboardWidgetId[]>([...DEFAULT_DASHBOARD_WIDGETS]);

  useEffect(() => {
    const resolved = resolveDashboardLayout(user.dashboardLayout);
    setLayout((current) =>
      dashboardLayoutsEqual(current, resolved) ? current : resolved,
    );
  }, [user?.dashboardLayout]);

  function renderWidget(id: DashboardWidgetId) {
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
              onPress={() => router.push("/settings/home" as never)}
            />
          }
        />
      }
    >
      {schedule.isOffline || schedule.isStale ? <OfflineBanner stale={schedule.isStale} /> : null}
      {layout.length ? layout.map((id) => renderWidget(id)) : <HomeEmpty text="No sections shown." />}
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

function resolveSchoolDayStatus(blocks: any[], schoolDay: DashboardSchoolDay) {
  const dayBlocks = blocks
    .filter((block) => block.weekday === schoolDay.value)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const current = dayBlocks.find((block) => isCurrentBlock(block, schoolDay.isToday));

  if (current) {
    return {
      title: current.label,
      subtitle: "In progress",
      meta: `${formatSchoolTime(current.startTime)}–${formatSchoolTime(current.endTime)}`,
    };
  }

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const next = schoolDay.isToday
    ? dayBlocks.find((block) => timeToMinutes(block.startTime) > minutes)
    : dayBlocks[0];

  if (next) {
    return {
      title: next.label,
      subtitle: schoolDay.isToday ? "Next today" : `Next school day · ${schoolDay.label}`,
      meta: `${formatSchoolTime(next.startTime)}–${formatSchoolTime(next.endTime)}`,
    };
  }

  return {
    title: dayBlocks.length ? "School day complete" : `No ${schoolDay.label} blocks`,
    subtitle: dayBlocks.length ? "No more scheduled blocks today." : "The school-day schedule is not configured.",
    meta: undefined,
  };
}

function resolveNextFlexFriday(fridays: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return fridays
    .filter((friday) => friday.date >= today.getTime())
    .sort((left, right) => left.date - right.date)[0];
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatRole(role: string) {
  return role.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
