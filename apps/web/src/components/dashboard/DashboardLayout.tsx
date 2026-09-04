'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import {
  WIDGETS,
  getAvailableWidgets,
  getDefaultLayout,
  isWidgetAllowed,
  type WidgetDefinition,
} from './widget-registry';

const STORAGE_PREFIX = 'ia_dashboard_layout_';

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

// ─── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  id,
  widget,
  editing,
  onRemove,
}: {
  id: string;
  widget: WidgetDefinition;
  editing: boolean;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const Component = widget.Component;

  return (
    <div
      ref={setNodeRef}
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
              className="flex size-6 cursor-grab items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
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
  );
}

// ─── Drag overlay (ghost while dragging) ─────────────────────────────────────

function DragGhost({ widget }: { widget: WidgetDefinition }) {
  const Component = widget.Component;
  return (
    <div className="pointer-events-none rounded-3xl ring-2 ring-primary/30 scale-[1.02] rotate-[0.5deg]">
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
  const [columnCount, setColumnCount] = useState(2);

  // Sensor config — small drag distance to avoid accidental triggers
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Track viewport breakpoint to choose 1 vs 2 columns (matches md:1280 ish for masonry).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setColumnCount(mq.matches ? 2 : 1);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Load persisted layout once user is known
  useEffect(() => {
    const nextLayout =
      !user
        ? getDefaultLayout()
        : user.dashboardLayout && user.dashboardLayout.length > 0
          ? user.dashboardLayout.filter((id) => {
              const widget = WIDGETS[id];
              return widget && isWidgetAllowed(widget, user.roles);
            })
          : (loadLayout(user._id) ?? getDefaultLayout());

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

  // Distribute half-width widgets into N columns, assigning by index
  // so that layout is predictable and doesn't jump randomly.
  const columns = useMemo<string[][]>(() => {
    if (columnIds.length === 0) return [];
    const cols: string[][] = Array.from({ length: columnCount }, () => []);
    for (let i = 0; i < columnIds.length; i++) {
      cols[i % columnCount].push(columnIds[i]);
    }
    return cols;
  }, [columnIds, columnCount]);

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

                {/* Half-width widgets — distributed into N columns by measured
                    height so widgets pack densely without large gaps. */}
                {columns.length > 0 && (
                  <div className="flex flex-col gap-6 md:flex-row">
                    {columns.map((colIds, colIndex) => (
                      <div key={colIndex} className="flex flex-1 flex-col gap-6 min-w-0">
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
