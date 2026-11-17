'use client';

import { useState } from 'react';
import { activityCells, type DailyActivity } from './activity-heatmap-utils';

/** Native disclosure provides a keyboard-accessible exact-value alternative. */
export function ActivityHeatmap({ start, end, activity }: { start: string; end: string; activity: readonly DailyActivity[] }) {
  const cells = activityCells(start, end, activity);
  const [selected, setSelected] = useState<string | null>(null);
  const leadingDays = cells.length ? new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() : 0;
  const maximum = Math.max(1, ...cells.map((cell) => cell.messages));
  const active = cells.filter((cell) => cell.messages > 0);
  if (!cells.length) return <p>Activity dates are unavailable.</p>;
  return <figure className="w-full min-w-0 text-sm">
    <figcaption>{start} through {end} · {active.length} active {active.length === 1 ? 'day' : 'days'}</figcaption>
    <div aria-hidden="true" className="mt-3 grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${Math.ceil((leadingDays + cells.length) / 7)}, minmax(0, 1fr))` }}>
      {Array.from({ length: leadingDays }, (_, index) => <span key={`padding-${index}`} />)}
      {cells.map(({ date, messages }) => <span key={date} title={`${date}: ${messages} messages`} className="aspect-square border border-current" style={{ opacity: messages === 0 ? 0.15 : 0.4 + 0.6 * messages / maximum, backgroundColor: messages ? 'currentColor' : 'transparent' }} />)}
    </div>
    {active.length === 0 && <p className="mt-2">No messages recorded in this date range.</p>}
    <details className="mt-3" onToggle={(event) => { if (!event.currentTarget.open) setSelected(null); }}>
      <summary className="cursor-pointer">Explore exact daily message counts</summary>
      <label className="mt-2 block">Date <select className="max-w-full bg-background text-foreground" value={selected ?? cells[0].date} onChange={(event) => setSelected(event.target.value)}>{cells.map(({ date }) => <option key={date} value={date}>{date}</option>)}</select></label>
      <p aria-live="polite">{selected ?? cells[0].date}: {cells.find((cell) => cell.date === selected)?.messages ?? cells[0].messages} messages</p>
    </details>
  </figure>;
}
