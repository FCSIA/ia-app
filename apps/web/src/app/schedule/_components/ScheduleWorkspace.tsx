"use client";

import { Save } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { routePath } from "@/lib/routes";
import { DAY_PLAN_SECTIONS, dayPlanHref, resolveDayPlanSection } from "@/components/schedule/schedule-utils";
import { SCHEDULE_FRIENDS_HREF } from "~/apps/shared/routes";
import { FriendsDayPanel } from "./FriendsDayPanel";
import { ManageBlocksPanel } from "./ManageBlocksPanel";
import { MySchedulePanel } from "./MySchedulePanel";
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
  const section = resolveDayPlanSection(searchParams?.get("section"));
  const heading = selectedTab === "friends"
    ? "Friends"
    : selectedTab === "admin"
      ? DAY_PLAN_SECTIONS.find((item) => item.id === section)!.label
      : "Schedule";

  if (isLoading) return <ScheduleWorkspaceSkeleton />;

  return (
    <AppShell
      activeHref={selectedTab === "friends" ? SCHEDULE_FRIENDS_HREF : routePath("schedule")}
      pageNavigation={canManageBlocks ? {
        parentHref: routePath("schedule"),
        label: "Day plans",
        items: DAY_PLAN_SECTIONS.map((item) => ({
          href: dayPlanHref(item.id, searchParams),
          label: item.label,
          isActive: selectedTab === "admin" && section === item.id,
        })),
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
        {canEditOwnSchedule && selectedTab === "friends" ? <FriendsDayPanel /> : null}
        {canManageBlocks && selectedTab === "admin" ? <ManageBlocksPanel /> : null}
      </PageFrame>
    </AppShell>
  );
}
