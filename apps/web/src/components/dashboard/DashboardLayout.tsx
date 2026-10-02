'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutGrid, Plus, RotateCcw, Save, X } from 'lucide-react';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CanvasCalendarAnnouncement } from './CanvasCalendarAnnouncement';
import { PushReenableAnnouncement } from './PushReenableAnnouncement';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { normalizeDashboardLayout } from '~/apps/convex/src/users/dashboardLayout';
import {
  WIDGETS,
  getAvailableWidgets,
  getDefaultLayout,
  isWidgetAllowed,
  type WidgetDefinition,
} from './widget-registry';

const STORAGE_PREFIX = 'ia_dashboard_layout_';

/** Vertical gap between stacked widgets, in px — mirrors the `gap-6` below. */
const COLUMN_GAP = 24;
/** Height assumed for a widget that has not been measured yet. */
const ESTIMATED_WIDGET_HEIGHT = 320;
/** Ignore sub-pixel and scrollbar noise so packing does not thrash. */
const HEIGHT_EPSILON = 8;
/** How long measurements must stay unchanged before the packing is frozen. */
const PACK_SETTLE_MS = 1200;
/** Above this many arrangements, fall back to the cheap greedy pack. */
const MAX_PACK_COMBINATIONS = 4096;

function storageKey(userId: string | null | undefined) {
  return userId ? `${STORAGE_PREFIX}${userId}` : `${STORAGE_PREFIX}anon`;
}

function loadLayout(userId: string | null | undefined): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveLayout(userId: string | null | undefined, layout: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(layout));
  } catch {
    // ignore
  }
}

/** Rendered height of a column holding `weights`, gaps included. */
function columnHeight(weights: number[]): number {
  if (weights.length === 0) return 0;
  return weights.reduce((sum, w) => sum + w, 0) + COLUMN_GAP * (weights.length - 1);
}

/** Tallest column for one assignment of widgets to columns. */
function tallestColumn(weights: number[], assignment: number[], columnCount: number): number {
  let tallest = 0;
  for (let column = 0; column < columnCount; column += 1) {
    const height = columnHeight(weights.filter((_, index) => assignment[index] === column));
    if (height > tallest) tallest = height;
  }
  return tallest;
}

/**
 * Drop each widget into whichever column is currently shortest. Cheap, but
 * order-sensitive: a tall widget arriving last can still leave the columns
 * lopsided. Used only as the fallback for layouts too large to search.
 */
function greedyAssignment(weights: number[], columnCount: number): number[] {
  const totals = new Array<number>(columnCount).fill(0);
  return weights.map((weight) => {
    let target = 0;
    for (let column = 1; column < columnCount; column += 1) {
      // Strictly shorter wins, so equal columns fill left-to-right.
      if (totals[column] < totals[target] - 1) target = column;
    }
    totals[target] += weight + COLUMN_GAP;
    return target;
  });
}

/**
 * Exhaustive search for the assignment with the shortest tallest column, so
 * the columns end up as level as the widget heights allow. The dashboard holds
 * a handful of widgets, so the search space stays tiny. Candidates are visited
 * in lexicographic order and the first best one wins, which keeps earlier
 * widgets in earlier columns and makes the result stable across renders.
 */
function bestAssignment(weights: number[], columnCount: number): number[] {
  const count = weights.length;
  const combinations = columnCount ** count;
  if (combinations > MAX_PACK_COMBINATIONS) return greedyAssignment(weights, columnCount);

  let best: number[] = new Array<number>(count).fill(0);
  let bestHeight = Number.POSITIVE_INFINITY;

  for (let value = 0; value < combinations; value += 1) {
    const assignment = new Array<number>(count);
    let remainder = value;
    for (let index = count - 1; index >= 0; index -= 1) {
      assignment[index] = remainder % columnCount;
      remainder = Math.floor(remainder / columnCount);
    }
    const height = tallestColumn(weights, assignment, columnCount);
    if (height < bestHeight) {
      bestHeight = height;
      best = assignment;
    }
  }

  return best;
}

/**
 * Masonry packing by measured height. The old layout split widgets round-robin
 * (`index % columnCount`), which stranded a tall widget such as the calendar
 * beside two short ones and left one column running hundreds of pixels longer
 * than the other.
 */
function packColumns(
  ids: string[],
  columnCount: number,
  heights: Record<string, number>,
): string[][] {
  if (ids.length === 0) return [];
  if (columnCount <= 1) return [ids];

  const weights = ids.map((id) => heights[id] ?? ESTIMATED_WIDGET_HEIGHT);
  const assignment = bestAssignment(weights, columnCount);

  const columns: string[][] = Array.from({ length: columnCount }, () => []);
  ids.forEach((id, index) => columns[assignment[index]].push(id));

  return columns.filter((column) => column.length > 0);
}

// ─── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  id,
  widget,
  editing,
  onRemove,
  onMeasure,
}: {
  id: string;
  widget: WidgetDefinition;
  editing: boolean;
  onRemove: (id: string) => void;
  onMeasure?: (id: string, height: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !onMeasure) return;
    // Measure right away rather than waiting on the first observer callback.
    onMeasure(id, node.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      onMeasure(id, node.getBoundingClientRect().height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onMeasure]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const Component = widget.Component;

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        'relative',
        editing
          ? 'cursor-grab touch-none rounded-[1.75rem] border border-dashed border-border/80 bg-muted/20 p-2 active:cursor-grabbing'
          : '',
        isDragging ? 'opacity-40' : '',
      )}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
    >
      {editing ? (
        <div className="mb-2 flex items-center gap-1.5 px-1.5">
          <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
            {widget.label}
          </span>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onRemove(id)}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${widget.label}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className={editing ? 'pointer-events-none select-none' : ''}>
        <Component />
      </div>
    </div>
  );
}

// ─── Drag overlay (ghost while dragging) ─────────────────────────────────────

function DragGhost({ widget }: { widget: WidgetDefinition }) {
  const Component = widget.Component;
  return (
    <div className="pointer-events-none rotate-[0.5deg] scale-[1.02] rounded-[1.75rem] p-2 ring-2 ring-primary/30">
      <Component />
    </div>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────

export function DashboardLayout({
  editing,
  onEditingChange,
}: {
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const updateDashboardLayout = useMutation(api.users.me.updateDashboardLayout);
  const [layout, setLayout] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [heights, setHeights] = useState<Record<string, number>>({});

  // Sensor config — small drag distance to avoid accidental triggers
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Track viewport breakpoint to choose 1 vs 2 columns (matches the md: split below).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setColumnCount(mq.matches ? 2 : 1);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleMeasure = useCallback((id: string, height: number) => {
    if (height <= 0) return;
    setHeights((prev) => {
      const previous = prev[id];
      if (previous !== undefined && Math.abs(previous - height) < HEIGHT_EPSILON) return prev;
      return { ...prev, [id]: height };
    });
  }, []);

  // Load persisted layout once user is known
  useEffect(() => {
    const normalizeAllowedLayout = (candidate: readonly string[]) =>
      normalizeDashboardLayout(candidate).filter((id) => {
        const widget = WIDGETS[id];
        return widget && isWidgetAllowed(widget, user?.roles);
      });

    const savedLayout = user?.dashboardLayout?.length
      ? normalizeAllowedLayout(user.dashboardLayout)
      : [];
    const localLayout = normalizeAllowedLayout(loadLayout(user?._id) ?? []);
    const nextLayout =
      !user
        ? getDefaultLayout()
        : savedLayout.length > 0
          ? savedLayout
          : localLayout.length > 0
            ? localLayout
            : getDefaultLayout();

    setLayout(nextLayout);
  }, [user]);

  const availableWidgets = useMemo(
    () => getAvailableWidgets(user?.roles),
    [user?.roles],
  );

  const handleSave = useCallback(() => {
    if (user && layout) {
      void updateDashboardLayout({ layout });
      saveLayout(user._id, layout);
      toast({ title: 'Dashboard saved across all devices' });
    }
    onEditingChange(false);
  }, [layout, onEditingChange, toast, updateDashboardLayout, user]);

  const handleReset = useCallback(() => {
    if (!user) return;
    const fresh = getDefaultLayout();
    setLayout(fresh);
    saveLayout(user._id, fresh);
    toast({ title: 'Dashboard reset to default' });
  }, [toast, user]);

  const handleRemove = useCallback((id: string) => {
    setLayout((prev) => (prev ? prev.filter((x) => x !== id) : prev));
  }, []);

  const handleAdd = useCallback((id: string) => {
    setLayout((prev) => {
      if (!prev) return [id];
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setPickerOpen(false);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const { fixedIds, fullIds, columnIds } = useMemo(() => {
    if (!layout) return { fixedIds: [], fullIds: [], columnIds: [] };
    const fixed = Object.values(WIDGETS)
      .filter((w) => w.isFixed && isWidgetAllowed(w, user?.roles))
      .map((w) => w.id);
    const dynamic = layout.filter((id) => !WIDGETS[id]?.isFixed);
    const full = dynamic.filter((id) => WIDGETS[id]?.size === 'full');
    const cols = dynamic.filter((id) => WIDGETS[id]?.size === 'half');
    return { fixedIds: fixed, fullIds: full, columnIds: cols };
  }, [layout, user?.roles]);

  // Half-width widgets are packed by measured height so the columns stay level
  // instead of one running far longer than the other. The packing freezes on
  // the first full measurement: widgets whose content loads in later (or that
  // resize) never shuffle between columns under the user. It is measured again
  // only when the set of widgets or the column count changes.
  const packKey = `${columnCount}:${[...columnIds].sort().join(',')}`;
  const [frozenPack, setFrozenPack] = useState<{
    key: string;
    heights: Record<string, number>;
  } | null>(null);
  const packHeights = frozenPack?.key === packKey ? frozenPack.heights : null;

  // Wait for the measurements to settle before freezing: widgets render short
  // placeholders while their data loads, and freezing on those would lock in a
  // lopsided split.
  useEffect(() => {
    if (packHeights || columnIds.length === 0) return;
    if (!columnIds.every((id) => heights[id] !== undefined)) return;
    const timer = window.setTimeout(() => {
      setFrozenPack({ key: packKey, heights: { ...heights } });
    }, PACK_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [packHeights, columnIds, heights, packKey]);

  const columns = useMemo(
    () => packColumns(columnIds, columnCount, packHeights ?? {}),
    [columnIds, columnCount, packHeights],
  );

  if (!layout) {
    return (
      <PageFrame className="pt-0">
        <div className="h-64 animate-pulse rounded-[2rem] bg-muted/30" />
      </PageFrame>
    );
  }

  const missingWidgets = availableWidgets.filter((w) => !layout.includes(w.id));
  const activeWidget = activeId ? WIDGETS[activeId] : null;

  return (
    <PageFrame className="pb-24 pt-0">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-6">
          <PushReenableAnnouncement />
          <CanvasCalendarAnnouncement />
          {editing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="tertiary"
                    size="sm"
                    leadingIcon={Plus}
                    className="h-9 rounded-full px-4"
                    disabled={missingWidgets.length === 0}
                  >
                    Add widget
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-[2rem]">
                  <DialogHeader>
                    <DialogTitle>Add a widget</DialogTitle>
                    <DialogDescription>
                      Choose a widget to add to your dashboard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 grid gap-2">
                    {missingWidgets.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        All available widgets are already on your dashboard.
                      </p>
                    ) : (
                      missingWidgets.map((widget) => (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => handleAdd(widget.id)}
                          className="flex items-start gap-3 rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-3 text-left transition hover:border-border hover:bg-muted/60"
                        >
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <LayoutGrid className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {widget.label}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {widget.description}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="lg"
                  leadingIcon={RotateCcw}
                  onClick={handleReset}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSave}
                  size="lg"
                  leadingIcon={Save}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}

          {/* Static / Fixed widgets (cannot be moved or removed) */}
          {fixedIds.map((id) => {
            const widget = WIDGETS[id];
            if (!widget) return null;
            const Component = widget.Component;
            return (
              <div key={id} className={cn(editing ? 'opacity-90' : '')}>
                <Component />
              </div>
            );
          })}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={[...fullIds, ...columnIds]}
              strategy={rectSortingStrategy}
            >
              <div className="space-y-6">
                {/* Full-width dynamic widgets */}
                {fullIds.map((id) => {
                  const widget = WIDGETS[id];
                  if (!widget) return null;
                  return (
                    <SortableWidget
                      key={id}
                      id={id}
                      widget={widget}
                      editing={editing}
                      onRemove={handleRemove}
                    />
                  );
                })}

                {/* Half-width widgets — packed into height-balanced columns. */}
                {columns.length > 0 && (
                  <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    {columns.map((colIds, colIndex) => (
                      <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-6">
                        {colIds.map((id) => {
                          const widget = WIDGETS[id];
                          if (!widget) return null;
                          return (
                            <SortableWidget
                              key={id}
                              id={id}
                              widget={widget}
                              editing={editing}
                              onRemove={handleRemove}
                              onMeasure={handleMeasure}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {layout.length === 0 && (
                  <div className="rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
                    <LayoutGrid className="mx-auto mb-3 size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">Your dashboard is empty.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Click <span className="font-semibold">Customize</span> then{' '}
                      <span className="font-semibold">Add widget</span> to build it up.
                    </p>
                  </div>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId && activeWidget ? (
                <DragGhost widget={activeWidget} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </PageFrame>
  );
}

export default DashboardLayout;
