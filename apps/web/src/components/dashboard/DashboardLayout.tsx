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
import {
  WIDGETS,
  getAvailableWidgets,
  getDefaultLayout,
  isWidgetAllowed,
  type WidgetDefinition,
} from './widget-registry';
import { usersApi } from '@/lib/api';

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
        isDragging ? 'opacity-40 scale-[0.98]' : '',
        editing ? 'cursor-default' : '',
      )}
    >
      {editing && (
        <div className="absolute -top-2 left-4 right-4 z-20 flex items-center justify-between gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex cursor-grab items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary active:cursor-grabbing"
          >
            <GripVertical className="size-3" />
            {widget.label}
          </div>
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="rounded-full border border-border bg-background p-1 text-destructive shadow-sm transition hover:bg-destructive/10"
            aria-label="Remove widget"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
      <div className={editing ? 'mt-4 opacity-90' : ''}>
        <Component />
      </div>
    </div>
  );
}

// ─── Overlay (ghost while dragging) ──────────────────────────────────────────

function DragGhost({ widget }: { widget: WidgetDefinition }) {
  const Component = widget.Component;
  return (
    <div className="pointer-events-none opacity-95 shadow-2xl ring-2 ring-primary/30 rounded-3xl scale-[1.02] rotate-[0.8deg]">
      <Component />
    </div>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [layout, setLayout] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensor config — require a small drag distance to avoid accidentally triggering
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Load persisted layout once user is known
  useEffect(() => {
    if (!user) {
      setLayout(getDefaultLayout(undefined));
      return;
    }

    // Attempt to load from server first
    usersApi
      .getDashboardLayout()
      .then((serverLayout) => {
        if (serverLayout && serverLayout.length > 0) {
          const cleaned = serverLayout.filter((id) => {
            const widget = WIDGETS[id];
            return widget && isWidgetAllowed(widget, user.roles);
          });
          setLayout(cleaned);
        } else {
          // No server layout yet, check local storage or use default
          const persisted = loadLayout(user.id);
          setLayout(persisted ?? getDefaultLayout(user.roles));
        }
      })
      .catch(() => {
        // Fallback to local storage if API fails
        const persisted = loadLayout(user.id);
        setLayout(persisted ?? getDefaultLayout(user.roles));
      });
  }, [user]);

  const availableWidgets = useMemo(
    () => getAvailableWidgets(user?.roles),
    [user?.roles],
  );

  const handleSave = useCallback(() => {
    if (user && layout) {
      // Sync to cloud
      usersApi.updateDashboardLayout(layout);
      // Also cache locally
      saveLayout(user.id, layout);
      toast({ title: 'Dashboard saved across all devices' });
    }
    setEditing(false);
  }, [layout, toast, user]);

  const handleReset = useCallback(() => {
    if (!user) return;
    const fresh = getDefaultLayout(user.roles);
    setLayout(fresh);
    saveLayout(user.id, fresh);
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
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const { fixedIds, fullIds, columnIds } = useMemo(() => {
    if (!layout) return { fixedIds: [], fullIds: [], columnIds: [] };

    // Find fixed widgets based on registry definition
    const fixed = Object.values(WIDGETS)
      .filter((w) => w.isFixed && isWidgetAllowed(w, user?.roles))
      .map((w) => w.id);

    // Dynamic IDs are those in the state that are not fixed
    const dynamic = layout.filter((id) => !WIDGETS[id]?.isFixed);

    const full = dynamic.filter((id) => WIDGETS[id]?.size === 'full');
    const cols = dynamic.filter((id) => WIDGETS[id]?.size === 'half');

    return { fixedIds: fixed, fullIds: full, columnIds: cols };
  }, [layout, user?.roles]);

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
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 rounded-full px-4"
                        disabled={missingWidgets.length === 0}
                      >
                        <Plus className="size-4" />
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

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-9 gap-2 rounded-full px-4"
                  >
                    <RotateCcw className="size-4" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="h-9 gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                  >
                    <Save className="size-4" />
                    Done
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="h-9 gap-2 rounded-full bg-background px-4 font-medium shadow-sm transition hover:bg-muted"
                >
                  <LayoutGrid className="size-4" />
                  Customize
                </Button>
              )}
            </div>
          </div>

          {/* Static / Fixed widgets (cannot be moved or removed) */}
          {fixedIds.map((id) => {
            const widget = WIDGETS[id];
            if (!widget) return null;
            const Component = widget.Component;
            return (
              <div key={id} className={cn(editing ? 'opacity-80' : '')}>
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

                {/* Columnar widgets distributed for horizontal priority */}
                {columnIds.length > 0 && (
                  <div className="flex flex-col gap-6 md:flex-row">
                    {[0, 1, 2].map((colIndex) => (
                      <div key={colIndex} className="flex flex-1 flex-col gap-6">
                        {columnIds
                          .filter((_, i) => i % 3 === colIndex)
                          .map((id) => {
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
