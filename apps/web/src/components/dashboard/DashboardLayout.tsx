"use client";

import {
  Component as ReactComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Columns2,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Undo2,
  X,
} from "lucide-react";
import { LayoutGroup, LazyMotion, useReducedMotion } from "framer-motion";
import * as m from "framer-motion/m";
import {
  PageFrame,
  Panel,
  PanelHeaderDragContext,
  PanelReservedHeightContext,
} from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
  CardMedia,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  normalizeDashboardColumns,
  normalizeDashboardLayout,
} from "~/apps/convex/src/users/dashboardLayout";
import {
  WIDGETS,
  getAvailableWidgets,
  getDefaultLayout,
  getDefaultColumns,
  isWidgetAllowed,
  type WidgetDefinition,
} from "./widget-registry";

import {
  balanceColumns,
  canImproveBalance,
  columnHeight,
  moveToColumn,
  withMobileOrder,
  type DashboardArrangement,
} from "./column-layout";
import { DashboardWidgetEmptyContext } from "./widget-visibility";

const loadMotionFeatures = () =>
  import("./dashboard-motion").then((module) => module.default);

const STORAGE_PREFIX = "ia_dashboard_layout_";
const HEIGHTS_PREFIX = "ia_dashboard_heights_";

const HEIGHT_EPSILON = 8;

/** Last settled widget heights per column count ("1" phone, "2" desktop). */
type HeightCache = Record<string, Record<string, number>>;

function loadHeights(userId: string): HeightCache {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(`${HEIGHTS_PREFIX}${userId}`) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object") return {};
    const cache: HeightCache = {};
    for (const [columns, heights] of Object.entries(parsed)) {
      if (!heights || typeof heights !== "object") continue;
      cache[columns] = Object.fromEntries(
        Object.entries(heights).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1]),
        ),
      );
    }
    return cache;
  } catch {
    return {};
  }
}

function saveHeights(userId: string, cache: HeightCache) {
  try {
    localStorage.setItem(`${HEIGHTS_PREFIX}${userId}`, JSON.stringify(cache));
  } catch {
    // Reserving space is an optimization; without storage panels simply settle.
  }
}

class WidgetErrorBoundary extends ReactComponent<
  { title: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Panel title={this.props.title}>
        <Empty size="inline">
          <EmptyDescription>Could not load this widget.</EmptyDescription>
          <Button
            size="sm"
            variant="tertiary"
            onClick={() => this.setState({ failed: false })}
          >
            Retry
          </Button>
        </Empty>
      </Panel>
    );
  }
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadLayout(
  userId: string,
): { layout: string[]; columns?: string[][] } | null {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(userId)) ?? "null",
    );
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      return { layout: parsed };
    }
    if (!parsed || typeof parsed !== "object" || !("layout" in parsed))
      return null;
    const { layout } = parsed;
    if (!Array.isArray(layout) || !layout.every((id) => typeof id === "string"))
      return null;
    const columns = "columns" in parsed ? parsed.columns : undefined;
    return {
      layout,
      columns:
        Array.isArray(columns) &&
        columns.length === 2 &&
        columns.every(
          (column) =>
            Array.isArray(column) &&
            column.every((id) => typeof id === "string"),
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
    (hit) => !String(hit.id).startsWith("dashboard-column-"),
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
        "flex min-w-0 flex-1 flex-col gap-6",
        editing && ids.length === 0 && "min-h-40",
      )}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
        {editing && ids.length === 0 ? (
          <Empty size="inline" frame="dashed">
            <EmptyDescription>Drop a widget here</EmptyDescription>
          </Empty>
        ) : null}
      </SortableContext>
    </div>
  );
}

// ─── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  id,
  widget,
  editing,
  hideWhenEmpty = false,
  reservedHeight,
  onRemove,
  onMeasure,
  onSettled,
}: {
  id: string;
  widget: WidgetDefinition;
  editing: boolean;
  /** Take no space outside edit mode until the widget reports content. */
  hideWhenEmpty?: boolean;
  /** Height this widget settled at on the last visit; held while it loads. */
  reservedHeight?: number;
  onRemove: (id: string) => void;
  onMeasure?: (id: string, height: number) => void;
  /** Receives the widget's height once its panel has finished loading. */
  onSettled?: (id: string, height: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  // A queue that was empty last time starts hidden, so it never flashes a
  // skeleton; one that had work keeps its remembered space while it loads.
  const [empty, setEmpty] = useState(
    hideWhenEmpty && !(reservedHeight && reservedHeight > 0),
  );
  const hidden = hideWhenEmpty && empty && !editing;
  const reportEmpty = useCallback(
    (value: boolean) => {
      setEmpty(value);
      // Hidden slots measure 0 without a resize event; remember the emptiness.
      if (value && !editing) onSettled?.(id, 0);
    },
    [editing, id, onSettled],
  );
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
    if (!node || (!onMeasure && !onSettled)) return;
    const measure = () => {
      const height = node.getBoundingClientRect().height;
      onMeasure?.(id, height);
      // Skeletons and edit-mode placeholders are not a settled height.
      if (!editing && !node.querySelector('[aria-busy="true"]'))
        onSettled?.(id, height);
    };
    // Measure right away rather than waiting on the first observer callback.
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // A skeleton that already matched the content settles without resizing.
    const busy = new MutationObserver(measure);
    busy.observe(node, {
      attributes: true,
      attributeFilter: ["aria-busy"],
      subtree: true,
    });
    return () => {
      observer.disconnect();
      busy.disconnect();
    };
  }, [id, editing, onMeasure, onSettled]);

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
      // display:none also drops the slot from its column's flex gap.
      className={hidden ? "hidden" : undefined}
    >
      <div
        ref={setRefs}
        data-dashboard-widget={id}
        style={style}
        className={cn(
          "relative flex flex-col gap-2",
          isDragging ? "opacity-40" : "",
        )}
      >
        {editing && (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-compact"
              variant="ghost"
              type="button"
              {...attributes}
              {...listeners}
              className="touch-none cursor-grab active:cursor-grabbing"
              aria-label={`Drag ${widget.label}`}
              title={`Drag ${widget.label}`}
            >
              <GripVertical />
            </Button>
            <Button
              size="icon-compact"
              variant="ghost"
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Remove ${widget.label}`}
              title={`Remove ${widget.label}`}
            >
              <X />
            </Button>
          </div>
        )}
        <PanelHeaderDragContext.Provider
          value={
            editing
              ? {
                  onMouseDown: (event) => listeners?.onMouseDown?.(event),
                  onTouchStart: (event) => listeners?.onTouchStart?.(event),
                }
              : undefined
          }
        >
          <DashboardWidgetEmptyContext.Provider
            value={hideWhenEmpty ? reportEmpty : null}
          >
            <PanelReservedHeightContext.Provider value={reservedHeight}>
              <WidgetErrorBoundary title={widget.label}>
                <Component />
              </WidgetErrorBoundary>
            </PanelReservedHeightContext.Provider>
          </DashboardWidgetEmptyContext.Provider>
        </PanelHeaderDragContext.Provider>
      </div>
    </m.div>
  );
}

// ─── Drag overlay (ghost while dragging) ─────────────────────────────────────

function DragGhost({ widget }: { widget: WidgetDefinition }) {
  const Component = widget.Component;
  return (
    <div className="pointer-events-none">
      <Component />
    </div>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────

export function DashboardLayout({
  editing,
  onEditingChange,
  toolbarTarget,
}: {
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  toolbarTarget?: HTMLElement | null;
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
  const editSnapshot = useRef<DashboardArrangement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const dragSnapshot = useRef<DashboardArrangement | null>(null);
  const undoToast = useRef<(() => void) | null>(null);
  const loadedPreference = useRef<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  // Settled heights from the last visit, read once per user so the space each
  // widget reserves while loading never changes underneath it.
  const [heightCache, setHeightCache] = useState<HeightCache>({});
  const heightCacheRef = useRef<HeightCache>({});
  const layout = arrangement?.layout;
  const userId = user?._id;
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: reducedMotion ? "auto" : "smooth",
    }),
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setHeights({});
      setColumnCount(mq.matches ? 2 : 1);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
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
  const handleSettled = useCallback(
    (id: string, height: number) => {
      if (!userId) return;
      const bucket = (heightCacheRef.current[String(columnCount)] ??= {});
      const rounded = Math.round(height);
      if (bucket[id] === rounded) return;
      bucket[id] = rounded;
      saveHeights(userId, heightCacheRef.current);
    },
    [userId, columnCount],
  );
  const reservedHeights = heightCache[String(columnCount)] ?? {};

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
    if (loadedUser.current !== user._id) {
      // Separate copies: recording new heights must not mutate this visit's reservations.
      heightCacheRef.current = loadHeights(user._id);
      setHeightCache(loadHeights(user._id));
    }
    const local = loadLayout(user._id);
    const saved = user.dashboardLayout.length
      ? { layout: user.dashboardLayout, columns: user.dashboardColumns }
      : local;
    const nextLayout = normalizeDashboardLayout(
      saved?.layout ?? getDefaultLayout(user.roles),
    ).filter((id) => WIDGETS[id] && isWidgetAllowed(WIDGETS[id], user.roles));
    setArrangement({
      layout: nextLayout,
      columns: normalizeDashboardColumns(
        saved ? saved.columns : getDefaultColumns(user.roles),
        nextLayout,
      ),
    });
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
      if (widget.size === "full") fullIds.push(id);
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

  useEffect(() => {
    if (editing && !editSnapshot.current) editSnapshot.current = arrangement;
    if (!editing) editSnapshot.current = null;
  }, [editing, arrangement]);
  const handleCancel = useCallback(() => {
    if (isSaving || activeId) return;
    if (editSnapshot.current) setArrangement(editSnapshot.current);
    setPickerOpen(false);
    dismissUndo();
    onEditingChange(false);
  }, [isSaving, activeId, dismissUndo, onEditingChange]);
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !activeId &&
        !pickerOpen
      ) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, activeId, pickerOpen, handleCancel]);

  const beginEdit = useCallback(() => {
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
      toast({ title: "Dashboard saved" });
      onEditingChange(false);
    } catch {
      toast({
        title: "Could not save dashboard",
        description: "Your changes are still here. Try again.",
        variant: "destructive",
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
    const fresh = getDefaultLayout(user?.roles).filter((id) =>
      isWidgetAllowed(WIDGETS[id], user?.roles),
    );
    const previous = arrangement;
    setArrangement({
      layout: fresh,
      columns: normalizeDashboardColumns(getDefaultColumns(user?.roles), fresh),
    });
    undoToast.current = toast({
      title: "Default dashboard restored",
      action: (
        <ToastAction
          altText="Undo dashboard reset"
          onClick={() => {
            setArrangement(previous);
            dismissUndo();
          }}
        >
          Undo
        </ToastAction>
      ),
    }).dismiss;
  }, [beginEdit, user?.roles, arrangement, toast, dismissUndo]);
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
      setAddedId(id);
    },
    [beginEdit, heights],
  );
  useEffect(() => {
    if (!addedId || pickerOpen) return;
    const node = document.querySelector<HTMLElement>(
      `[data-dashboard-widget="${addedId}"]`,
    );
    if (!node) return;
    node.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "instant" : "smooth",
    });
    setAddedId(null);
  }, [addedId, pickerOpen, reducedMotion]);
  const handleBalance = useCallback(() => {
    if (!arrangement || !canBalance) return;
    beginEdit();
    const previous = arrangement;
    setArrangement({ ...arrangement, columns: balanced });
    undoToast.current = toast({
      title: "Layout balanced",
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
  const handleDragCancel = useCallback(() => {
    setArrangement(dragSnapshot.current);
    setActiveId(null);
    dragSnapshot.current = null;
  }, []);
  // Keep container membership stable while measuring; commit cross-column moves on drop.
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
        const source = prev.columns.findIndex((items) => items.includes(id));
        const target = String(over.id).startsWith("dashboard-column-")
          ? Number(String(over.id).replace("dashboard-column-", ""))
          : prev.columns.findIndex((items) => items.includes(String(over.id)));
        if (source < 0 || target < 0) return prev;
        const overIndex = prev.columns[target].indexOf(String(over.id));
        const after =
          source !== target &&
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

  if (!layout) {
    return (
      <PageFrame className="pt-0">
        <Skeleton className="h-64" />
      </PageFrame>
    );
  }

  const missingWidgets = availableWidgets.filter((w) => !layout.includes(w.id));
  const activeWidget = activeId ? WIDGETS[activeId] : null;

  const editToolbar = (
    <div className="flex w-full min-w-0 items-center gap-2">
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={Plus}
            aria-label="Add widget"
            disabled={missingWidgets.length === 0 || isSaving}
          >
            <span>
              Add<span className="hidden sm:inline"> widget</span>
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a widget</DialogTitle>
            <DialogDescription>
              Choose a widget to add to your dashboard.
            </DialogDescription>
          </DialogHeader>
          <CardGroup orientation="inline" aria-label="Available widgets">
            {availableWidgets.map((widget) => (
              <Card
                key={widget.id}
                label={`Add ${widget.label}`}
                disabled={layout.includes(widget.id)}
                onClick={() => handleAdd(widget.id)}
              >
                <CardMedia icon={widget.icon} />
                <CardHeader>
                  <CardTitle>
                    {widget.label}
                    {layout.includes(widget.id) ? " · Added" : ""}
                  </CardTitle>
                  <CardDescription>{widget.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </CardGroup>
          <Button
            variant="ghost"
            onClick={() => {
              setPickerOpen(false);
              handleReset();
            }}
          >
            Reset to default
          </Button>
        </DialogContent>
      </Dialog>

      <div className="ml-auto flex items-center gap-2">
        {canBalance ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={Columns2}
            className="hidden md:inline-flex"
            onClick={handleBalance}
            disabled={!canBalance || isSaving || Boolean(activeId)}
            title="Arrange widgets into shorter columns"
          >
            Even out
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={RotateCcw}
          className="hidden sm:inline-flex"
          onClick={handleReset}
          disabled={isSaving || Boolean(activeId)}
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          size="icon-compact"
          onClick={handleCancel}
          disabled={isSaving || Boolean(activeId)}
          aria-label="Cancel dashboard customization"
          title="Cancel"
        >
          <X />
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || Boolean(activeId)}
          size="sm"
          leadingIcon={Save}
          loading={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );

  return (
    <PageFrame className="pb-24 pt-0">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-6">
          {editing
            ? toolbarTarget
              ? createPortal(editToolbar, toolbarTarget)
              : editToolbar
            : null}

          {/* Static / Fixed widgets (cannot be moved or removed) */}
          {fixedIds.map((id) => {
            const widget = WIDGETS[id];
            if (!widget) return null;
            const Component = widget.Component;
            return (
              <div key={id} className={cn(editing ? "opacity-90" : "")}>
                <Component />
              </div>
            );
          })}

          <LazyMotion features={loadMotionFeatures}>
            <LayoutGroup id="dashboard">
              <DndContext
                sensors={sensors}
                accessibility={{
                  announcements: {
                    onDragStart: ({ active }) =>
                      `Picked up ${WIDGETS[String(active.id)]?.label ?? "widget"}.`,
                    onDragOver: ({ active, over }) =>
                      over
                        ? `${WIDGETS[String(active.id)]?.label ?? "Widget"} over ${WIDGETS[String(over.id)]?.label ?? "empty column"}.`
                        : undefined,
                    onDragEnd: ({ active }) =>
                      `Placed ${WIDGETS[String(active.id)]?.label ?? "widget"}.`,
                    onDragCancel: () => "Move canceled.",
                  },
                }}
                collisionDetection={columnCollision}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={fullIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-6">
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
                          hideWhenEmpty={widget.hideWhenEmpty?.(user?.roles)}
                          reservedHeight={reservedHeights[id]}
                          onRemove={handleRemove}
                          onSettled={handleSettled}
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
                                  hideWhenEmpty={widget.hideWhenEmpty?.(
                                    user?.roles,
                                  )}
                                  reservedHeight={reservedHeights[id]}
                                  onRemove={handleRemove}
                                  onMeasure={handleMeasure}
                                  onSettled={handleSettled}
                                />
                              );
                            })}
                          </WidgetColumn>
                        ))}
                      </div>
                    )}

                    {columnIds.length + fullIds.length === 0 ? (
                      <Empty size="inline">
                        <EmptyDescription>
                          Your dashboard is empty.
                        </EmptyDescription>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            editing
                              ? setPickerOpen(true)
                              : onEditingChange(true)
                          }
                        >
                          {editing ? "Add widget" : "Customize"}
                        </Button>
                      </Empty>
                    ) : null}
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
