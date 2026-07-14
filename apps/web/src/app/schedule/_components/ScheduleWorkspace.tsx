'use client';

import { Copy } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import { FriendSchedulesPanel } from './FriendSchedulesPanel';
import { ManageBlocksPanel } from './ManageBlocksPanel';
import { MySchedulePanel } from './MySchedulePanel';
import { ScheduleStatusBar } from './ScheduleStatusBar';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';
import { ScheduleWorkspaceSkeleton } from './ScheduleWorkspaceSkeleton';

export function ScheduleWorkspace() {
  const {
    canEditOwnSchedule,
    canManageBlocks,
    copyMondayToWeek,
    handleSaveSchedule,
    isLoading,
    isPublic,
    pendingAction,
    selectedTab,
    setActiveTab,
    setIsPublic,
  } = useScheduleWorkspace();

  if (isLoading) {
    return <ScheduleWorkspaceSkeleton />;
  }

  return (
    <AppShell>
      <PageFrame>
        {canEditOwnSchedule ? <ScheduleStatusBar /> : null}

        <Tabs value={selectedTab} onValueChange={setActiveTab}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full overflow-x-auto sm:w-auto">
              {canEditOwnSchedule ? <TabItem value="my" label="My Schedule" /> : null}
              {canEditOwnSchedule ? <TabItem value="friends" label="Friend Schedules" /> : null}
              {canManageBlocks ? <TabItem value="admin" label="Manage Blocks" /> : null}
            </TabsList>
            {selectedTab === 'my' && canEditOwnSchedule ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Public</span>
                  <Switch
                    label=""
                    aria-label="Public schedule"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    wrapperClassName="scale-[0.85]"
                  />
                </div>
                <span className="text-border">|</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={copyMondayToWeek}
                >
                  <Copy className="mr-1.5 size-3" />
                  Copy Mon
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveSchedule}
                  disabled={pendingAction === 'save-schedule'}
                >
                  {pendingAction === 'save-schedule' ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : null}
          </div>

          {canEditOwnSchedule ? <MySchedulePanel /> : null}
          {canEditOwnSchedule ? <FriendSchedulesPanel /> : null}
          {canManageBlocks ? <ManageBlocksPanel /> : null}
        </Tabs>
      </PageFrame>
    </AppShell>
  );
}
