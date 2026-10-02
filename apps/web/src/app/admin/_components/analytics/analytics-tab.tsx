'use client';

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { NOTIFICATION_CATEGORY_DETAILS } from '@/components/notifications/notification-category-options';
import { AdminMetric, AdminNotice, AdminPanel } from '../admin-ui';
import {
  BarListChart,
  ChartBlock,
  DailyTrendChart,
  formatCount,
  formatDay,
  formatLongDay,
  formatPercent,
  formatRatio,
  useStableValue,
} from './analytics-charts';

const sections = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'communication', label: 'Chat & announcements' },
  { id: 'safety', label: 'Moderation' },
  { id: 'flex', label: 'Flex Friday' },
] as const;
type SectionId = (typeof sections)[number]['id'];

const rangeOptions = [30, 90, 180] as const;
const maxFillDays = 90;
// Matches the server's longest allowed range.
const maxRangeDays = 180;
const flexLookaheadDays = 21;

const platformLabels = { ios: 'iPhone & iPad', android: 'Android', desktop: 'Computers' } as const;

function schoolToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Range = { fromDay: string; toDay: string };

/** Daily rollups describe finished days, so ranges end yesterday. */
function rangeFor(days: number, today: string): Range {
  const toDay = shiftDay(today, -1);
  return { fromDay: shiftDay(toDay, -(days - 1)), toDay };
}

export function AnalyticsTab() {
  const [section, setSection] = useState<SectionId>('notifications');
  const [days, setDays] = useState<(typeof rangeOptions)[number]>(30);
  const today = useMemo(() => schoolToday(), []);
  const range = useMemo(() => rangeFor(days, today), [days, today]);
  const sectionIndex = sections.findIndex((item) => item.id === section);

  // One row above everything it scopes. It lives in the panel body rather than
  // the header so the section tabs can shrink and scroll on a phone.
  const toolbar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 max-w-full">
        <TabsSubtle
          selectedIndex={sectionIndex}
          onSelect={(index) => setSection(sections[index].id)}
          className="rounded-lg border border-border/70 bg-muted/30 px-1"
        >
          {sections.map((item, index) => (
            <TabsSubtleItem key={item.id} index={index} label={item.label} className="py-1.5" />
          ))}
        </TabsSubtle>
      </div>
      <Select value={String(days)} onValueChange={(value) => setDays(Number(value) as typeof days)}>
        <SelectTrigger className="w-full sm:w-[150px]" placeholder="Range" />
        <SelectContent>
          {rangeOptions.map((option, index) => (
            <SelectItem key={option} index={index} value={String(option)}>
              Last {option} days
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <AdminPanel title="Analytics" contentClassName="space-y-5">
      {toolbar}
      {section === 'notifications' ? <NotificationsSection range={range} today={today} /> : null}
      {section === 'communication' ? <CommunicationSection range={range} /> : null}
      {section === 'safety' ? <SafetySection range={range} /> : null}
      {section === 'flex' ? <FlexSection days={days} today={today} /> : null}
    </AdminPanel>
  );
}

/**
 * Shown when a range reaches back before analytics started. Days are counted
 * from the app's own records, so history can be filled in on request.
 */
function CoverageNotice({ coverage }: { coverage: { coveredDays: number; rangeDays: number } }) {
  const fillHistory = useMutation(api.analytics.dashboard.fillHistory);
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  if (coverage.coveredDays >= coverage.rangeDays) return null;

  const fillDays = Math.min(coverage.rangeDays, maxFillDays);
  const fill = async () => {
    setPending(true);
    try {
      const { days } = await fillHistory({ days: fillDays });
      toast({
        title:
          days > 0
            ? `Counting ${formatCount(days)} missing day${days === 1 ? '' : 's'}. Charts update as each one finishes.`
            : 'Every day in this range is already counted.',
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not fill in history.',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">
          {formatCount(coverage.coveredDays)} of {formatCount(coverage.rangeDays)} days counted
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Analytics count each day overnight. Earlier days can be counted from existing records
          {coverage.rangeDays > maxFillDays ? `, up to the last ${maxFillDays} days` : ''}.
        </p>
      </div>
      <Button type="button" variant="secondary" leadingIcon={History} loading={pending} onClick={() => void fill()}>
        Fill in history
      </Button>
    </div>
  );
}

function Loading() {
  return <AdminNotice message="Loading analytics…" />;
}

function NotificationsSection({ range, today }: { range: Range; today: string }) {
  const notifications = useStableValue(useQuery(api.analytics.dashboard.notifications, range));
  const push = useStableValue(
    useQuery(api.analytics.dashboard.pushHealth, { fromDay: range.fromDay, toDay: today }),
  );
  if (!notifications.value || !push.value) return <Loading />;

  const { series, categories, coverage } = notifications.value;
  const delivered = series.reduce((sum, row) => sum + row.delivered, 0);
  const read = series.reduce((sum, row) => sum + row.read, 0);
  const timing = categories.reduce(
    (sum, row) => ({
      within5m: sum.within5m + row.readWithin5m,
      within1h: sum.within1h + row.readWithin1h,
      within1d: sum.within1d + row.readWithin1d,
      later: sum.later + row.readLater,
    }),
    { within5m: 0, within1h: 0, within1d: 0, later: 0 },
  );
  const timed = timing.within5m + timing.within1h + timing.within1d + timing.later;
  const latest = push.value.latest;
  const platforms = latest?.data.platforms ?? [];
  const reachable = platforms.reduce((sum, row) => sum + row.reachable, 0);
  const lost = platforms.reduce((sum, row) => sum + row.lost, 0);
  const refreshing = notifications.refreshing || push.refreshing;

  const timingBars = [
    { label: 'Within 5 minutes', value: timing.within5m },
    { label: 'Within an hour', value: timing.within1h },
    { label: 'Within a day', value: timing.within1d },
    { label: 'Later', value: timing.later },
  ];

  return (
    <>
      <CoverageNotice coverage={coverage} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Delivered" value={formatCount(delivered)} detail={`${formatLongDay(range.fromDay)} onward`} />
        <AdminMetric label="Read" value={formatRatio(read, delivered)} detail={`${formatCount(read)} notifications`} />
        <AdminMetric
          label="Read within an hour"
          value={formatRatio(timing.within5m + timing.within1h, timed)}
          detail={timed > 0 ? `Of ${formatCount(timed)} reads with a recorded time` : 'Read times are recorded from now on'}
        />
        <AdminMetric
          label="Devices reachable by push"
          value={latest ? formatCount(reachable) : '—'}
          detail={latest ? `${formatCount(lost)} lost push without opting out` : 'Recorded nightly from now on'}
        />
      </div>

      <ChartBlock
        title="Notifications delivered per day"
        refreshing={refreshing}
        table={{
          columns: ['Day', 'Delivered', 'Read'],
          rows: series.map((row) => [formatLongDay(row.day), formatCount(row.delivered), formatRatio(row.read, row.delivered)]),
        }}
      >
        <DailyTrendChart range={range} data={series} dataKey="delivered" label="Delivered" />
      </ChartBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Read rate by category"
          description="Share of each kind of notification that was opened."
          refreshing={refreshing}
          table={{
            columns: ['Category', 'Delivered', 'Read'],
            rows: categories.map((row) => [
              NOTIFICATION_CATEGORY_DETAILS[row.category].label,
              formatCount(row.delivered),
              formatRatio(row.read, row.delivered),
            ]),
          }}
        >
          <BarListChart
            label="Read rate"
            format={formatPercent}
            max={1}
            data={categories.map((row) => ({
              label: NOTIFICATION_CATEGORY_DETAILS[row.category].label,
              value: row.delivered > 0 ? row.read / row.delivered : 0,
              display: `${formatRatio(row.read, row.delivered)} of ${formatCount(row.delivered)}`,
            }))}
          />
        </ChartBlock>

        <ChartBlock
          title="Time to first read"
          description="Counted only for reads recorded after read times were tracked."
          refreshing={refreshing}
          empty="No timed reads yet. They appear as people open notifications."
          table={{
            columns: ['Read', 'Notifications'],
            rows: timed > 0 ? timingBars.map((row) => [row.label, formatCount(row.value)]) : [],
          }}
        >
          <BarListChart label="Notifications" data={timingBars} />
        </ChartBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Push reach by platform"
          description={latest ? `Devices seen in the 30 days before ${formatLongDay(latest.day)}.` : undefined}
          refreshing={refreshing}
          empty="The first push reading is taken overnight."
          table={{
            columns: ['Platform', 'Reachable', 'Lost push', 'Not turned on', 'Blocked', 'Unsupported'],
            rows: platforms.map((row) => [
              platformLabels[row.platform],
              formatCount(row.reachable),
              formatCount(row.lost),
              formatCount(row.notEnabled),
              formatCount(row.blocked),
              formatCount(row.unsupported),
            ]),
          }}
        >
          <BarListChart
            label="Reachable"
            format={formatPercent}
            max={1}
            data={platforms.map((row) => {
              const total = row.reachable + row.lost + row.notEnabled + row.blocked + row.unsupported;
              return {
                label: platformLabels[row.platform],
                value: total > 0 ? row.reachable / total : 0,
                display: `${formatRatio(row.reachable, total)} of ${formatCount(total)}`,
              };
            })}
          />
        </ChartBlock>

        <ChartBlock
          title="Devices that silently lost push"
          description="Had push, can no longer receive it, and never turned it off."
          refreshing={refreshing}
          empty="Recorded once a night from now on."
          table={{
            columns: ['Day', 'Lost push', 'Reachable', 'Unclaimed endpoints'],
            rows: push.value.series.map((row) => [
              formatLongDay(row.day),
              formatCount(row.lost),
              formatCount(row.reachable),
              formatCount(row.unclaimed),
            ]),
          }}
        >
          <DailyTrendChart range={{ fromDay: range.fromDay, toDay: today }} data={push.value.series} dataKey="lost" label="Lost push" />
        </ChartBlock>
      </div>
    </>
  );
}

function CommunicationSection({ range }: { range: Range }) {
  const result = useStableValue(useQuery(api.analytics.dashboard.communication, range));
  if (!result.value) return <Loading />;

  const { series, topClubs, announcements, coverage } = result.value;
  const messages = series.reduce((sum, row) => sum + row.messages, 0);
  const replies = series.reduce((sum, row) => sum + row.threadReplies, 0);
  const averageChatters =
    series.length > 0 ? Math.round(series.reduce((sum, row) => sum + row.activeAuthors, 0) / series.length) : 0;
  const readers = announcements.map((row) => row.readersIn24h).sort((a, b) => a - b);
  const medianReaders = readers.length > 0 ? readers[Math.floor(readers.length / 2)] : null;
  const announcementReach = (row: (typeof announcements)[number]) =>
    row.audience ? `${formatCount(row.readersIn24h)} · ${formatRatio(row.readersIn24h, row.audience)} of accounts` : formatCount(row.readersIn24h);

  return (
    <>
      <CoverageNotice coverage={coverage} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Messages" value={formatCount(messages)} detail={`${formatRatio(replies, messages)} in threads`} />
        <AdminMetric label="Chatters on a typical day" value={formatCount(averageChatters)} detail="Average people posting per day" />
        <AdminMetric label="Announcements" value={formatCount(announcements.length)} detail="Published in this range" />
        <AdminMetric
          label="Typical first-day readers"
          value={medianReaders === null ? '—' : formatCount(medianReaders)}
          detail="Median readers in an announcement's first 24 hours"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Messages per day"
          refreshing={result.refreshing}
          table={{
            columns: ['Day', 'Messages', 'Thread replies'],
            rows: series.map((row) => [formatLongDay(row.day), formatCount(row.messages), formatCount(row.threadReplies)]),
          }}
        >
          <DailyTrendChart range={range} data={series} dataKey="messages" label="Messages" />
        </ChartBlock>
        <ChartBlock
          title="People chatting per day"
          refreshing={result.refreshing}
          table={{
            columns: ['Day', 'People who posted'],
            rows: series.map((row) => [formatLongDay(row.day), formatCount(row.activeAuthors)]),
          }}
        >
          <DailyTrendChart range={range} data={series} dataKey="activeAuthors" label="People who posted" />
        </ChartBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Most active clubs"
          refreshing={result.refreshing}
          table={{
            columns: ['Club', 'Messages'],
            rows: topClubs.map((row) => [row.name, formatCount(row.messages)]),
          }}
        >
          <BarListChart label="Messages" data={topClubs.map((row) => ({ label: row.name, value: row.messages }))} />
        </ChartBlock>
        <ChartBlock
          title="Announcement readers in the first 24 hours"
          description="Most recent first. School-wide posts also show the share of accounts reached."
          refreshing={result.refreshing}
          table={{
            columns: ['Announcement', 'Published', 'Readers in 24 hours'],
            rows: announcements.map((row) => [row.title, formatLongDay(row.day), announcementReach(row)]),
          }}
        >
          <BarListChart
            label="Readers"
            data={announcements.slice(0, 8).map((row) => ({
              label: `${row.title} · ${formatDay(row.day)}`,
              value: row.readersIn24h,
              display: announcementReach(row),
            }))}
          />
        </ChartBlock>
      </div>
    </>
  );
}

function SafetySection({ range }: { range: Range }) {
  const result = useStableValue(useQuery(api.analytics.dashboard.safety, range));
  if (!result.value) return <Loading />;

  const { series, backlog, reviewTimes, coverage } = result.value;
  const opened = series.reduce((sum, row) => sum + row.opened, 0);
  const resolved = series.reduce((sum, row) => sum + row.resolved, 0);
  const dismissed = series.reduce((sum, row) => sum + row.dismissed, 0);
  const reviewedSeries = series.map((row) => ({ day: row.day, reviewed: row.resolved + row.dismissed }));
  const reviewBars = [
    { label: 'Within a day', value: reviewTimes.within1d },
    { label: 'Within 3 days', value: reviewTimes.within3d },
    { label: 'Within a week', value: reviewTimes.within7d },
    { label: 'Longer', value: reviewTimes.later },
  ];
  const reviewed = reviewBars.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <CoverageNotice coverage={coverage} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Reports opened" value={formatCount(opened)} detail={`${formatCount(series.reduce((sum, row) => sum + row.escalated, 0))} escalated`} />
        <AdminMetric label="Resolved" value={formatCount(resolved)} />
        <AdminMetric label="Dismissed" value={formatCount(dismissed)} />
        <AdminMetric
          label="Waiting for review"
          value={backlog ? formatCount(backlog.reports) : '—'}
          detail={backlog ? `As of the night of ${formatLongDay(backlog.day)}` : 'Recorded nightly from now on'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBlock
          title="Reports opened per day"
          refreshing={result.refreshing}
          table={{
            columns: ['Day', 'Opened', 'Escalated'],
            rows: series.map((row) => [formatLongDay(row.day), formatCount(row.opened), formatCount(row.escalated)]),
          }}
        >
          <DailyTrendChart range={range} data={series} dataKey="opened" label="Opened" />
        </ChartBlock>
        <ChartBlock
          title="Reports reviewed per day"
          refreshing={result.refreshing}
          table={{
            columns: ['Day', 'Resolved', 'Dismissed'],
            rows: series.map((row) => [formatLongDay(row.day), formatCount(row.resolved), formatCount(row.dismissed)]),
          }}
        >
          <DailyTrendChart range={range} data={reviewedSeries} dataKey="reviewed" label="Reviewed" />
        </ChartBlock>
      </div>

      <ChartBlock
        title="Time from report to review"
        refreshing={result.refreshing}
        empty="No reports were reviewed in this range."
        table={{
          columns: ['Reviewed', 'Reports'],
          rows: reviewed > 0 ? reviewBars.map((row) => [row.label, formatCount(row.value)]) : [],
        }}
      >
        <BarListChart label="Reports" data={reviewBars} />
      </ChartBlock>
    </>
  );
}

function FlexSection({ days, today }: { days: number; today: string }) {
  // Upcoming Fridays matter most, so the range reaches three weeks ahead.
  const range = useMemo(
    () => ({
      fromDay: shiftDay(today, -Math.min(days, maxRangeDays - flexLookaheadDays)),
      toDay: shiftDay(today, flexLookaheadDays - 1),
    }),
    [days, today],
  );
  const result = useStableValue(useQuery(api.analytics.dashboard.flex, range));
  if (!result.value) return <Loading />;

  const fridays = result.value;
  const capacity = fridays.reduce((sum, row) => sum + row.capacity, 0);
  const registeredInCapped = fridays.reduce((sum, row) => sum + row.registeredInCapped, 0);
  const label = (day: string) => `${formatDay(day)}${day >= today ? ' (upcoming)' : ''}`;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Flex Fridays" value={formatCount(fridays.length)} detail="In range, including the next three weeks" />
        <AdminMetric label="Seats filled" value={formatRatio(registeredInCapped, capacity)} detail="Across workshops with a capacity" />
        <AdminMetric label="Full workshops" value={formatCount(fridays.reduce((sum, row) => sum + row.fullWorkshops, 0))} />
        <AdminMetric
          label="Workshops without a cap"
          value={formatCount(fridays.reduce((sum, row) => sum + row.uncappedWorkshops, 0))}
          detail="Not included in fill rates"
        />
      </div>
      <ChartBlock
        title="Fill rate by Flex Friday"
        description="Registrations against capacity, refreshed nightly until each Friday."
        refreshing={result.refreshing}
        empty="No Flex Fridays have been counted in this range yet."
        table={{
          columns: ['Friday', 'Workshops', 'Registered', 'Capacity', 'Filled', 'Full workshops'],
          rows: fridays.map((row) => [
            formatLongDay(row.day),
            formatCount(row.workshops),
            formatCount(row.registered),
            formatCount(row.capacity),
            formatRatio(row.registeredInCapped, row.capacity),
            formatCount(row.fullWorkshops),
          ]),
        }}
      >
        <BarListChart
          label="Filled"
          format={formatPercent}
          max={1}
          data={fridays.map((row) => ({
            label: label(row.day),
            value: row.capacity > 0 ? Math.min(row.registeredInCapped / row.capacity, 1) : 0,
            display: `${formatRatio(row.registeredInCapped, row.capacity)} · ${formatCount(row.registeredInCapped)} of ${formatCount(row.capacity)}`,
          }))}
        />
      </ChartBlock>
    </>
  );
}
