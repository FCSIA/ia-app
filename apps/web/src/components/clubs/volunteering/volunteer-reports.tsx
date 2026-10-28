"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "@/lib/convex-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  durationLabel,
  LoadVolunteerPage,
  VolunteerEmpty,
  VolunteerLoading,
  VolunteerLogTable,
  VolunteerMetrics,
  type VolunteerLog,
} from "./volunteer-ui";

export type InspectVolunteerLog = (
  logId: Id<"clubVolunteerLogs">,
  trigger: HTMLButtonElement,
) => void;

function entryLabel(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

export function ClubVolunteerSummary({ clubId }: { clubId: Id<"clubs"> }) {
  const summary = useQuery(api.clubs.volunteering.getClubSummary, { clubId });
  const prepare = useMutation(api.clubs.volunteering.prepareAnalytics);
  const started = useRef<Id<"clubs"> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (summary?.ready === false && started.current !== clubId) {
      started.current = clubId;
      void prepare({ clubId }).catch(() =>
        setError("Could not prepare the club report. Try again."),
      );
    }
  }, [clubId, prepare, summary?.ready]);
  if (!summary?.ready)
    return (
      <div aria-live="polite">
        {error ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              variant="tertiary"
              onClick={() => {
                setError("");
                void prepare({ clubId }).catch(() =>
                  setError("Could not prepare the club report. Try again."),
                );
              }}
            >
              Retry report
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {summary ? "Preparing club reports…" : "Loading club totals…"}
            </p>
            <VolunteerLoading />
          </>
        )}
      </div>
    );
  return (
    <section aria-label="All-time club totals" className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        All-time club totals
      </h2>
      <VolunteerMetrics
        items={[
          {
            label: "Approved time",
            value: durationLabel(summary.approvedMinutes),
            detail: entryLabel(summary.approvedCount),
          },
          {
            label: "Awaiting review",
            value: durationLabel(summary.pendingMinutes),
            detail: entryLabel(summary.pendingCount),
          },
          {
            label: "Declined time",
            value: durationLabel(summary.declinedMinutes),
            detail: entryLabel(summary.declinedCount),
          },
          {
            label: "Contributors",
            value: String(summary.volunteerCount),
            detail: `${entryLabel(summary.approvedCount + summary.pendingCount + summary.declinedCount)} submitted`,
          },
        ]}
      />
    </section>
  );
}

export function VolunteerHistory({
  clubId,
  userId,
  onInspect,
}: {
  clubId: Id<"clubs">;
  userId?: Id<"users">;
  onInspect: InspectVolunteerLog;
}) {
  const [status, setStatus] = useState<"ALL" | VolunteerLog["status"]>("ALL");
  const history = usePaginatedQuery(
    api.clubs.volunteering.listHistory,
    { clubId, userId, ...(status === "ALL" ? {} : { status }) },
    { initialNumItems: 25 },
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {userId ? "Submissions" : "Submission history"}
        </h2>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as typeof status)}
        >
          <SelectTrigger
            aria-label="Filter submission history by status"
            className="w-40"
          />
          <SelectContent>
            <SelectGroup>
              <SelectItem index={0} value="ALL">
                All statuses
              </SelectItem>
              <SelectItem index={1} value="PENDING">
                Pending
              </SelectItem>
              <SelectItem index={2} value="APPROVED">
                Approved
              </SelectItem>
              <SelectItem index={3} value="DECLINED">
                Declined
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <VolunteerLogTable
        logs={history.results}
        status={history.status}
        showMember={!userId}
        emptyTitle={
          status === "ALL" ? undefined : "No submissions with this status"
        }
        onInspect={onInspect}
        onLoadMore={() => history.loadMore(25)}
      />
    </div>
  );
}

function MemberVolunteerReport({
  clubId,
  userId,
  onInspect,
  onBack,
}: {
  clubId: Id<"clubs">;
  userId: Id<"users">;
  onInspect: InspectVolunteerLog;
  onBack: () => void;
}) {
  const member = useQuery(api.clubs.volunteering.getMemberSummary, {
    clubId,
    userId,
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <Button variant="ghost" leadingIcon={ArrowLeft} onClick={onBack}>
          Back to members
        </Button>
        {member ? (
          <div>
            <h2 className="text-lg font-semibold">{member.studentName}</h2>
            <p className="text-sm text-muted-foreground">
              {member.uniqueId} · All-time volunteer hours
            </p>
          </div>
        ) : (
          <VolunteerLoading />
        )}
      </div>
      {member ? (
        <VolunteerMetrics
          items={[
            {
              label: "Approved",
              value: durationLabel(member.approvedMinutes),
              detail: entryLabel(member.approvedCount),
            },
            {
              label: "Pending",
              value: durationLabel(member.pendingMinutes),
              detail: entryLabel(member.pendingCount),
            },
            {
              label: "Declined",
              value: durationLabel(member.declinedMinutes),
              detail: entryLabel(member.declinedCount),
            },
            {
              label: "Submissions",
              value: String(
                member.approvedCount +
                  member.pendingCount +
                  member.declinedCount,
              ),
            },
          ]}
        />
      ) : null}
      <VolunteerHistory
        key={userId}
        clubId={clubId}
        userId={userId}
        onInspect={onInspect}
      />
    </div>
  );
}

export function VolunteerMemberReports({
  clubId,
  onInspect,
}: {
  clubId: Id<"clubs">;
  onInspect: InspectVolunteerLog;
}) {
  const summary = useQuery(api.clubs.volunteering.getClubSummary, { clubId });
  const members = usePaginatedQuery(
    api.clubs.volunteering.listMemberTotals,
    summary?.ready ? { clubId } : "skip",
    { initialNumItems: 25 },
  );
  const [selectedMember, setSelectedMember] = useState<Id<"users"> | null>(
    null,
  );
  if (selectedMember)
    return (
      <MemberVolunteerReport
        clubId={clubId}
        userId={selectedMember}
        onInspect={onInspect}
        onBack={() => setSelectedMember(null)}
      />
    );
  if (!summary?.ready || members.status === "LoadingFirstPage")
    return <VolunteerLoading />;
  if (!members.results.length)
    return (
      <VolunteerEmpty
        title="No volunteer submissions yet"
        description="Member totals will appear after someone logs service hours."
      />
    );
  return (
    <section className="@container flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Member totals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All-time totals for people who have submitted service hours.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table aria-label="Volunteer hours by member">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="hidden text-right @lg:table-cell">
                Approved
              </TableHead>
              <TableHead className="hidden text-right @lg:table-cell">
                Pending
              </TableHead>
              <TableHead className="hidden text-right @2xl:table-cell">
                Declined
              </TableHead>
              <TableHead className="hidden text-right @2xl:table-cell">
                Entries
              </TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.results.map((member, index) => (
              <TableRow key={member._id} index={index}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
                    <span className="font-medium text-foreground">
                      {member.studentName}
                    </span>
                    <span className="text-xs">{member.uniqueId}</span>
                    <div className="flex flex-col gap-1 text-xs @lg:hidden">
                      <span>
                        Approved: {durationLabel(member.approvedMinutes)}
                      </span>
                      <span>
                        Pending: {durationLabel(member.pendingMinutes)}
                      </span>
                      <span>
                        Declined: {durationLabel(member.declinedMinutes)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-right tabular-nums @lg:table-cell">
                  {durationLabel(member.approvedMinutes)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-right tabular-nums @lg:table-cell">
                  {durationLabel(member.pendingMinutes)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-right tabular-nums @2xl:table-cell">
                  {durationLabel(member.declinedMinutes)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums @2xl:table-cell">
                  {member.approvedCount +
                    member.pendingCount +
                    member.declinedCount}
                </TableCell>
                <TableCell className="w-px text-right">
                  <Button
                    variant="tertiary"
                    aria-label={`View volunteer report for ${member.studentName}`}
                    onClick={() => setSelectedMember(member.userId)}
                  >
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <LoadVolunteerPage
        status={members.status}
        onLoadMore={() => members.loadMore(25)}
      />
    </section>
  );
}
