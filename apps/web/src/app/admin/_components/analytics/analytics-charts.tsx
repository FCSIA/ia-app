'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { ChartLine, Table2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Every analytics chart plots one series in `--chart-1`, the one theme color
 * that keeps at least 3:1 contrast against the card in all seven themes.
 * Breakdowns use one color per chart (bars, small multiples, tables) rather
 * than a categorical palette, which several themes can't support.
 */
const seriesColor = 'hsl(var(--chart-1))';

const countFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatCount = (value: number) => countFormat.format(value);
export const formatCompact = (value: number) => compactFormat.format(value);
export const formatPercent = (value: number) => percentFormat.format(value);
export const formatRatio = (part: number, whole: number) =>
  whole > 0 ? formatPercent(part / whole) : '—';

// Day keys are calendar dates; formatting them in UTC keeps the date as written.
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const formatDay = (day: string) => dayFormat.format(dayDate(day));
export const formatLongDay = (day: string) => longDayFormat.format(dayDate(day));

/**
 * Keep showing the last result while a new range loads, so charts hold their
 * frame instead of flashing empty on every range change.
 */
export function useStableValue<T>(value: T | undefined) {
  const [last, setLast] = useState(value);
  // Derived state, updated during render as React recommends.
  if (value !== undefined && value !== last) setLast(value);
  return { value: value ?? last, refreshing: value === undefined && last !== undefined };
}

export type ChartTableData = {
  columns: string[];
  rows: (string | number)[][];
};

/**
 * A titled chart with its table twin. Tooltips only enhance; every value in
 * the chart is also readable in the table, which a toggle swaps in.
 */
export function ChartBlock({
  title,
  description,
  table,
  empty,
  refreshing,
  className,
  children,
}: {
  title: string;
  description?: string;
  table: ChartTableData;
  empty?: string;
  refreshing?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const isEmpty = table.rows.length === 0;

  return (
    <section className={cn('flex min-w-0 flex-col gap-3 py-3', className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {isEmpty ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leadingIcon={showTable ? ChartLine : Table2}
            aria-label={`Show ${showTable ? 'chart' : 'table'} for ${title}`}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? 'Chart' : 'Table'}
          </Button>
        )}
      </div>
      <div className={cn('min-w-0 transition-opacity', refreshing && 'opacity-60')}>
        {isEmpty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{empty ?? 'No data in this range yet.'}</p>
        ) : showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                {table.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, index) => (
                <TableRow key={index} index={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className={cn(cellIndex > 0 && 'tabular-nums')}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function daysBetween(fromDay: string, toDay: string) {
  const days: string[] = [];
  for (let date = dayDate(fromDay); date <= dayDate(toDay); date.setUTCDate(date.getUTCDate() + 1)) {
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

/**
 * One measure over days: a 2px line over a 10% wash, with a crosshair tooltip.
 * The x-axis always spans the whole range, and uncounted days are left as a
 * gap, so a partly counted range never looks complete.
 */
export function DailyTrendChart<T extends { day: string }>({
  data,
  range,
  dataKey,
  label,
  format = formatCount,
}: {
  data: T[];
  range: { fromDay: string; toDay: string };
  dataKey: keyof T & string;
  label: string;
  format?: (value: number) => string;
}) {
  const config = { [dataKey]: { label, color: seriesColor } } satisfies ChartConfig;
  const byDay = new Map(data.map((row) => [row.day, row[dataKey]]));
  const points = daysBetween(range.fromDay, range.toDay).map((day) => ({
    day,
    [dataKey]: byDay.get(day) ?? null,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart accessibilityLayer data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={formatDay}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <ChartTooltip
          cursor={{ strokeWidth: 1 }}
          content={
            // "dot" keeps the date as the heading; the row draws its own line key.
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) => formatLongDay(String(payload?.[0]?.payload?.day ?? ''))}
              formatter={(value) => (
                <span className="flex w-full items-center gap-2">
                  <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: `var(--color-${dataKey})` }} />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
                    {value === null || value === undefined ? 'Not counted' : format(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Area
          dataKey={dataKey}
          // Straight segments: these are whole counts per day, and a smoothed
          // curve would suggest values between days that never happened.
          type="linear"
          connectNulls={false}
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          fill={`var(--color-${dataKey})`}
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export type BarItem = { label: string; value: number; display?: string };

/**
 * Named categories compared by length. Each row prints its name and value on
 * one line with the bar beneath, so it reads the same on a phone as on a wide
 * screen. One color for every bar, rounded only at the data end.
 */
export function BarListChart({
  data,
  label,
  format = formatCount,
  max,
}: {
  data: BarItem[];
  label: string;
  format?: (value: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(0, ...data.map((item) => item.value));

  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {data.map((item, index) => {
        const share = top > 0 ? Math.min(item.value / top, 1) : 0;
        return (
          <li key={`${item.label}-${index}`} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                {item.display ?? format(item.value)}
              </span>
            </div>
            <div
              aria-hidden
              className="mt-1.5 h-2 rounded-r-[4px] rounded-l-[1px]"
              style={{
                width: `${share * 100}%`,
                minWidth: item.value > 0 ? 2 : 0,
                background: seriesColor,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

// Sequential steps of the one series hue: more people, more ink.
const heatSteps = [0.16, 0.34, 0.54, 0.76, 0.96];

const heatFill = (step: number) =>
  step < 0 ? 'hsl(var(--muted))' : `hsl(var(--chart-1) / ${heatSteps[step]})`;

/**
 * A grid of magnitudes in one hue, light to dark, with a scale legend. Cells
 * describe themselves on hover; the table view carries every exact value.
 */
export function HeatmapChart({
  grid,
  rowLabels,
  columnLabels,
  showColumnLabel,
  describe,
  label,
}: {
  grid: number[][];
  rowLabels: string[];
  columnLabels: string[];
  showColumnLabel: (column: number) => boolean;
  describe: (row: number, column: number, value: number) => string;
  label: string;
}) {
  const max = Math.max(0, ...grid.flat());
  const stepFor = (value: number) =>
    value <= 0 || max <= 0 ? -1 : Math.min(heatSteps.length - 1, Math.floor((value / max) * heatSteps.length));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div
          role="img"
          aria-label={label}
          className="grid min-w-[560px] gap-[2px]"
          style={{ gridTemplateColumns: `2.75rem repeat(${columnLabels.length}, minmax(0, 1fr))` }}
        >
          <div />
          {columnLabels.map((columnLabel, column) => (
            <div key={columnLabel} className="pb-1 text-center text-[10px] tabular-nums text-muted-foreground">
              {showColumnLabel(column) ? columnLabel : ''}
            </div>
          ))}
          {grid.map((row, rowIndex) => (
            <Fragment key={rowLabels[rowIndex]}>
              <div className="pr-2 text-right text-[11px] leading-6 text-muted-foreground">{rowLabels[rowIndex]}</div>
              {row.map((value, column) => (
                <div
                  key={column}
                  title={describe(rowIndex, column, value)}
                  className="h-6 rounded-[3px] transition-shadow hover:ring-2 hover:ring-foreground/40"
                  style={{ background: heatFill(stepFor(value)) }}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div aria-hidden className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>Fewer</span>
        {heatSteps.map((_, step) => (
          <span key={step} className="size-3 rounded-[3px]" style={{ background: heatFill(step) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
