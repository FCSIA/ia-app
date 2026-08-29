import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { format, differenceInMinutes } from "date-fns";
import { CheckCircle2, ChevronRight, Clock, RefreshCw, SlidersHorizontal, Timer } from "lucide-react-native";
import { pickDailySchoolMessage, pickNavigationLoadingFact } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import {
  Badge,
  Card,
  IconButton,
  PressableScale,
  Progress,
  ScreenLoader,
  IaLoadingMark,
  LoadingFact,
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
import { PeriodBadge } from "@/features/schedule/period-badge";
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
  return <ScreenLoader />;
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
  const nextFlexFriday = resolveNextFlexFriday(flexFridays ?? []);

  return (
    <Screen
      header={<AppHeader title={user.firstName ? `Hi, ${user.firstName}` : "Home"} />}
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      {schedule === undefined ? (
        <Section title="School day"><HomeSkeleton /></Section>
      ) : (
        <>
          <WelcomeWidget user={user} schedule={schedule} schoolDay={schoolDay} />
          <DayProgressWidget schedule={schedule} schoolDay={schoolDay} />
        </>
      )}

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
  const [funFact, setFunFact] = useState(pickNavigationLoadingFact);
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
          title={schedule.value?.resolvedDay || schoolDay.isToday ? "Today" : schoolDay.label}
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
            onPress={() => setFunFact(pickNavigationLoadingFact())}
          />
        }
      >
        <LoadingFact fact={funFact} />
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
      <WelcomeWidget user={user} schedule={schedule.value} schoolDay={schoolDay} />
      <DayProgressWidget schedule={schedule.value} schoolDay={schoolDay} />
      {layout.length ? layout.map((id) => renderWidget(id)) : <HomeEmpty text="No sections shown." />}
    </Screen>
  );
}

function ScheduleSummary({ data, schoolDay }: { data: any; schoolDay: DashboardSchoolDay }) {
  if (!data?.mySchedule) {
    return <HomeSurface><HomeEmpty text="No schedule saved." /></HomeSurface>;
  }

  if (data.resolvedDay) {
    const day = data.resolvedDay;
    const dayBlocks = resolvedDayBlocks(day);
    const isResolvedToday = day.dateKey === format(new Date(), "yyyy-MM-dd");
    const omittedLabel = day.isSpecial && day.omittedPeriods.length
      ? `Not meeting: ${day.omittedPeriods.map((period: number) => `Period ${period}`).join(", ")}`
      : undefined;
    const setupLabel = day.lunchNeedsResolution
      ? "Choose whether Period 4 or Period 5 is lunch in My Week."
      : undefined;

    return (
      <View style={{ gap: spacing.md }}>
        {day.isSpecial || setupLabel ? (
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              paddingHorizontal: spacing.xs,
            }}
          >
            <Badge
              label={day.isSpecial ? "Special day" : "Setup needed"}
              color="orange"
            />
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
              <Txt variant="label" numberOfLines={1}>
                {day.name}
              </Txt>
              {omittedLabel || setupLabel ? (
                <Txt variant="caption" tone="muted">
                  {[omittedLabel, setupLabel].filter(Boolean).join(" · ")}
                </Txt>
              ) : null}
            </View>
          </View>
        ) : null}

        <HomeSurface>
          {dayBlocks.length ? dayBlocks.map((block: any, index: number) => {
            const isCurrent = isCurrentBlock(block, isResolvedToday);
            const courseSlug = block.entry?.course?.slug;
            const subtitle = block.kind === "LUNCH"
              ? `Period ${block.periodNumber} lunch`
              : block.kind === "CUSTOM"
                ? "School-day activity"
                : block.entry?.course?.department ?? (block.entry ? undefined : "No class assigned");
            return (
              <HomeRow
                key={block.key}
                divider={index > 0}
                leading={typeof block.periodNumber === "number"
                  ? <PeriodBadge periodNumber={block.periodNumber} emphasized={isCurrent} />
                  : undefined}
                title={resolvedBlockTitle(block)}
                subtitle={subtitle}
                meta={formatSchoolTime(block.startTime)}
                accessibilityLabel={courseSlug
                  ? `Period ${block.periodNumber}, ${block.entry.className}. Open course details`
                  : undefined}
                onPress={courseSlug
                  ? () => router.push(`/courses/${courseSlug}` as never)
                  : undefined}
              />
            );
          }) : (
            <HomeEmpty text="No school schedule today." />
          )}
        </HomeSurface>
      </View>
    );
  }

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
            leading={<PeriodBadge periodNumber={entry.periodNumber} emphasized={isCurrent} />}
            title={entry.className}
            meta={block ? formatSchoolTime(block.startTime) : undefined}
            accessibilityLabel={entry.course?.slug
              ? `Period ${entry.periodNumber}, ${entry.className}. Open course details`
              : undefined}
            onPress={entry.course?.slug
              ? () => router.push(`/courses/${entry.course.slug}` as never)
              : undefined}
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
  return (
    <Card style={{ padding: 0, paddingHorizontal: spacing.md, overflow: "hidden" }}>
      {children}
    </Card>
  );
}

function HomeRow({
  title,
  subtitle,
  meta,
  leading,
  divider = false,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  divider?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
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
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
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
    <View style={{ paddingVertical: 48, alignItems: "center", justifyContent: "center" }}>
      <IaLoadingMark size="sm" />
    </View>
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

function isCurrentBlock(
  block: { startTime: string; endTime: string } | undefined,
  isToday: boolean,
  now: Date = new Date(),
) {
  if (!block || !isToday) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= timeToMinutes(block.startTime) && minutes < timeToMinutes(block.endTime);
}

function timeToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getDashboardDayContext(schedule: any, schoolDay: DashboardSchoolDay) {
  if (Array.isArray(schedule?.resolvedDay?.blocks)) {
    return {
      blocks: resolvedDayBlocks(schedule.resolvedDay).sort(
        (left: any, right: any) => left.position - right.position,
      ),
      isToday: schedule.resolvedDay.dateKey === format(new Date(), "yyyy-MM-dd"),
      isResolvedDay: true,
    };
  }

  return {
    blocks: (schedule?.blocks ?? [])
      .filter((block: any) => block.weekday === schoolDay.value)
      .sort((left: any, right: any) => left.startTime.localeCompare(right.startTime)),
    isToday: schoolDay.isToday,
    isResolvedDay: false,
  };
}

function resolvedDayBlocks(day: any) {
  const hasCanonicalLunch = day.blocks.some((block: any) => block.kind === "LUNCH");
  return day.blocks.filter(
    (block: any) =>
      !(
        hasCanonicalLunch &&
        block.kind === "CUSTOM" &&
        block.label.trim().toLowerCase() === "lunch"
      ),
  );
}

function resolvedBlockTitle(block: any) {
  if (block.kind === "LUNCH") return "Lunch";
  return block.entry?.className ?? block.displayLabel ?? block.label;
}

function resolveSchoolDayStatus(
  schedule: any,
  schoolDay: DashboardSchoolDay,
  now: Date = new Date(),
) {
  const dayContext = getDashboardDayContext(schedule, schoolDay);
  const dayBlocks = dayContext.blocks;
  const current = dayBlocks.find((block: any) =>
    isCurrentBlock(block, dayContext.isToday, now),
  );

  if (current) {
    return {
      title: resolvedBlockTitle(current),
      subtitle: "In progress",
      meta: `${formatSchoolTime(current.startTime)}–${formatSchoolTime(current.endTime)}`,
    };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const next = dayContext.isToday
    ? dayBlocks.find((block: any) => timeToMinutes(block.startTime) > minutes)
    : dayBlocks[0];

  if (next) {
    return {
      title: resolvedBlockTitle(next),
      subtitle: dayContext.isToday ? "Next today" : `Next school day · ${schoolDay.label}`,
      meta: `${formatSchoolTime(next.startTime)}–${formatSchoolTime(next.endTime)}`,
    };
  }

  return {
    title: dayBlocks.length
      ? "School day complete"
      : dayContext.isResolvedDay
        ? "No school blocks today"
        : `No ${schoolDay.label} blocks`,
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

function WelcomeWidget({ user, schedule, schoolDay }: { user: AppUser; schedule: any; schoolDay: DashboardSchoolDay }) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const schoolStatus = useMemo(
    () => resolveSchoolDayStatus(schedule, schoolDay, now),
    [schedule, schoolDay, now],
  );
  const dayContext = getDashboardDayContext(schedule, schoolDay);
  const hasPersonalSchedule = getAppPersona(user) !== "student" || Boolean(schedule?.mySchedule);
  const lastBlockEnd = dayContext.blocks.reduce(
    (latest: number, block: any) => Math.max(latest, timeToMinutes(block.endTime)),
    -1,
  );
  const schoolIsOver =
    dayContext.isToday &&
    lastBlockEnd >= 0 &&
    now.getHours() * 60 + now.getMinutes() >= lastBlockEnd;
  const quietMessage = !hasPersonalSchedule || dayContext.blocks.length === 0
    ? pickDailySchoolMessage("no-school", `${user?._id ?? "guest"}:${format(now, "yyyy-MM-dd")}`)
    : schoolIsOver
      ? pickDailySchoolMessage("school-over", `${user?._id ?? "guest"}:${format(now, "yyyy-MM-dd")}`)
      : null;
  
  const firstName = user?.firstName ?? "";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Card style={{ padding: spacing.xl, gap: spacing.xl, marginBottom: spacing.xs, marginTop: spacing.xs }}>
      <View style={{ flexDirection: "column", gap: spacing.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing.md }}>
          {quietMessage ? (
            <Txt variant="label" tone="muted">
              {quietMessage}
            </Txt>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Clock size={20} color={color("primary")} opacity={0.6} />
                <Txt style={{ fontSize: 32, fontWeight: "800", lineHeight: 38, fontVariant: ["tabular-nums"] }}>
                  {format(now, "h:mm")}
                </Txt>
              </View>
              <Txt variant="caption" tone="muted">
                {format(now, "EEEE, MMM d")}
              </Txt>
            </>
          )}
        </View>

        <View style={{ flex: 1, gap: spacing.md }}>
          <Txt variant="title" style={{ fontSize: 28, lineHeight: 34 }}>
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </Txt>
          {!quietMessage ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <Txt variant="overline" tone="muted">Current Status</Txt>
              <Txt variant="section">{schoolStatus.title}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
                {schoolStatus.subtitle === "In progress" && (
                  <Badge label="Active" color="green" />
                )}
                <Txt variant="caption" tone="muted">{schoolStatus.meta ?? schoolStatus.subtitle}</Txt>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function DayProgressWidget({ schedule, schoolDay }: { schedule: any; schoolDay: DashboardSchoolDay }) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => {
    const dayContext = getDashboardDayContext(schedule, schoolDay);
    if (!dayContext.isToday) return null;

    const blocks = dayContext.blocks;
    if (blocks.length === 0) return null;

    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    const startTimes = blocks.map((b: any) => new Date(`${todayStr}T${b.startTime}:00`)).filter((d: any) => !isNaN(d.getTime()));
    const endTimes = blocks.map((b: any) => new Date(`${todayStr}T${b.endTime}:00`)).filter((d: any) => !isNaN(d.getTime()));

    if (startTimes.length === 0 || endTimes.length === 0) return null;

    const dayStart = new Date(Math.min(...startTimes.map((d: any) => d.getTime())));
    const dayEnd = new Date(Math.max(...endTimes.map((d: any) => d.getTime())));

    const totalMinutes = differenceInMinutes(dayEnd, dayStart);
    const elapsedMinutes = differenceInMinutes(now, dayStart);

    if (totalMinutes <= 0 || isNaN(totalMinutes)) return null;

    if (now < dayStart) return { percent: 0, status: "Not started", remaining: totalMinutes };
    if (now > dayEnd) return { percent: 100, status: "Done for the day", remaining: 0 };

    const percent = Math.max(0, Math.min(100, (elapsedMinutes / totalMinutes) * 100));
    const remaining = totalMinutes - elapsedMinutes;

    return { percent, status: "In progress", remaining };
  }, [schedule, schoolDay, now]);

  if (!progress) return null;

  return (
    <Card style={{ padding: spacing.lg, gap: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Timer size={18} color={color("mutedForeground")} />
          <Txt variant="section">Day Progress</Txt>
        </View>
      </View>
      
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Txt style={{ fontSize: 32, fontWeight: "800", lineHeight: 38, letterSpacing: -0.5 }}>
              {Math.round(progress.percent)}%
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {progress.percent >= 100 ? "School day complete" : `${progress.remaining} mins remaining`}
            </Txt>
          </View>
          {progress.percent >= 100 && (
            <CheckCircle2 size={32} color={color("primary")} />
          )}
        </View>
        <Progress value={progress.percent} indicatorColor={progress.percent >= 100 ? "#10b981" : undefined} />
      </View>
    </Card>
  );
}
