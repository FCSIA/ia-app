"use client";

import { CalendarRange, Copy, Save, Settings2, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { FriendSchedulesPanel } from "./FriendSchedulesPanel";
import { ManageBlocksPanel } from "./ManageBlocksPanel";
import { MySchedulePanel } from "./MySchedulePanel";
import { ScheduleStatusBar } from "./ScheduleStatusBar";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";
import { ScheduleWorkspaceSkeleton } from "./ScheduleWorkspaceSkeleton";

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
      <PageFrame className="gap-5">
        <Tabs value={selectedTab} onValueChange={setActiveTab}>
          <header className="flex flex-col gap-4 border-b border-border/60 pb-4">
            {canEditOwnSchedule ? <ScheduleStatusBar /> : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {canEditOwnSchedule || canManageBlocks ? (
                <div className="min-w-0 overflow-x-auto pb-1 lg:pb-0">
                  <TabsList className="w-max min-w-full lg:min-w-0">
                    {canEditOwnSchedule ? (
                      <TabItem
                        value="my"
                        label="My week"
                        icon={CalendarRange}
                      />
                    ) : null}
                    {canEditOwnSchedule ? (
                      <TabItem
                        value="friends"
                        label="Friends"
                        icon={UsersRound}
                      />
                    ) : null}
                    {canManageBlocks ? (
                      <TabItem
                        value="admin"
                        label="Day plans"
                        icon={Settings2}
                      />
                    ) : null}
                  </TabsList>
                </div>
              ) : null}

              {selectedTab === "my" && canEditOwnSchedule ? (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Switch
                    label="Visible to friends"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={Copy}
                    onClick={copyMondayToWeek}
                  >
                    Copy Monday
                  </Button>
                  <Button
                    size="sm"
                    leadingIcon={Save}
                    loading={pendingAction === "save-schedule"}
                    onClick={handleSaveSchedule}
                  >
                    Save schedule
                  </Button>
                </div>
              ) : null}
            </div>
          </header>

          {canEditOwnSchedule ? <MySchedulePanel /> : null}
          {canEditOwnSchedule ? <FriendSchedulesPanel /> : null}
          {canManageBlocks ? <ManageBlocksPanel /> : null}
        </Tabs>
      </PageFrame>
    </AppShell>
  );
}
