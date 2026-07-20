'use client';

import { Copy } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
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
    isBulkEditing,
    setIsBulkEditing,
    handleBulkSaveAdminBlocks,
    setDraftAdminBlocks,
    blocks,
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
            <div className="flex items-center gap-2">
              {canEditOwnSchedule ? (
                <TabsList className="w-full overflow-x-auto sm:w-auto">
                  <TabItem value="my" label="My Schedule" />
                  <TabItem value="friends" label="Friend Schedules" />
                </TabsList>
              ) : null}
              
              {canManageBlocks ? (
                <Toggle
                  pressed={isBulkEditing}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      const drafts: Record<string, any> = {};
                      blocks.forEach(b => drafts[b.id] = b);
                      setDraftAdminBlocks(drafts);
                      setIsBulkEditing(true);
                      setActiveTab('admin');
                    } else {
                      handleBulkSaveAdminBlocks();
                    }
                  }}
                  className="rounded-full px-3 py-1.5 h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:bg-muted data-[state=off]:text-muted-foreground"
                >
                  Manage Blocks
                </Toggle>
              ) : null}
            </div>
            
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
