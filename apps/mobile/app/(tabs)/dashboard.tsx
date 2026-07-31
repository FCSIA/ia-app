import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { format, differenceInMinutes } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  Timer,
} from "lucide-react-native";
import { pickNavigationLoadingMessage } from "@ia/fun-facts";
import { AppHeader } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { FeedScreen } from "@/components/screen";
import {
  CompactList,
  CompactListItem,
  CompactListSectionHeader,
  type CompactListItemState,
} from "@/components/ui/compact-list";
import { Inline, Stack } from "@/components/ui/layout";
import {
  Badge,
  Card,
  IconButton,
  PressableScale,
  Progress,
  ScreenLoader,
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
import { spacing } from "@/lib/tokens";
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
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const calendarWindow = useMemo(() => {
    const startDate = Date.now();
    return { startDate, endDate: startDate + 30 * 24 * 60 * 60 * 1000 };
  }, []);
  const schedule = useQuery(api.schedule.dashboard.get, EMPTY_ARGS);
  const announcements = useQuery(
    api.announcements.feed.list,
    UNREAD_ANNOUNCEMENTS_ARGS,
  );
  const calendarEntries = useQuery(api.events.calendar.list, calendarWindow);
  const flexFridays = useQuery(api.flexFriday.fridays.list, EMPTY_ARGS);
  const nextFlexFriday = resolveNextFlexFriday(flexFridays ?? []);

  return (
    <FeedScreen
      header={
        <AppHeader title={user.firstName ? `Hi, ${user.firstName}` : "Home"} />
      }
    >
      {schedule === undefined ? (
        <DashboardSection title="School day">
          <HomeSkeleton />
        </DashboardSection>
      ) : (
        <Stack gap="sm">
          <WelcomeWidget
            user={user}
            schedule={schedule}
            schoolDay={schoolDay}
          />
          <DayProgressWidget schedule={schedule} schoolDay={schoolDay} />
        </Stack>
      )}

      <Stack gap="md">
        <DashboardSection
          title="Announcements"
          action={
            <SectionLink
              label="Open feed"
              onPress={() => router.push("/announcements" as never)}
            />
          }
        >
          {announcements === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeList>
              {announcements.length ? (
                announcements
                  .slice(0, 3)
                  .map((item: any) => (
                    <HomeRow
                      key={item._id}
                      state="unread"
                      title={item.title}
                      subtitle={item.body}
                      onPress={() =>
                        router.push(`/announcements/${item._id}` as never)
                      }
                    />
                  ))
              ) : (
                <HomeEmpty text="You’re caught up." />
              )}
            </HomeList>
          )}
        </DashboardSection>

        <DashboardSection
          title="Coming up"
          action={
            <SectionLink
              label="Open calendar"
              onPress={() => router.push("/calendar" as never)}
            />
          }
        >
          {calendarEntries === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeList>
              {calendarEntries.length ? (
                calendarEntries
                  .slice(0, 4)
                  .map((entry: any) => (
                    <HomeRow
                      key={entry._id}
                      title={entry.title}
                      subtitle={entry.location}
                      meta={`${shortDate(entry.startAt)} · ${timeRange(entry.startAt)}`}
                      onPress={() =>
                        entry.eventId
                          ? router.push(`/events/${entry.eventId}` as never)
                          : router.push("/calendar" as never)
                      }
                    />
                  ))
              ) : (
                <HomeEmpty text="Nothing coming up." />
              )}
            </HomeList>
          )}
        </DashboardSection>

        <DashboardSection
          title="Flex Friday"
          action={
            <SectionLink
              label="Open Flex"
              onPress={() => router.push("/flex-friday" as never)}
            />
          }
        >
          {flexFridays === undefined ? (
            <HomeSkeleton />
          ) : (
            <HomeList>
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
            </HomeList>
          )}
        </DashboardSection>
      </Stack>
    </FeedScreen>
  );
}

function StudentDashboardScreen({ user }: { user: AppUser }) {
  const schoolDay = useMemo(getDashboardSchoolDay, []);
  const calendarWindow = useMemo(() => {
    const startDate = Date.now();
    return { startDate, endDate: startDate + 30 * 24 * 60 * 60 * 1000 };
  }, []);
  const announcements = useQuery(
    api.announcements.feed.list,
    UNREAD_ANNOUNCEMENTS_ARGS,
  );
  const liveSchedule = useQuery(api.schedule.dashboard.get, EMPTY_ARGS);
  const calendarEntries = useQuery(api.events.calendar.list, calendarWindow);
  const myClubs = useQuery(api.clubs.management.getMyClubs, EMPTY_ARGS);
  const flexCredits = useQuery(api.flexFriday.credits.getMyCredits, EMPTY_ARGS);
  const registrations = useQuery(
    api.flexFriday.registration.getMyRegistrations,
    EMPTY_ARGS,
  );
  const schedule = useOfflineValue("dashboard-schedule", liveSchedule);
  const [funFact, setFunFact] = useState(pickNavigationLoadingMessage);
  const [layout, setLayout] = useState<DashboardWidgetId[]>([
    ...DEFAULT_DASHBOARD_WIDGETS,
  ]);

  useEffect(() => {
    const resolved = resolveDashboardLayout(user.dashboardLayout);
    setLayout((current) =>
      dashboardLayoutsEqual(current, resolved) ? current : resolved,
    );
  }, [user?.dashboardLayout]);

  function renderWidget(id: DashboardWidgetId) {
    if (id === "schedule") {
      return (
        <DashboardSection
          key={id}
          title={schoolDay.isToday ? "Today" : schoolDay.label}
          action={
            <SectionLink
              label="View week"
              onPress={() => router.push("/calendar" as never)}
            />
          }
        >
          {schedule.value === undefined ? (
            <HomeSkeleton count={4} />
          ) : schedule.value === null ? (
            <HomeList>
              <HomeEmpty text="No schedule saved." />
            </HomeList>
          ) : (
            <ScheduleSummary data={schedule.value} schoolDay={schoolDay} />
          )}
        </DashboardSection>
      );
    }

    if (id === "announcements") {
      return (
        <DashboardSection
          key={id}
          title="Announcements"
          action={
            <SectionLink
              label="Open feed"
              onPress={() => router.push("/announcements" as never)}
            />
          }
        >
          {announcements === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeList>
              {announcements.length ? (
                announcements
                  .slice(0, 3)
                  .map((item: any) => (
                    <HomeRow
                      key={item._id}
                      state="unread"
                      title={item.title}
                      subtitle={item.body}
                      onPress={() =>
                        router.push(`/announcements/${item._id}` as never)
                      }
                    />
                  ))
              ) : (
                <HomeEmpty text="You’re caught up." />
              )}
            </HomeList>
          )}
        </DashboardSection>
      );
    }

    if (id === "calendar") {
      return (
        <DashboardSection
          key={id}
          title="Coming up"
          action={
            <SectionLink
              label="Open calendar"
              onPress={() => router.push("/calendar" as never)}
            />
          }
        >
          {calendarEntries === undefined ? (
            <HomeSkeleton count={3} />
          ) : (
            <HomeList>
              {calendarEntries.length ? (
                calendarEntries
                  .slice(0, 4)
                  .map((entry: any) => (
                    <HomeRow
                      key={entry._id}
                      title={entry.title}
                      subtitle={entry.location}
                      meta={`${shortDate(entry.startAt)} · ${timeRange(entry.startAt)}`}
                      onPress={() =>
                        entry.eventId
                          ? router.push(`/events/${entry.eventId}` as never)
                          : router.push("/calendar" as never)
                      }
                    />
                  ))
              ) : (
                <HomeEmpty text="Nothing coming up." />
              )}
            </HomeList>
          )}
        </DashboardSection>
      );
    }

    if (id === "flex") {
      const summary =
        flexCredits === undefined || registrations === undefined
          ? undefined
          : {
              credits: flexCredits?.earned ?? 0,
              registrations: registrations.length,
            };
      return (
        <DashboardSection
          key={id}
          title="Flex Friday"
          action={
            <SectionLink
              label="Open Flex"
              onPress={() => router.push("/flex-friday" as never)}
            />
          }
        >
          {summary === undefined ? (
            <HomeSkeleton />
          ) : (
            <HomeList>
              <HomeRow
                title={`${summary.credits} credit${summary.credits === 1 ? "" : "s"}`}
                subtitle={`${summary.registrations} registration${summary.registrations === 1 ? "" : "s"}`}
                onPress={() => router.push("/flex-friday" as never)}
              />
            </HomeList>
          )}
        </DashboardSection>
      );
    }

    if (id === "clubs") {
      const memberships =
        myClubs === undefined
          ? undefined
          : [
              ...(myClubs.memberOf ?? []),
              ...(myClubs.sponsoring ?? []).map((club: any) => ({
                ...club,
                role: club.role ?? "SPONSOR",
              })),
            ]
              .filter(
                (club: any, index: number, clubs: any[]) =>
                  clubs.findIndex((item) => item._id === club._id) === index,
              )
              .slice(0, 4);
      return (
        <DashboardSection
          key={id}
          title="Clubs"
          action={
            <SectionLink
              label="Open clubs"
              onPress={() => router.push("/clubs" as never)}
            />
          }
        >
          {memberships === undefined ? (
            <HomeSkeleton count={2} />
          ) : (
            <HomeList>
              {memberships.length ? (
                memberships.map((club: any) => (
                  <HomeRow
                    key={club._id}
                    title={club.name}
                    subtitle={club.role ? formatRole(club.role) : undefined}
                    onPress={() => router.push(`/clubs/${club._id}` as never)}
                  />
                ))
              ) : (
                <HomeEmpty text="No clubs yet." />
              )}
            </HomeList>
          )}
        </DashboardSection>
      );
    }

    return (
      <DashboardSection
        key={id}
        title="Fun fact"
        action={
          <IconButton
            icon={RefreshCw}
            label="Show another fun fact"
            size="xs"
            variant="ghost"
            onPress={() => setFunFact(pickNavigationLoadingMessage())}
          />
        }
      >
        <CompactList density="compact">
          <CompactListItem title={funFact} titleNumberOfLines={3} />
        </CompactList>
      </DashboardSection>
    );
  }

  return (
    <FeedScreen
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
      {schedule.isOffline || schedule.isStale ? (
        <OfflineBanner stale={schedule.isStale} />
      ) : null}
      <Stack gap="sm">
        <WelcomeWidget
          user={user}
          schedule={schedule.value}
          schoolDay={schoolDay}
        />
        <DayProgressWidget schedule={schedule.value} schoolDay={schoolDay} />
      </Stack>
      {layout.length ? (
        <Stack gap="md">{layout.map((id) => renderWidget(id))}</Stack>
      ) : (
        <HomeEmpty text="No sections shown." />
      )}
    </FeedScreen>
  );
}

function ScheduleSummary({
  data,
  schoolDay,
}: {
  data: any;
  schoolDay: DashboardSchoolDay;
}) {
  const entries = (data?.mySchedule?.entries ?? [])
    .filter((entry: any) => entry.weekday === schoolDay.value)
    .sort((left: any, right: any) => left.periodNumber - right.periodNumber);
  const blocks = (data?.blocks ?? []).filter(
    (block: any) => block.weekday === schoolDay.value,
  );

  return (
    <HomeList>
      {entries.length ? (
        entries.map((entry: any) => {
          const block = blocks.find(
            (item: any) => item.periodNumber === entry.periodNumber,
          );
          const isCurrent = isCurrentBlock(block, schoolDay.isToday);
          return (
            <HomeRow
              key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`}
              leading={
                <PeriodBadge
                  periodNumber={entry.periodNumber}
                  emphasized={isCurrent}
                />
              }
              title={entry.className}
              meta={block ? formatSchoolTime(block.startTime) : undefined}
              accessibilityLabel={
                entry.course?.slug
                  ? `Period ${entry.periodNumber}, ${entry.className}. Open course details`
                  : undefined
              }
              onPress={
                entry.course?.slug
                  ? () => router.push(`/courses/${entry.course.slug}` as never)
                  : undefined
              }
            />
          );
        })
      ) : (
        <HomeEmpty
          text={
            data?.mySchedule ? "No classes this day." : "No schedule saved."
          }
        />
      )}
    </HomeList>
  );
}

function DashboardSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <CompactListSectionHeader
        title={title}
        action={action}
        density="compact"
        style={action ? { minHeight: 44 } : undefined}
      />
      {children}
    </View>
  );
}

function SectionLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={{ height: 32, justifyContent: "center", paddingLeft: spacing.sm }}
    >
      <Txt variant="label" tone="primary">
        {label}
      </Txt>
    </PressableScale>
  );
}

function HomeList({ children }: { children: ReactNode }) {
  return (
    <CompactList density="compact" separation="full">
      {children}
    </CompactList>
  );
}

function HomeRow({
  title,
  subtitle,
  meta,
  leading,
  state,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  state?: CompactListItemState;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { color } = useTheme();
  return (
    <CompactListItem
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? "link" : undefined}
      leading={leading}
      onPress={onPress}
      state={state}
      title={title}
      detail={subtitle}
      trailing={
        meta || onPress ? (
          <Inline gap="xs" style={{ maxWidth: meta ? "44%" : undefined }}>
            {meta ? (
              <Txt variant="caption" tone="muted" numberOfLines={1}>
                {meta}
              </Txt>
            ) : null}
            {onPress ? (
              <ChevronRight size={16} color={color("mutedForeground")} />
            ) : null}
          </Inline>
        ) : undefined
      }
    />
  );
}

function HomeEmpty({ text }: { text: string }) {
  return (
    <View
      style={{
        minHeight: 40,
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Txt tone="muted">{text}</Txt>
    </View>
  );
}

function HomeSkeleton({ count = 1 }: { count?: number }) {
  return (
    <CompactList density="compact" separation="full">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            minHeight: 40,
            justifyContent: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          }}
        >
          <Skeleton style={{ width: index % 2 ? "48%" : "62%", height: 14 }} />
          {count > 1 ? <Skeleton style={{ width: "78%", height: 10 }} /> : null}
        </View>
      ))}
    </CompactList>
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
  if (today >= 1 && today <= 5)
    return { ...weekdays[today - 1], isToday: true };
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
) {
  if (!block || !isToday) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (
    minutes >= timeToMinutes(block.startTime) &&
    minutes < timeToMinutes(block.endTime)
  );
}

function timeToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function resolveSchoolDayStatus(blocks: any[], schoolDay: DashboardSchoolDay) {
  const dayBlocks = blocks
    .filter((block) => block.weekday === schoolDay.value)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const current = dayBlocks.find((block) =>
    isCurrentBlock(block, schoolDay.isToday),
  );

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
      subtitle: schoolDay.isToday
        ? "Next today"
        : `Next school day · ${schoolDay.label}`,
      meta: `${formatSchoolTime(next.startTime)}–${formatSchoolTime(next.endTime)}`,
    };
  }

  return {
    title: dayBlocks.length
      ? "School day complete"
      : `No ${schoolDay.label} blocks`,
    subtitle: dayBlocks.length
      ? "No more scheduled blocks today."
      : "The school-day schedule is not configured.",
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
  return role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function WelcomeWidget({
  user,
  schedule,
  schoolDay,
}: {
  user: AppUser;
  schedule: any;
  schoolDay: DashboardSchoolDay;
}) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const schoolStatus = useMemo(
    () => resolveSchoolDayStatus(schedule?.blocks ?? [], schoolDay),
    [schedule?.blocks, schoolDay],
  );

  const firstName = user?.firstName ?? "";
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Card variant="flat" style={{ padding: spacing.lg, gap: spacing.md }}>
      <Inline
        distribution="between"
        align="start"
        wrap="wrap"
        style={{ columnGap: spacing.lg, rowGap: spacing.sm }}
      >
        <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
          <Txt variant="caption" tone="muted">
            {format(now, "EEEE, MMM d")}
          </Txt>
          <Txt variant="title">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </Txt>
        </Stack>
        <Inline gap="xs">
          <Clock size={17} color={color("primary")} />
          <Txt
            style={{
              fontSize: 25,
              fontWeight: "800",
              lineHeight: 29,
              fontVariant: ["tabular-nums"],
            }}
          >
            {format(now, "h:mm")}
          </Txt>
        </Inline>
      </Inline>

      <Inline distribution="between" align="end" gap="md">
        <Stack gap="none" style={{ minWidth: 0, flex: 1 }}>
          <Txt variant="overline" tone="muted">
            Current status
          </Txt>
          <Txt variant="body" numberOfLines={1} style={{ fontWeight: "700" }}>
            {schoolStatus.title}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {schoolStatus.meta ?? schoolStatus.subtitle}
          </Txt>
        </Stack>
        {schoolStatus.subtitle === "In progress" ? (
          <Badge label="Active" color="green" />
        ) : null}
      </Inline>
    </Card>
  );
}

function DayProgressWidget({
  schedule,
  schoolDay,
}: {
  schedule: any;
  schoolDay: DashboardSchoolDay;
}) {
  const { color } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => {
    if (!schedule?.blocks || schedule.blocks.length === 0) return null;
    if (!schoolDay.isToday) return null;

    const blocks = schedule.blocks.filter(
      (b: any) => b.weekday === schoolDay.value,
    );
    if (blocks.length === 0) return null;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    const startTimes = blocks
      .map((b: any) => new Date(`${todayStr}T${b.startTime}:00`))
      .filter((d: any) => !isNaN(d.getTime()));
    const endTimes = blocks
      .map((b: any) => new Date(`${todayStr}T${b.endTime}:00`))
      .filter((d: any) => !isNaN(d.getTime()));

    if (startTimes.length === 0 || endTimes.length === 0) return null;

    const dayStart = new Date(
      Math.min(...startTimes.map((d: any) => d.getTime())),
    );
    const dayEnd = new Date(Math.max(...endTimes.map((d: any) => d.getTime())));

    const totalMinutes = differenceInMinutes(dayEnd, dayStart);
    const elapsedMinutes = differenceInMinutes(now, dayStart);

    if (totalMinutes <= 0 || isNaN(totalMinutes)) return null;

    if (now < dayStart)
      return { percent: 0, status: "Not started", remaining: totalMinutes };
    if (now > dayEnd)
      return { percent: 100, status: "Done for the day", remaining: 0 };

    const percent = Math.max(
      0,
      Math.min(100, (elapsedMinutes / totalMinutes) * 100),
    );
    const remaining = totalMinutes - elapsedMinutes;

    return { percent, status: "In progress", remaining };
  }, [schedule?.blocks, schoolDay, now]);

  if (!progress) return null;

  return (
    <View
      style={{
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Inline distribution="between">
        <Inline gap="sm">
          <Timer size={18} color={color("mutedForeground")} />
          <Txt variant="label">Day progress</Txt>
        </Inline>
        <Inline gap="xs">
          {progress.percent >= 100 ? (
            <CheckCircle2 size={18} color={color("primary")} />
          ) : null}
          <Txt
            style={{
              fontSize: 18,
              fontWeight: "800",
              lineHeight: 22,
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.round(progress.percent)}%
          </Txt>
        </Inline>
      </Inline>
      <Progress value={progress.percent} height={5} />
      <Txt variant="caption" tone="muted">
        {progress.percent >= 100
          ? "School day complete"
          : `${progress.remaining} mins remaining`}
      </Txt>
    </View>
  );
}
