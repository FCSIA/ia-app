'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Columns2,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  Undo2,
  X,
} from 'lucide-react';
import { LayoutGroup, LazyMotion, useReducedMotion } from 'framer-motion';
import * as m from 'framer-motion/m';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
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
import {
  normalizeDashboardColumns,
  normalizeDashboardLayout,
} from '~/apps/convex/src/users/dashboardLayout';
import {
  WIDGETS,
  getAvailableWidgets,
  getDefaultLayout,
  isWidgetAllowed,
  type WidgetDefinition,
} from './widget-registry';

import {
  balanceColumns,
  canImproveBalance,
  columnHeight,
  moveToColumn,
  withMobileOrder,
  type DashboardArrangement,
} from './column-layout';

const loadMotionFeatures = () =>
  import('./dashboard-motion').then((module) => module.default);

const STORAGE_PREFIX = 'ia_dashboard_layout_';

const HEIGHT_EPSILON = 8;
const PACK_SETTLE_MS = 1200;

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadLayout(
  userId: string,
): { layout: string[]; columns?: string[][] } | null {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(userId)) ?? 'null',
    );
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return { layout: parsed };
    }
    if (!parsed || typeof parsed !== 'object' || !('layout' in parsed))
      return null;
    const { layout } = parsed;
    if (!Array.isArray(layout) || !layout.every((id) => typeof id === 'string'))
      return null;
    const columns = 'columns' in parsed ? parsed.columns : undefined;
    return {
      layout,
      columns:
        Array.isArray(columns) &&
        columns.length === 2 &&
        columns.every(
          (column) =>
            Array.isArray(column) &&
            column.every((id) => typeof id === 'string'),
        )
          ? columns
          : undefined,
    };
  } catch {
    return null;
  }
}

function saveLayout(userId: string, state: DashboardArrangement) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // The server remains authoritative if the browser cache is unavailable.
  }
}

// Prefer widget targets over their containing column; empty columns remain droppable.
const columnCollision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const hits = pointerWithin(args);
  const collisions = hits.length ? hits : closestCenter(args);
  const widgets = collisions.filter(
    (hit) => !String(hit.id).startsWith('dashboard-column-'),
  );
  return widgets.length ? widgets : collisions;
};

function WidgetColumn({
  ids,
  index,
  editing,
  children,
}: {
  ids: string[];
  index: number;
  editing: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: `dashboard-column-${index}`,
    // Populated columns use their sortable widgets as targets.
    disabled: !editing || ids.length > 0,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-6',
        editing && 'min-h-40',
      )}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
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
  const reducedMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !editing,
    transition: reducedMotion ? null : undefined,
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
    <m.div
      layout="position"
      layoutId={`dashboard-widget-${id}`}
      transition={{ layout: { duration: reducedMotion ? 0 : 0.22 } }}
    >
      <div
        ref={setRefs}
        style={style}
        className={cn(
          'relative',
          editing ? 'rounded-3xl ring-1 ring-dashed ring-border/70' : '',
          isDragging ? 'opacity-40' : '',
        )}
      >
        <div>
          {editing && (
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-border/70 bg-background/95 p-0.5 backdrop-blur">
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="flex size-6 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label={`Drag ${widget.label}`}
              >
                <GripVertical className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${widget.label}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className={editing ? 'opacity-95' : ''}>
            <Component />
          </div>
        </div>
      </div>
    </m.div>
  );
}

// ─── Drag overlay (ghost while dragging) ─────────────────────────────────────

function DragGhost({ widget }: { widget: WidgetDefinition }) {
  const Component = widget.Component;
  return (
    <div className="pointer-events-none rounded-3xl ring-2 ring-primary/30">
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
  const reducedMotion = useReducedMotion();
  const { toast } = useToast();
  const updateDashboardLayout = useMutation(api.users.me.updateDashboardLayout);
  const [arrangement, setArrangement] = useState<DashboardArrangement | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [autoBalance, setAutoBalance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dragSnapshot = useRef<DashboardArrangement | null>(null);
  const undoToast = useRef<(() => void) | null>(null);
  const loadedPreference = useRef<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  const layout = arrangement?.layout;
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: reducedMotion ? 'auto' : 'smooth',
    }),
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => {
      setHeights({});
      setColumnCount(mq.matches ? 2 : 1);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const dismissUndo = useCallback(() => {
    undoToast.current?.();
    undoToast.current = null;
  }, []);
  useEffect(() => dismissUndo, [dismissUndo]);
  useEffect(() => {
    if (!editing) dismissUndo();
  }, [editing, dismissUndo]);

  const handleMeasure = useCallback((id: string, height: number) => {
    if (height <= 0) return;
    setHeights((prev) =>
      prev[id] !== undefined && Math.abs(prev[id] - height) < HEIGHT_EPSILON
        ? prev
        : { ...prev, [id]: height },
    );
  }, []);

  const preferenceKey = JSON.stringify([
    user?._id,
    user?.roles,
    user?.dashboardLayout,
    user?.dashboardColumns,
  ]);
  useEffect(() => {
    if (
      !user ||
      (editing && loadedUser.current === user._id) ||
      loadedPreference.current === preferenceKey
    )
      return;
    const local = loadLayout(user._id);
    const saved = user.dashboardLayout.length
      ? { layout: user.dashboardLayout, columns: user.dashboardColumns }
      : local;
    const nextLayout = normalizeDashboardLayout(
      saved?.layout ?? getDefaultLayout(),
    ).filter((id) => WIDGETS[id] && isWidgetAllowed(WIDGETS[id], user.roles));
    setArrangement({
      layout: nextLayout,
      columns: normalizeDashboardColumns(saved?.columns, nextLayout),
    });
    setAutoBalance(!saved);
    loadedPreference.current = preferenceKey;
    loadedUser.current = user._id;
    dismissUndo();
  }, [preferenceKey, editing, user, dismissUndo]);

  const availableWidgets = useMemo(
    () => getAvailableWidgets(user?.roles),
    [user?.roles],
  );
  const { fixedIds, fullIds, columnIds } = useMemo(() => {
    const fixedIds: string[] = [];
    const fullIds: string[] = [];
    const columnIds: string[] = [];
    for (const widget of Object.values(WIDGETS)) {
      if (widget.isFixed && isWidgetAllowed(widget, user?.roles))
        fixedIds.push(widget.id);
    }
    for (const id of layout ?? []) {
      const widget = WIDGETS[id];
      if (!widget || widget.isFixed) continue;
      if (widget.size === 'full') fullIds.push(id);
      else columnIds.push(id);
    }
    return { fixedIds, fullIds, columnIds };
  }, [layout, user?.roles]);
  const desktopColumns = useMemo(() => {
    const allowed = new Set(columnIds);
    return (
      arrangement?.columns.map((column) =>
        column.filter((id) => allowed.has(id)),
      ) ?? [[], []]
    );
  }, [arrangement, columnIds]);
  const columns = columnCount === 2 ? desktopColumns : [columnIds];
  const measured =
    columnCount === 2 && columnIds.every((id) => heights[id] !== undefined);
  const balanced = useMemo(
    () => balanceColumns(desktopColumns, columnIds, heights),
    [desktopColumns, columnIds, heights],
  );
  const canBalance =
    measured && canImproveBalance(desktopColumns, balanced, heights);

  // Only a fresh/default layout can balance automatically, after content settles.
  useEffect(() => {
    if (!autoBalance || !measured || activeId) return;
    const timer = window.setTimeout(() => {
      setArrangement((prev) => (prev ? { ...prev, columns: balanced } : prev));
      setAutoBalance(false);
    }, PACK_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [autoBalance, measured, activeId, balanced]);

  const beginEdit = useCallback(() => {
    setAutoBalance(false);
    dismissUndo();
  }, [dismissUndo]);
  const handleSave = useCallback(async () => {
    if (!user || !arrangement || isSaving) return;
    beginEdit();
    setIsSaving(true);
    try {
      await updateDashboardLayout({
        layout: arrangement.layout,
        columns: arrangement.columns,
      });
      saveLayout(user._id, arrangement);
      toast({ title: 'Dashboard saved across all devices' });
      onEditingChange(false);
    } catch {
      toast({
        title: 'Could not save dashboard',
        description: 'Your changes are still here. Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    user,
    arrangement,
    isSaving,
    beginEdit,
    updateDashboardLayout,
    toast,
    onEditingChange,
  ]);

  const handleReset = useCallback(() => {
    beginEdit();
    const fresh = getDefaultLayout().filter((id) =>
      isWidgetAllowed(WIDGETS[id], user?.roles),
    );
    setArrangement({
      layout: fresh,
      columns: normalizeDashboardColumns(undefined, fresh),
    });
    setAutoBalance(true);
  }, [beginEdit, user?.roles]);
  const handleRemove = useCallback(
    (id: string) => {
      beginEdit();
      setArrangement((prev) =>
        prev
          ? {
              layout: prev.layout.filter((item) => item !== id),
              columns: prev.columns.map((column) =>
                column.filter((item) => item !== id),
              ),
            }
          : prev,
      );
    },
    [beginEdit],
  );
  const handleAdd = useCallback(
    (id: string) => {
      beginEdit();
      setArrangement((prev) => {
        if (!prev || prev.layout.includes(id)) return prev;
        const target =
          columnHeight(prev.columns[0], heights) <=
          columnHeight(prev.columns[1], heights)
            ? 0
            : 1;
        return {
          layout: [...prev.layout, id],
          columns: prev.columns.map((column, index) =>
            index === target ? [...column, id] : column,
          ),
        };
      });
      setPickerOpen(false);
    },
    [beginEdit, heights],
  );
  const handleBalance = useCallback(() => {
    if (!arrangement || !canBalance) return;
    beginEdit();
    const previous = arrangement;
    setArrangement({ ...arrangement, columns: balanced });
    undoToast.current = toast({
      title: 'Layout balanced',
      duration: 10000,
      action: (
        <ToastAction
          asChild
          altText="Undo layout balancing"
          onClick={() => {
            setArrangement(previous);
            dismissUndo();
          }}
        >
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Undo layout balancing"
            title="Undo"
          >
            <Undo2 aria-hidden />
          </Button>
        </ToastAction>
      ),
    }).dismiss;
  }, [arrangement, canBalance, beginEdit, balanced, toast, dismissUndo]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      beginEdit();
      dragSnapshot.current = arrangement;
      setActiveId(String(event.active.id));
    },
    [beginEdit, arrangement],
  );
  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (columnCount !== 2 || !over) return;
      setArrangement((prev) => {
        if (!prev) return prev;
        const id = String(active.id);
        const source = prev.columns.findIndex((column) => column.includes(id));
        const target = String(over.id).startsWith('dashboard-column-')
          ? Number(String(over.id).replace('dashboard-column-', ''))
          : prev.columns.findIndex((column) =>
              column.includes(String(over.id)),
            );
        if (source < 0 || target < 0 || target === source) return prev;
        const overIndex = prev.columns[target].indexOf(String(over.id));
        const after =
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height / 2;
        const index =
          overIndex < 0
            ? prev.columns[target].length
            : overIndex + (after ? 1 : 0);
        return moveToColumn(prev, id, target, index);
      });
    },
    [columnCount],
  );
  const handleDragCancel = useCallback(() => {
    setArrangement(dragSnapshot.current);
    setActiveId(null);
    dragSnapshot.current = null;
  }, []);
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over) {
        setArrangement(dragSnapshot.current);
        dragSnapshot.current = null;
        return;
      }
      dragSnapshot.current = null;
      setArrangement((prev) => {
        if (!prev || active.id === over.id) return prev;
        const id = String(active.id);
        if (columnCount === 1) {
          const from = prev.layout.indexOf(id),
            to = prev.layout.indexOf(String(over.id));
          return from < 0 || to < 0
            ? prev
            : withMobileOrder(prev, arrayMove(prev.layout, from, to));
        }
        const column = prev.columns.findIndex((items) => items.includes(id));
        if (column < 0) return prev;
        const to = prev.columns[column].indexOf(String(over.id));
        return to < 0 ? prev : moveToColumn(prev, id, column, to);
      });
    },
    [columnCount],
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
                    disabled={missingWidgets.length === 0 || isSaving}
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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="lg"
                  leadingIcon={Columns2}
                  className="hidden md:inline-flex"
                  onClick={handleBalance}
                  disabled={!canBalance || isSaving || Boolean(activeId)}
                  title={
                    columnCount === 1
                      ? 'Balance layout is available in the two-column view'
                      : canBalance
                        ? 'Arrange widgets into shorter columns'
                        : 'Layout is already balanced'
                  }
                >
                  Balance layout
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  leadingIcon={RotateCcw}
                  onClick={handleReset}
                  disabled={isSaving || Boolean(activeId)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || Boolean(activeId)}
                  size="lg"
                  leadingIcon={Save}
                >
                  {isSaving ? 'Saving…' : 'Done'}
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

          <LazyMotion features={loadMotionFeatures}>
            <LayoutGroup id="dashboard">
              <DndContext
                sensors={sensors}
                collisionDetection={columnCollision}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={fullIds}
                  strategy={verticalListSortingStrategy}
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
                          editing={editing && !isSaving}
                          onRemove={handleRemove}
                        />
                      );
                    })}

                    {/* Explicit columns preserve the placement shown while dragging. */}
                    {columns.length > 0 && (
                      <div className="flex flex-col gap-6 md:flex-row md:items-start">
                        {columns.map((colIds, colIndex) => (
                          <WidgetColumn
                            key={`${columnCount}-${colIndex}`}
                            ids={colIds}
                            index={colIndex}
                            editing={editing && !isSaving}
                          >
                            {colIds.map((id) => {
                              const widget = WIDGETS[id];
                              if (!widget) return null;
                              return (
                                <SortableWidget
                                  key={id}
                                  id={id}
                                  widget={widget}
                                  editing={editing && !isSaving}
                                  onRemove={handleRemove}
                                  onMeasure={handleMeasure}
                                />
                              );
                            })}
                          </WidgetColumn>
                        ))}
                      </div>
                    )}

                    {layout.length === 0 && (
                      <div className="rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
                        <LayoutGrid className="mx-auto mb-3 size-8 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">
                          Your dashboard is empty.
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Click <span className="font-semibold">Customize</span>{' '}
                          then <span className="font-semibold">Add widget</span>{' '}
                          to build it up.
                        </p>
                      </div>
                    )}
                  </div>
                </SortableContext>

                <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
                  {activeId && activeWidget ? (
                    <DragGhost widget={activeWidget} />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </LayoutGroup>
          </LazyMotion>
        </div>
      </div>
    </PageFrame>
  );
}

export default DashboardLayout;
