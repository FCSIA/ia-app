'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, RotateCcw, Save, X } from 'lucide-react';
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

export function DashboardLayout() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [layout, setLayout] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load persisted layout once user is known
  useEffect(() => {
    if (!user) {
      // Still render a sensible default while logged-out/loading
      setLayout(getDefaultLayout(undefined));
      return;
    }
    const persisted = loadLayout(user.id);
    const initial = persisted ?? getDefaultLayout(user.roles);
    // Filter out widget IDs the user no longer has access to, or that were removed
    const cleaned = initial.filter((id) => {
      const widget = WIDGETS[id];
      return widget && isWidgetAllowed(widget, user.roles);
    });
    setLayout(cleaned);
  }, [user]);

  const availableWidgets = useMemo(
    () => getAvailableWidgets(user?.roles),
    [user?.roles],
  );

  const handleSave = useCallback(() => {
    if (user && layout) {
      saveLayout(user.id, layout);
      toast({ title: 'Dashboard saved' });
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

  const moveWidget = useCallback((id: string, direction: -1 | 1) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  if (!layout) {
    return (
      <PageFrame className="pt-0">
        <div className="h-64 animate-pulse rounded-[2rem] bg-muted/30" />
      </PageFrame>
    );
  }

  const missingWidgets = availableWidgets.filter((w) => !layout.includes(w.id));

  return (
    <PageFrame className="pt-0">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Your day at a glance — rearrange widgets to make it your own.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
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
                  <div className="mt-2 grid gap-2">
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

              <Button variant="ghost" className="rounded-2xl" onClick={handleReset}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
              <Button className="rounded-2xl" onClick={handleSave}>
                <Save className="size-4" />
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => setEditing(true)}
            >
              <LayoutGrid className="size-4" />
              Customize
            </Button>
          )}
        </div>
      </div>

      {/* Widget grid — dense packing so short widgets backfill empty cells,
          items-start so each widget sits at the top of its row instead of
          stretching to match a taller neighbor. */}
      <div className="grid grid-flow-row-dense items-start gap-6 xl:grid-cols-2">
        {layout.map((id, index) => {
          const widget = WIDGETS[id];
          if (!widget) return null;
          const Component = widget.Component;
          const spanFull = widget.size === 'full';

          return (
            <div
              key={id}
              className={cn(
                'relative',
                spanFull ? 'xl:col-span-2' : '',
                editing ? 'rounded-[2rem] ring-1 ring-dashed ring-border/70 p-1' : '',
              )}
            >
              {editing && (
                <div className="absolute -top-3 left-4 right-4 z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                    <LayoutGrid className="size-3" />
                    {widget.label}
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => moveWidget(id, -1)}
                      disabled={index === 0}
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidget(id, 1)}
                      disabled={index === layout.length - 1}
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(id)}
                      className="ml-1 rounded-full bg-destructive/10 p-1 text-destructive transition-colors hover:bg-destructive/20"
                      aria-label="Remove widget"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              )}
              <div className={editing ? 'opacity-90' : ''}>
                <Component />
              </div>
            </div>
          );
        })}

        {layout.length === 0 && (
          <div className="xl:col-span-2 rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
            <LayoutGrid className="mx-auto mb-3 size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Your dashboard is empty.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click <span className="font-semibold">Customize</span> then{' '}
              <span className="font-semibold">Add widget</span> to build it up.
            </p>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export default DashboardLayout;
