"use client";

import { useRef, useState } from "react";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { api } from "~/apps/convex/src/_generated/api";
import { usePaginatedQuery, useQuery } from "@/lib/convex-react";
import { useClubId } from "../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VolunteerSubmission } from "@/components/clubs/volunteering/volunteer-submission";
import {
  ClubVolunteerSummary,
  VolunteerHistory,
  VolunteerMemberReports,
} from "@/components/clubs/volunteering/volunteer-reports";
import {
  VolunteerEmpty,
  VolunteerLoading,
  VolunteerLogDialog,
  VolunteerLogTable,
  VolunteerMetrics,
} from "@/components/clubs/volunteering/volunteer-ui";
import { durationLabel } from "@/components/clubs/volunteering/volunteer-format";

function MyVolunteerHours({
  clubId,
  onInspect,
}: {
  clubId: Id<"clubs">;
  onInspect: (id: Id<"clubVolunteerLogs">, trigger: HTMLButtonElement) => void;
}) {
  const summary = useQuery(api.clubs.volunteering.getMySummary, { clubId });
  const mine = usePaginatedQuery(
    api.clubs.volunteering.listMine,
    { clubId },
    { initialNumItems: 25 },
  );
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {summary ? (
        <VolunteerMetrics
          items={[
            {
              label: "Approved time",
              value: durationLabel(summary.approvedMinutes),
              detail: `${summary.approvedCount} approved ${summary.approvedCount === 1 ? "entry" : "entries"}`,
            },
            {
              label: "Awaiting review",
              value: durationLabel(summary.pendingMinutes),
              detail: `${summary.pendingCount} pending ${summary.pendingCount === 1 ? "entry" : "entries"}`,
            },
            { label: "Declined entries", value: String(summary.declinedCount) },
            {
              label: "Total entries",
              value: String(
                summary.approvedCount +
                  summary.pendingCount +
                  summary.declinedCount,
              ),
            },
          ]}
        />
      ) : (
        <VolunteerLoading />
      )}
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-semibold">My submissions</h2>
        <VolunteerLogTable
          logs={mine.results}
          status={mine.status}
          onInspect={onInspect}
          onLoadMore={() => mine.loadMore(25)}
        />
      </section>
    </div>
  );
}

function VolunteerReviewQueue({
  clubId,
  onInspect,
}: {
  clubId: Id<"clubs">;
  onInspect: (id: Id<"clubVolunteerLogs">, trigger: HTMLButtonElement) => void;
}) {
  const pending = usePaginatedQuery(
    api.clubs.volunteering.listPending,
    { clubId },
    { initialNumItems: 25 },
  );
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-semibold">Needs review</h2>
      <VolunteerLogTable
        review
        showMember
        logs={pending.results}
        status={pending.status}
        onInspect={onInspect}
        onLoadMore={() => pending.loadMore(25)}
      />
    </section>
  );
}

export default function VolunteeringPage() {
  const clubId = useClubId();
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  });
  const [selected, setSelected] = useState<Id<"clubVolunteerLogs"> | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement | null>(null);
  const enabled = navigation?.club.volunteerTrackingEnabled ?? false;
  const isMember = navigation?.viewer.isMember ?? false;
  const canReview = navigation?.viewer.canReviewVolunteerHours ?? false;
  const inspect = (id: Id<"clubVolunteerLogs">, button: HTMLButtonElement) => {
    trigger.current = button;
    setSelected(id);
  };

  return (
    <ClubWorkspace title="Volunteering">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {navigation === undefined ? (
          <VolunteerLoading />
        ) : !enabled ? (
          <VolunteerEmpty
            title="Volunteer tracking is off"
            description="A club manager can enable it in club settings."
          />
        ) : !isMember && !canReview ? (
          <VolunteerEmpty title="Join this club to log service hours" />
        ) : (
          <>
            {isMember ? (
              <div className="flex justify-end">
                <VolunteerSubmission clubId={clubId} />
              </div>
            ) : null}
            {canReview ? (
              <>
                <ClubVolunteerSummary clubId={clubId} />
                <Separator />
                <Tabs
                  defaultValue="review"
                  className="flex min-w-0 flex-col gap-5"
                >
                  <div className="max-w-full overflow-x-auto">
                    <TabsList aria-label="Volunteer hours views">
                      <TabItem value="review" label="Review" />
                      <TabItem value="members" label="Members" />
                      <TabItem value="history" label="History" />
                      {isMember ? (
                        <TabItem value="mine" label="My hours" />
                      ) : null}
                    </TabsList>
                  </div>
                  <TabPanel value="review">
                    <VolunteerReviewQueue clubId={clubId} onInspect={inspect} />
                  </TabPanel>
                  <TabPanel value="members">
                    <VolunteerMemberReports
                      clubId={clubId}
                      onInspect={inspect}
                    />
                  </TabPanel>
                  <TabPanel value="history">
                    <VolunteerHistory clubId={clubId} onInspect={inspect} />
                  </TabPanel>
                  {isMember ? (
                    <TabPanel value="mine">
                      <MyVolunteerHours clubId={clubId} onInspect={inspect} />
                    </TabPanel>
                  ) : null}
                </Tabs>
              </>
            ) : (
              <MyVolunteerHours clubId={clubId} onInspect={inspect} />
            )}
          </>
        )}
      </div>
      <VolunteerLogDialog
        clubId={clubId}
        logId={selected}
        canReview={canReview}
        onClose={() => setSelected(null)}
        returnFocus={trigger}
      />
    </ClubWorkspace>
  );
}
