import { sentenceCaseEnum } from "~/apps/shared/labels";
import { isUpcomingCalendarEntry } from "~/apps/shared/calendar-date";
import { clockMinutes, formatClockTime } from "~/apps/shared/school-time";
import { greetingName } from "~/apps/shared/user-name";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@/lib/convex-react";
import { format, differenceInMinutes } from "date-fns";
import { CheckCircle2, Clock, RefreshCw, SlidersHorizontal, Timer } from "lucide-react-native";
import { pickDailySchoolMessage, pickNavigationLoadingFact } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import {
  Badge,
  Card,
  IconButton,
  Progress,
  ScreenLoader,
  LoadingFact,
  Section,
  Txt,
} from "@/components/ui";
import { shortDate } from "@/lib/format";
import {
  DEFAULT_HOME_WIDGETS,
  homeLayoutsEqual,
  resolveHomeLayout,
  type HomeWidgetId,
} from "@/features/dashboard/home-layout";
import {
  AnnouncementsWidget,
  ComingUpWidget,
  HomeEmpty,
  HomeRow,
  HomeSkeleton,
  HomeSurface,
  SectionLink,
} from "@/features/dashboard/home-ui";
import {
  getDashboardDayContext,
  getDashboardSchoolDay,
  isCurrentBlock,
  mergePinnedAnnouncements,
  resolvedBlockTitle,
  resolvedDayBlocks,
  resolveSchoolDayStatus,
  type ScheduleDay,
  type SchoolDayLabel,
} from "@/features/dashboard/schedule-day";
import { PeriodBadge } from "@/features/schedule/period-badge";
import { useCurrentUser, useLiveCurrentUser, type AppUser } from "@/lib/auth";
import { getAppPersona } from "@/lib/persona";
import { useOfflineValue } from "@/lib/offline-cache";
import {
  currentDashboardInputs,
  operationalDashboardQueries,
  studentDashboardQueries,
  type DashboardInputs,
  type SharedDashboardQueries,
} from "@/lib/tab-queries";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { useAnnouncementFeedClock } from "@/features/announcements/use-announcement-feed-clock";
import { api } from "~/apps/convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";

export default function DashboardScreen() {
  const cachedUser = useCurrentUser();
  const liveUser = useLiveCurrentUser();
  const user = liveUser === undefined ? cachedUser : liveUser;
  const persona = getAppPersona(user);

  if (persona === "unknown") {
    return <ScreenLoader />;
  }

  if (persona === "student") {
    return <StudentDashboardScreen user={user!} />;
  }

  return <OperationalDashboardScreen user={user!} />;
}

/** The query arguments the dashboard holds for the life of the screen. */
function useDashboardInputs(): DashboardInputs {
  const announcementNow = useAnnouncementFeedClock();
  const [upcomingWindow] = useState(() => currentDashboardInputs().upcomingWindow);
  return { announcementNow, upcomingWindow, at: new Date() };
}

/** The widgets both dashboards show: the school day, announcements and what is coming up. */
function useSharedDashboardData(queries: SharedDashboardQueries, inputs: DashboardInputs) {
  const day = useQuery(queries.schoolDay.query, queries.schoolDay.args);
  const unread = useQuery(queries.unreadAnnouncements.query, queries.unreadAnnouncements.args);
  const pinned = useQuery(queries.pinnedAnnouncements.query, queries.pinnedAnnouncements.args) ?? [];
  const upcoming = useQuery(queries.upcomingEvents.query, queries.upcomingEvents.args);
  const startedBefore = useMemo(() => Date.now(), []);
  const calendarEntries = useMemo(
    () => upcoming?.filter((entry) => isUpcomingCalendarEntry(entry, inputs.upcomingWindow, startedBefore)),
    [upcoming, startedBefore, inputs.upcomingWindow],
  );
  return {
    day,
    announcementCards: mergePinnedAnnouncements(unread, pinned),
    calendarEntries,
  };
}

function OperationalDashboardScreen({ user }: { user: AppUser }) {
  const inputs = useDashboardInputs();
  const queries = operationalDashboardQueries(inputs);
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const { day, announcementCards, calendarEntries } = useSharedDashboardData(queries, inputs);
  const flexFridays = useQuery(queries.flexFridays.query, queries.flexFridays.args);
  const nextFlexFriday = resolveNextFlexFriday(flexFridays ?? []);

  return (
    <Screen
      header={<AppHeader title={greetingName(user) ? `Hi, ${greetingName(user)}` : "Home"} />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      {day === undefined ? (
        <Section title="School day"><HomeSkeleton /></Section>
      ) : (
        <>
          <WelcomeWidget user={user} day={day} schoolDay={schoolDay} />
          <DayProgressWidget day={day} schoolDay={schoolDay} />
        </>
      )}

      <AnnouncementsWidget cards={announcementCards} />
      <ComingUpWidget entries={calendarEntries} />

      <Section
        title="Flex Friday"
        action={<SectionLink label="Open Flex" onPress={() => router.push("/flex-friday")} />}
      >
        {flexFridays === undefined ? (
          <HomeSkeleton />
        ) : (
          <HomeSurface>
            {nextFlexFriday ? (
              <HomeRow
                title={shortDate(nextFlexFriday.date)}
                subtitle={[
                  sentenceCaseEnum(nextFlexFriday.type),
                  `${nextFlexFriday._count?.sessions ?? 0} session${(nextFlexFriday._count?.sessions ?? 0) === 1 ? "" : "s"}`,
                ].join(" · ")}
                onPress={() => router.push("/flex-friday")}
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
  const inputs = useDashboardInputs();
  const queries = studentDashboardQueries(inputs);
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const { day: liveDay, announcementCards, calendarEntries } = useSharedDashboardData(queries, inputs);
  const myClubs = useQuery(queries.myClubs.query, queries.myClubs.args);
  const flexCredits = useQuery(queries.flexCredits.query, queries.flexCredits.args);
  const registrations = useQuery(queries.registrations.query, queries.registrations.args);
  const schedule = useOfflineValue("dashboard-school-day", liveDay);
  const [funFact, setFunFact] = useState(pickNavigationLoadingFact);
  const [layout, setLayout] = useState<HomeWidgetId[]>([...DEFAULT_HOME_WIDGETS]);

  useEffect(() => {
    const resolved = resolveHomeLayout(user.dashboardLayout);
    setLayout((current) =>
      homeLayoutsEqual(current, resolved) ? current : resolved,
    );
  }, [user?.dashboardLayout]);

  function renderWidget(id: HomeWidgetId) {
    if (id === "schedule") {
      return (
        <Section
          key={id}
          title={schedule.value || schoolDay.isToday ? "Today" : schoolDay.label}
          action={<SectionLink label="View week" onPress={() => router.push("/calendar")} />}
        >
          {schedule.value === undefined ? (
            <HomeSkeleton />
          ) : schedule.value === null ? (
            <HomeSurface><HomeEmpty text="No schedule saved." /></HomeSurface>
          ) : (
            <ScheduleSummary day={schedule.value} />
          )}
        </Section>
      );
    }

    if (id === "announcements") return <AnnouncementsWidget key={id} cards={announcementCards} />;

    if (id === "calendar") return <ComingUpWidget key={id} entries={calendarEntries} />;

    if (id === "flex") {
      const summary = flexCredits === undefined || registrations === undefined
        ? undefined
        : { credits: flexCredits?.earned ?? 0, registrations: registrations.length };
      return (
        <Section
          key={id}
          title="Flex Friday"
          action={<SectionLink label="Open Flex" onPress={() => router.push("/flex-friday")} />}
        >
          {summary === undefined ? (
            <HomeSkeleton />
          ) : (
            <HomeSurface>
              <HomeRow
                title={`${summary.credits} credit${summary.credits === 1 ? "" : "s"}`}
                subtitle={`${summary.registrations} registration${summary.registrations === 1 ? "" : "s"}`}
                onPress={() => router.push("/flex-friday")}
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
            ...(myClubs.sponsoring ?? []).map((club) => ({ ...club, role: club.role ?? "SPONSOR" })),
          ]
            .filter((club, index, clubs) => clubs.findIndex((item) => item._id === club._id) === index)
            .slice(0, 4);
      return (
        <Section
          key={id}
          title="Clubs"
          action={<SectionLink label="Open clubs" onPress={() => router.push("/clubs")} />}
        >
          {memberships === undefined ? (
            <HomeSkeleton />
          ) : (
            <HomeSurface>
              {memberships.length ? memberships.map((club, index) => (
                <HomeRow
                  key={club._id}
                  divider={index > 0}
                  title={club.name}
                  subtitle={club.role ? sentenceCaseEnum(club.role) : undefined}
                  onPress={() => router.push(`/clubs/${club._id}`)}
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
      contentContainerStyle={{ gap: spacing.xl }}
      header={
        <AppHeader
          title={greetingName(user) ? `Hi, ${greetingName(user)}` : "Home"}
          action={
            <IconButton
              icon={SlidersHorizontal}
              label="Customize home"
              onPress={() => router.push("/settings/home")}
            />
          }
        />
      }
    >
      {schedule.isOffline || schedule.isStale ? <OfflineBanner stale={schedule.isStale} /> : null}
      <WelcomeWidget user={user} day={schedule.value ?? undefined} schoolDay={schoolDay} />
      <DayProgressWidget day={schedule.value ?? undefined} schoolDay={schoolDay} />
      {layout.length ? layout.map((id) => renderWidget(id)) : <HomeEmpty text="No sections shown." />}
    </Screen>
  );
}

function ScheduleSummary({ day }: { day: ScheduleDay }) {
  if (!day.hasPersonalSchedule) {
    return <HomeSurface><HomeEmpty text="No schedule saved." /></HomeSurface>;
  }

  const dayBlocks = resolvedDayBlocks(day);
  const isResolvedToday = day.dateKey === format(new Date(), "yyyy-MM-dd");
  const omittedLabel = day.isSpecial && day.omittedPeriods.length
    ? `Not meeting: ${day.omittedPeriods.map((period) => `Period ${period}`).join(", ")}`
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
        {dayBlocks.length ? dayBlocks.map((block, index) => {
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
              meta={formatClockTime(block.startTime)}
              accessibilityLabel={courseSlug
                ? `Period ${block.periodNumber}, ${block.entry?.className}. Open course details`
                : undefined}
              onPress={courseSlug
                ? () => router.push(`/courses/${courseSlug}`)
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


function resolveNextFlexFriday(fridays: FunctionReturnType<typeof api.flexFriday.fridays.list>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return fridays
    .filter((friday) => friday.date >= today.getTime())
    .sort((left, right) => left.date - right.date)[0];
}

function WelcomeWidget({ user, day, schoolDay }: { user: AppUser; day: ScheduleDay | undefined; schoolDay: SchoolDayLabel }) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const schoolStatus = useMemo(
    () => resolveSchoolDayStatus(day, schoolDay, now),
    [day, schoolDay, now],
  );
  const dayContext = getDashboardDayContext(day, schoolDay);
  const hasPersonalSchedule = getAppPersona(user) !== "student" || Boolean(day?.hasPersonalSchedule);
  const lastBlockEnd = dayContext.blocks.reduce(
    (latest, block) => Math.max(latest, clockMinutes(block.endTime)),
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
  
  const firstName = greetingName(user);
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

function DayProgressWidget({ day, schoolDay }: { day: ScheduleDay | undefined; schoolDay: SchoolDayLabel }) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => {
    const dayContext = getDashboardDayContext(day, schoolDay);
    if (!dayContext.isToday) return null;

    const blocks = dayContext.blocks;
    if (blocks.length === 0) return null;

    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    const startTimes = blocks.map((b) => new Date(`${todayStr}T${b.startTime}:00`)).filter((d) => !isNaN(d.getTime()));
    const endTimes = blocks.map((b) => new Date(`${todayStr}T${b.endTime}:00`)).filter((d) => !isNaN(d.getTime()));

    if (startTimes.length === 0 || endTimes.length === 0) return null;

    const dayStart = new Date(Math.min(...startTimes.map((d) => d.getTime())));
    const dayEnd = new Date(Math.max(...endTimes.map((d) => d.getTime())));

    const totalMinutes = differenceInMinutes(dayEnd, dayStart);
    const elapsedMinutes = differenceInMinutes(now, dayStart);

    if (totalMinutes <= 0 || isNaN(totalMinutes)) return null;

    if (now < dayStart) return { percent: 0, status: "Not started", remaining: totalMinutes };
    if (now > dayEnd) return { percent: 100, status: "Done for the day", remaining: 0 };

    const percent = Math.max(0, Math.min(100, (elapsedMinutes / totalMinutes) * 100));
    const remaining = totalMinutes - elapsedMinutes;

    return { percent, status: "In progress", remaining };
  }, [day, schoolDay, now]);

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
