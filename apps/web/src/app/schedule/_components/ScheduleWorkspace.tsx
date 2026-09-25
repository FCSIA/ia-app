"use client";

import {
  CalendarRange,
  Save,
  Settings2,
  Users,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TabItem, TabPanel, Tabs, TabsList } from "@/components/ui/tabs";
import { FriendSchedulesPanel } from "./FriendSchedulesPanel";
import { ManageBlocksPanel } from "./ManageBlocksPanel";
import { MySchedulePanel } from "./MySchedulePanel";
import { ScheduleGroupsPanel } from "./ScheduleGroupsPanel";
import { ScheduleStatusBar } from "./ScheduleStatusBar";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";
import { ScheduleWorkspaceSkeleton } from "./ScheduleWorkspaceSkeleton";

export function ScheduleWorkspace() {
  const {
    canEditOwnSchedule,
    canManageBlocks,
    handleSaveSchedule,
    isLoading,
    isPublic,
    isScheduleDirty,
    pendingAction,
    selectedTab,
    setActiveTab,
    setIsPublic,
  } = useScheduleWorkspace();

  if (isLoading) {
    return <ScheduleWorkspaceSkeleton />;
  }

  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Schedule
        </h1>
      }
    >
      <PageFrame className="gap-5">
        <Tabs value={selectedTab} onValueChange={setActiveTab}>
          {canEditOwnSchedule ? (
            <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/85 p-4 shadow-xl backdrop-blur-xl">
              <ScheduleStatusBar />

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 overflow-x-auto pb-1 lg:pb-0">
                  <TabsList>
                    <TabItem
                      value="my"
                      label="My schedule"
                      icon={CalendarRange}
                    />
                    <TabItem
                      value="friends"
                      label="Friends"
                      icon={UsersRound}
                    />
                    <TabItem value="groups" label="Groups" icon={Users} />
                    {canManageBlocks ? (
                      <TabItem
                        value="admin"
                        label="Day plans"
                        icon={Settings2}
                      />
                    ) : null}
                  </TabsList>
                </div>

                {selectedTab === "my" ? (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Switch
                    label="Visible to friends"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  {isScheduleDirty ? (
                    <Button
                      size="sm"
                      leadingIcon={Save}
                      loading={pendingAction === "save-schedule"}
                      onClick={handleSaveSchedule}
                    >
                      Save schedule
                    </Button>
                  ) : null}
                  </div>
                ) : null}
              </div>
            </header>
          ) : null}

          {canEditOwnSchedule ? <MySchedulePanel /> : null}
          {canEditOwnSchedule ? <FriendSchedulesPanel /> : null}
          {canEditOwnSchedule ? <ScheduleGroupsPanel /> : null}
          {canManageBlocks ? (
            canEditOwnSchedule ? (
              <TabPanel value="admin" className="mt-5">
                <ManageBlocksPanel />
              </TabPanel>
            ) : (
              <ManageBlocksPanel />
            )
          ) : null}
        </Tabs>
      </PageFrame>
    </AppShell>
  );
}
