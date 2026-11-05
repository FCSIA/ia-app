'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Star, X } from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import {
  parseRouteLink,
  readClassRooms,
  rememberClassRooms,
} from '@/features/route-finder/class-rooms';
import { NavigationMap } from '@/features/route-finder/navigation-map';
import { RoomPicker, type RoomChoice } from '@/features/route-finder/room-picker';
import { findPath, type RouteResult } from '@/features/route-finder/router';
import {
  RECENT_ROUTES_KEY,
  SAVED_ROUTES_KEY,
  readRouteList,
  routeEntryKey,
  withRecent,
  withSavedToggled,
  writeRouteList,
  type RouteEntry,
} from '@/features/route-finder/saved-routes';

const START_COLOR = '#16a34a';
const END_COLOR = '#dc2626';

const entryLabel = (r: RouteEntry) => `${r.fromKey} → ${r.toKey}`;

function RoomField({
  id,
  label,
  color,
  value,
  onChange,
}: {
  id: string;
  label: string;
  color: string;
  value: RoomChoice | null;
  onChange: (value: RoomChoice) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <label htmlFor={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        {label}
      </label>
      <RoomPicker id={id} value={value} onChange={onChange} placeholder="Search any room" />
    </div>
  );
}

function QuickRoutes({
  title,
  routes,
  onRun,
  onRemove,
}: {
  title: string;
  routes: RouteEntry[];
  onRun: (r: RouteEntry) => void;
  onRemove?: (r: RouteEntry) => void;
}) {
  if (routes.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={`${title} routes`}>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {routes.map((r) => (
          <div key={routeEntryKey(r)} className="flex items-center gap-0.5">
            <Button type="button" variant="secondary" size="sm" onClick={() => onRun(r)}>
              {entryLabel(r)}
            </Button>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-compact"
                aria-label={`Remove saved route ${entryLabel(r)}`}
                onClick={() => onRemove(r)}
              >
                <X />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RouteFinderPage() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState<RoomChoice | null>(null);
  const [to, setTo] = useState<RoomChoice | null>(null);
  const [recents, setRecents] = useState<RouteEntry[]>([]);
  const [saved, setSaved] = useState<RouteEntry[]>([]);
  // The rooms the shown route was found for, so "Save route" saves that route
  // even after the pickers change.
  const [routeEntry, setRouteEntry] = useState<RouteEntry | null>(null);
  // The classes this page was opened for, and whether the student is choosing
  // their rooms; "Find route" remembers those choices.
  const [classes, setClasses] = useState<{ from: string | null; to: string | null } | null>(null);
  const [choosingRooms, setChoosingRooms] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecents(readRouteList(RECENT_ROUTES_KEY));
    setSaved(readRouteList(SAVED_ROUTES_KEY));

    // A link from Home names rooms or classes. With both rooms known the route
    // opens straight away; otherwise the student says which rooms are missing.
    const link = parseRouteLink(window.location.search, readClassRooms());
    if (link.from.room) setFrom(link.from.room);
    if (link.to.room) setTo(link.to.room);
    if (link.from.className || link.to.className) {
      setClasses({ from: link.from.className, to: link.to.className });
    }
    if (!link.from.room || !link.to.room) {
      setChoosingRooms(!!(link.from.className || link.to.className));
    } else if (link.from.room.room === link.to.room.room && link.from.room.floor === link.to.room.floor) {
      setError('Both classes are in the same room, so you are already there.');
    } else {
      findRoomRoute({
        fromFloor: link.from.room.floor,
        fromKey: link.from.room.room,
        toFloor: link.to.room.floor,
        toKey: link.to.room.room,
      });
    }
    // Runs once, for the link this page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findRoomRoute(entry: RouteEntry) {
    const result = findPath(entry.fromKey, entry.fromFloor, entry.toKey, entry.toFloor);
    // A route with fewer than two waypoints can't be drawn; treat it as the
    // failure it is instead of showing "Route Found" over a blank map.
    if (result.error || result.path1.length < 2) {
      setRoute(null);
      setRouteEntry(null);
      setError('No walkable route could be found between those two locations. Please pick a different start or destination.');
      return;
    }
    setError('');
    setRoute(result);
    setRouteEntry(entry);
    setRecents((prev) => {
      const next = withRecent(prev, entry);
      writeRouteList(RECENT_ROUTES_KEY, next);
      return next;
    });
    setTimeout(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function handleFindRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) {
      setError('Please select both a starting location and a destination.');
      return;
    }
    if (choosingRooms && classes) {
      rememberClassRooms([
        ...(classes.from ? [[classes.from, from] as const] : []),
        ...(classes.to ? [[classes.to, to] as const] : []),
      ]);
      setChoosingRooms(false);
    }
    if (from.room === to.room && from.floor === to.floor) {
      setError('Starting location and destination cannot be the same.');
      return;
    }
    findRoomRoute({ fromFloor: from.floor, fromKey: from.room, toFloor: to.floor, toKey: to.room });
  }

  function runQuickRoute(r: RouteEntry) {
    setClasses(null);
    setChoosingRooms(false);
    setFrom({ room: r.fromKey, floor: r.fromFloor });
    setTo({ room: r.toKey, floor: r.toFloor });
    findRoomRoute(r);
  }

  function handleSwap() {
    setClasses(null);
    setChoosingRooms(false);
    setFrom(to);
    setTo(from);
    setRoute(null);
    setRouteEntry(null);
    setError('');
  }

  function pickRoom(setRoom: (room: RoomChoice) => void) {
    return (room: RoomChoice) => {
      setRoom(room);
      setError('');
    };
  }

  function toggleSaved(entry: RouteEntry) {
    setSaved((prev) => {
      const next = withSavedToggled(prev, entry);
      writeRouteList(SAVED_ROUTES_KEY, next);
      return next;
    });
  }

  const classNames = [classes?.from, classes?.to].filter(Boolean).join(' and ');
  const currentSaved = !!routeEntry && saved.some((r) => routeEntryKey(r) === routeEntryKey(routeEntry));

  return (
    <AppShell headerSlot={<h1 className="text-lg font-semibold tracking-tight text-foreground">Route Finder</h1>}>
      <PageFrame className="max-w-6xl gap-8">

        <Panel>
          <form className="flex flex-col gap-5" onSubmit={handleFindRoute}>
            {classes ? (
              choosingRooms ? (
                <p className="text-base text-foreground">
                  Which rooms are {classNames} in? Pick From and To once, and this device will remember them.
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  Using your rooms for {classNames}.
                  <Button type="button" variant="ghost" size="sm" onClick={() => setChoosingRooms(true)}>
                    Change rooms
                  </Button>
                </p>
              )
            ) : null}
            <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <RoomField
                id="route-from"
                label={choosingRooms && classes?.from ? `From: ${classes.from}` : 'From'}
                color={START_COLOR}
                value={from}
                onChange={pickRoom(setFrom)}
              />
              <div className="flex justify-center md:pt-8">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Swap start and destination"
                  disabled={!from && !to}
                  onClick={handleSwap}
                >
                  <ArrowRightLeft className="rotate-90 md:rotate-0" />
                </Button>
              </div>
              <RoomField
                id="route-to"
                label={choosingRooms && classes?.to ? `To: ${classes.to}` : 'To'}
                color={END_COLOR}
                value={to}
                onChange={pickRoom(setTo)}
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">{error}</p>
            ) : null}
            <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-end">
              Find route
            </Button>
          </form>
        </Panel>

        {saved.length > 0 || recents.length > 0 ? (
          <div className="flex flex-col gap-4">
            <QuickRoutes title="Saved" routes={saved} onRun={runQuickRoute} onRemove={toggleSaved} />
            <QuickRoutes title="Recent" routes={recents} onRun={runQuickRoute} />
          </div>
        ) : null}

        {route ? (
          <section
            ref={mapRef}
            className="scroll-mt-20 rounded-3xl border bg-card p-1.5 shadow-sm"
            aria-labelledby="route-title"
          >
            {/* A stitched inner edge, like embroidery around the map. */}
            <div className="flex flex-col gap-6 rounded-[1.3rem] border-2 border-dashed border-primary/30 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id="route-title" className="text-2xl font-semibold tracking-tight text-foreground">
                    {route.fromLabel} to {route.toLabel}
                  </h2>
                  <p className="text-base text-muted-foreground">
                    {route.minutes} min walk · {route.meters} m
                    {route.sameFloor ? ` · Floor ${route.fromFloor}` : ` · Stair ${route.stairNum} to Floor ${route.toFloor}`}
                  </p>
                </div>
                {routeEntry ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => toggleSaved(routeEntry)}
                    aria-pressed={currentSaved}
                  >
                    <Star className="size-4" fill={currentSaved ? 'currentColor' : 'none'} />
                    {currentSaved ? 'Saved' : 'Save route'}
                  </Button>
                ) : null}
              </div>
              <NavigationMap route={route} />
            </div>
          </section>
        ) : null}
      </PageFrame>
    </AppShell>
  );
}
