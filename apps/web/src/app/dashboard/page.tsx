'use client';

import { useState } from 'react';
import { GripVertical, LayoutGrid, PanelBottom } from 'lucide-react';
import { useMutation } from 'convex/react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardDescription, CardGroup, CardHeader, CardMedia, CardTitle } from '@/components/ui/card';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { Sortable, SortableItem, SortableItemHandle } from '@/components/reui/sortable';
import {
  getMobileTabEditorItems,
  MOBILE_TAB_DESTINATION_MAX,
  MOBILE_TAB_DESTINATION_MIN,
  type MobileTabId,
} from '@/components/layout/app-shell-navigation';
import { computeWrappedAvailability } from '@/lib/wrapped';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

export default function DashboardPage() {
  const [editing, setEditing] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeView, setCustomizeView] = useState<'choice' | 'tab-bar'>('choice');
  const [tabLayout, setTabLayout] = useState<MobileTabId[]>([]);
  const user = useCurrentUser();
  const { toast } = useToast();
  const updateMobileTabLayout = useMutation(api.users.me.updateMobileTabLayout);
  const showSchedule = Boolean(user && hasRole(user, 'STUDENT', 'ADMIN', 'SUPER_ADMIN'));
  const tabOptions = getMobileTabEditorItems({
    pathname: '/dashboard',
    showAdmin: false,
    showSchedule,
    showWrapped: computeWrappedAvailability().open,
  });

  const openTabBarEditor = () => {
    const available = new Set(tabOptions.map((item) => item.mobileTabId));
    const defaults: MobileTabId[] = [
      'announcements',
      'clubs',
      showSchedule ? 'schedule' : 'calendar',
      'events',
    ];
    const saved = user?.mobileTabLayout ?? [];
    setTabLayout(
      [...saved, ...defaults].filter(
        (id, index, ids): id is MobileTabId =>
          available.has(id as MobileTabId) && ids.indexOf(id) === index,
      ).slice(0, MOBILE_TAB_DESTINATION_MAX),
    );
    setCustomizeView('tab-bar');
  };

  const handleCustomizeOpenChange = (open: boolean) => {
    setCustomizeOpen(open);
    if (!open) setCustomizeView('choice');
  };

  const handleSaveTabBar = async () => {
    try {
      await updateMobileTabLayout({ layout: tabLayout });
      setCustomizeOpen(false);
      setCustomizeView('choice');
      toast({ title: 'Tab bar updated' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not update the tab bar',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          {!editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 sm:hidden"
                aria-label="Customize dashboard"
                onClick={() => setCustomizeOpen(true)}
              >
                <LayoutGrid />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden h-8 shrink-0 px-3 sm:inline-flex"
                aria-label="Customize dashboard"
                leadingIcon={LayoutGrid}
                onClick={() => setEditing(true)}
              >
                Customize
              </Button>
            </>
          ) : null}
        </div>
      }
    >
      <DashboardLayout editing={editing} onEditingChange={setEditing} />
      <Dialog open={customizeOpen} onOpenChange={handleCustomizeOpenChange}>
        <DialogContent size="sm">
          {customizeView === 'choice' ? (
            <>
              <DialogHeader>
                <DialogTitle>Customize</DialogTitle>
                <DialogDescription>What would you like to edit?</DialogDescription>
              </DialogHeader>
              <CardGroup orientation="inline" border="outlined">
                <Card
                  label="Edit tab bar"
                  onClick={openTabBarEditor}
                >
                  <CardMedia icon={PanelBottom} />
                  <CardHeader>
                    <CardTitle>Tab bar</CardTitle>
                    <CardDescription>Choose the shortcuts at the bottom of the app.</CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  label="Edit dashboard widgets"
                  onClick={() => {
                    setCustomizeOpen(false);
                    setEditing(true);
                  }}
                >
                  <CardMedia icon={LayoutGrid} />
                  <CardHeader>
                    <CardTitle>Dashboard widgets</CardTitle>
                    <CardDescription>Add, remove, and rearrange dashboard content.</CardDescription>
                  </CardHeader>
                </Card>
              </CardGroup>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Edit tab bar</DialogTitle>
                <DialogDescription>
                  Home and More stay in place. Choose and order four or five other destinations.
                </DialogDescription>
              </DialogHeader>
              <CheckboxGroup
                className="w-full"
                checkedIndices={new Set(
                  tabOptions
                    .map((item, index) => (tabLayout.includes(item.mobileTabId) ? index : -1))
                    .filter((index) => index !== -1),
                )}
              >
                {tabOptions.map((item, index) => (
                  <CheckboxItem
                    key={item.mobileTabId}
                    index={index}
                    label={item.label}
                    checked={tabLayout.includes(item.mobileTabId)}
                    disabled={
                      tabLayout.includes(item.mobileTabId)
                        ? tabLayout.length <= MOBILE_TAB_DESTINATION_MIN
                        : tabLayout.length >= MOBILE_TAB_DESTINATION_MAX
                    }
                    onToggle={() => {
                      setTabLayout((current) =>
                        current.includes(item.mobileTabId)
                          ? current.filter((id) => id !== item.mobileTabId)
                          : [...current, item.mobileTabId],
                      );
                    }}
                  />
                ))}
              </CheckboxGroup>
              {tabLayout.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Tab order</p>
                  <Sortable
                    value={tabLayout}
                    onValueChange={setTabLayout}
                    getItemValue={(id) => id}
                    strategy="vertical"
                    className="divide-y divide-border/50 rounded-xl border border-border/60"
                  >
                    {tabLayout.map((id) => {
                      const item = tabOptions.find((option) => option.mobileTabId === id);
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <SortableItem key={id} value={id} className="bg-card">
                          <div className="flex min-h-11 items-center gap-2 px-2 py-1">
                            <SortableItemHandle
                              render={<Button type="button" variant="ghost" size="icon-compact" aria-label={`Drag ${item.label} to reorder`} />}
                            >
                              <GripVertical />
                            </SortableItemHandle>
                            <Icon className="size-4 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                          </div>
                        </SortableItem>
                      );
                    })}
                  </Sortable>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="tertiary" onClick={() => setCustomizeView('choice')}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={
                    tabLayout.length < MOBILE_TAB_DESTINATION_MIN ||
                    tabLayout.length > MOBILE_TAB_DESTINATION_MAX
                  }
                  onClick={() => void handleSaveTabBar()}
                >
                  Save tab bar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
