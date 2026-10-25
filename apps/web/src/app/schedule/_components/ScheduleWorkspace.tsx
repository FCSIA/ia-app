"use client";

import { Save } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FriendSchedulesPanel } from "./FriendSchedulesPanel";
import { ManageBlocksPanel } from "./ManageBlocksPanel";
import { MySchedulePanel } from "./MySchedulePanel";
import { ScheduleGroupsPanel } from "./ScheduleGroupsPanel";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";
import { ScheduleWorkspaceSkeleton } from "./ScheduleWorkspaceSkeleton";

export function ScheduleWorkspace() {
  const searchParams = useSearchParams();
  const {
    canEditOwnSchedule,
    canManageBlocks,
    handleSaveSchedule,
    isLoading,
    isPublic,
    isScheduleDirty,
    pendingAction,
    selectedTab,
    setIsPublic,
  } = useScheduleWorkspace();
  const requestedSection = searchParams?.get("section");
  const section = requestedSection === "templates" || requestedSection === "config" ? requestedSection : "dates";
  const heading = selectedTab === "friends" ? "Friends" : selectedTab === "groups" ? "Friend Groups" : selectedTab === "admin" ? ({ dates: "Calendar dates", templates: "Templates", config: "School config" }[section]) : "Schedule";

  if (isLoading) return <ScheduleWorkspaceSkeleton />;

  return (
    <AppShell
      scheduleTab={selectedTab}
      scheduleSection={section}
      pageNavigation={canManageBlocks ? {
        parentHref: "/schedule",
        label: "Day plans",
        items: (["dates", "templates", "config"] as const).map((item) => {
          const params = new URLSearchParams(searchParams?.toString());
          params.set("tab", "admin");
          params.set("section", item);
          return {
            href: `/schedule?${params}`,
            label: { dates: "Calendar dates", templates: "Templates", config: "School config" }[item],
            isActive: selectedTab === "admin" && section === item,
          };
        }),
      } : undefined}
      headerSlot={<h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{heading}</h1>}
    >
      <PageFrame className="gap-5">
        {canEditOwnSchedule && selectedTab === "my" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Switch label="Visible to friends" checked={isPublic} onCheckedChange={setIsPublic} />
              {isScheduleDirty ? (
                <Button size="sm" leadingIcon={Save} loading={pendingAction === "save-schedule"} onClick={handleSaveSchedule}>Save schedule</Button>
              ) : null}
            </div>
            <MySchedulePanel />
          </>
        ) : null}
        {canEditOwnSchedule && selectedTab === "friends" ? <FriendSchedulesPanel /> : null}
        {canEditOwnSchedule && selectedTab === "groups" ? <ScheduleGroupsPanel /> : null}
        {canManageBlocks && selectedTab === "admin" ? <ManageBlocksPanel /> : null}
      </PageFrame>
    </AppShell>
  );
}
