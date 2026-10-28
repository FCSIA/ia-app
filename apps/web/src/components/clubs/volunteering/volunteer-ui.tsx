"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation, useQuery } from "@/lib/convex-react";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type VolunteerLog = FunctionReturnType<
  typeof api.clubs.volunteering.listMine
>["page"][number];
export type PageStatus =
  "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

// Display the stored integer minutes exactly, including one-minute entries.
export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours ? `${hours} hr ` : ""}${remainder} min`
    : `${hours} hr`;
}

export function serviceDateLabel(date: string) {
  return format(parseISO(date), "MMM d, yyyy");
}

export function VolunteerStatus({
  status,
}: {
  status: VolunteerLog["status"];
}) {
  return (
    <Badge
      size="sm"
      color={
        status === "APPROVED"
          ? "green"
          : status === "DECLINED"
            ? "red"
            : "amber"
      }
    >
      {status === "APPROVED"
        ? "Approved"
        : status === "DECLINED"
          ? "Declined"
          : "Pending"}
    </Badge>
  );
}

export function VolunteerMetrics({
  items,
}: {
  items: { label: string; value: string; detail?: string }[];
}) {
  return (
    <div className="@container">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 @2xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground @2xl:text-2xl">
              {item.value}
            </dd>
            {item.detail ? (
              <dd className="text-xs text-muted-foreground">{item.detail}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VolunteerEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}

export function VolunteerLoading() {
  return (
    <div
      role="status"
      aria-label="Loading volunteer hours"
      className="flex flex-col gap-3 py-4"
    >
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function LoadVolunteerPage({
  status,
  onLoadMore,
}: {
  status: PageStatus;
  onLoadMore: () => void;
}) {
  return status === "CanLoadMore" || status === "LoadingMore" ? (
    <div className="flex justify-center pt-3">
      <Button
        variant="tertiary"
        loading={status === "LoadingMore"}
        onClick={onLoadMore}
      >
        Load more
      </Button>
    </div>
  ) : null;
}

export function VolunteerLogTable({
  logs,
  status,
  showMember = false,
  review = false,
  emptyTitle,
  onInspect,
  onLoadMore,
}: {
  logs: VolunteerLog[];
  status: PageStatus;
  showMember?: boolean;
  review?: boolean;
  emptyTitle?: string;
  onInspect: (
    logId: Id<"clubVolunteerLogs">,
    trigger: HTMLButtonElement,
  ) => void;
  onLoadMore: () => void;
}) {
  const user = useCurrentUser();
  if (status === "LoadingFirstPage") return <VolunteerLoading />;
  if (!logs.length)
    return (
      <VolunteerEmpty
        title={
          emptyTitle ?? (review ? "You're all caught up" : "No submissions yet")
        }
        description={
          emptyTitle
            ? undefined
            : review
              ? "New submissions will appear here for review."
              : "Submitted service hours will appear here."
        }
      />
    );
  return (
    <div className="@container min-w-0">
      <div className="overflow-x-auto">
        <Table
          aria-label={
            review
              ? "Volunteer submissions needing review"
              : "Volunteer submission history"
          }
        >
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead className="hidden @lg:table-cell">
                Service date
              </TableHead>
              <TableHead className="hidden text-right @lg:table-cell">
                Time
              </TableHead>
              {!review ? (
                <TableHead className="hidden @2xl:table-cell">Status</TableHead>
              ) : null}
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, index) => (
              <TableRow key={log._id} index={index}>
                <TableCell>
                  <div className="flex min-w-0 flex-col items-start gap-1 [overflow-wrap:anywhere]">
                    <span className="font-medium text-foreground">
                      {log.activity}
                    </span>
                    {showMember ? <span>{log.studentName}</span> : null}
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs @lg:hidden">
                      <time dateTime={log.serviceDate}>
                        {serviceDateLabel(log.serviceDate)}
                      </time>
                      <span className="tabular-nums">
                        {durationLabel(log.minutes)}
                      </span>
                    </div>
                    {!review ? (
                      <span className="@2xl:hidden">
                        <VolunteerStatus status={log.status} />
                      </span>
                    ) : null}
                    {log.reviewerNote ? (
                      <span className="line-clamp-2 text-xs">
                        {log.reviewerNote}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap @lg:table-cell">
                  <time dateTime={log.serviceDate}>
                    {serviceDateLabel(log.serviceDate)}
                  </time>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-right tabular-nums @lg:table-cell">
                  {durationLabel(log.minutes)}
                </TableCell>
                {!review ? (
                  <TableCell className="hidden @2xl:table-cell">
                    <VolunteerStatus status={log.status} />
                  </TableCell>
                ) : null}
                <TableCell className="w-px text-right">
                  <Button
                    type="button"
                    variant="tertiary"
                    aria-label={`${review && log.userId !== user?._id ? "Review" : "View"} ${log.activity}${showMember ? ` by ${log.studentName}` : ""}`}
                    onClick={(event) => onInspect(log._id, event.currentTarget)}
                  >
                    {review && log.userId !== user?._id ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <LoadVolunteerPage status={status} onLoadMore={onLoadMore} />
    </div>
  );
}

export function VolunteerProof({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <VolunteerEmpty
      title="Photo unavailable"
      description="The proof photo could not be loaded. Try reopening this submission."
    />
  ) : (
    <Image
      unoptimized
      src={src}
      alt={alt}
      width={800}
      height={600}
      className="mx-auto h-auto max-h-[40dvh] w-auto max-w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function VolunteerLogDialog({
  clubId,
  logId,
  canReview,
  onClose,
  returnFocus,
}: {
  clubId: Id<"clubs">;
  logId: Id<"clubVolunteerLogs"> | null;
  canReview: boolean;
  onClose: () => void;
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const log = useQuery(
    api.clubs.volunteering.getLog,
    logId ? { clubId, logId } : "skip",
  );
  const user = useCurrentUser();
  const review = useMutation(api.clubs.volunteering.review);
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "DECLINED" | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reviewable =
    log?.status === "PENDING" && canReview && log.userId !== user?._id;

  function close() {
    onClose();
    setNote("");
    setError("");
  }
  async function decide(decision: "APPROVED" | "DECLINED") {
    if (!log || busy) return;
    if (decision === "DECLINED" && !note.trim()) {
      setError("Add a reason before declining.");
      noteRef.current?.focus();
      return;
    }
    setBusy(decision);
    setError("");
    try {
      await review({ clubId, logId: log._id, decision, note });
      close();
      toast({
        title:
          decision === "APPROVED" ? "Hours approved" : "Submission declined",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not review this submission.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={logId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        size="lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="break-words">
            {log?.activity ?? "Volunteer submission"}
          </DialogTitle>
          <DialogDescription>
            {log
              ? `${log.studentName} · ${serviceDateLabel(log.serviceDate)} · ${durationLabel(log.minutes)}`
              : "Submission details and proof photo"}
          </DialogDescription>
        </DialogHeader>
        {log === undefined ? (
          <VolunteerLoading />
        ) : !log ? (
          <VolunteerEmpty title="Submission unavailable" />
        ) : (
          <>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <VolunteerStatus status={log.status} />
                <span className="text-xs text-muted-foreground">
                  Submitted {format(log.submittedAt, "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              {log.notes ? (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {log.notes}
                </p>
              ) : null}
              {log.proofAvailable ? (
                <VolunteerProof
                  key={log._id}
                  src={`/api/clubs/volunteer-proof/${log._id}`}
                  alt={`Proof for ${log.activity}`}
                />
              ) : (
                <VolunteerEmpty title="Proof photo unavailable" />
              )}
              {log.reviewedAt ? (
                <div className="flex flex-col gap-1 text-sm">
                  <p className="text-muted-foreground">
                    {log.status === "APPROVED" ? "Approved" : "Declined"} by{" "}
                    {log.reviewerName ?? "Former reviewer"} ·{" "}
                    {format(log.reviewedAt, "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {log.reviewerNote ? (
                    <p className="whitespace-pre-wrap break-words">
                      {log.reviewerNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {reviewable ? (
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="volunteer-review-note">
                    Review note
                  </FieldLabel>
                  <Textarea
                    ref={noteRef}
                    id="volunteer-review-note"
                    rows={3}
                    value={note}
                    maxLength={500}
                    disabled={busy !== null}
                    aria-invalid={!!error}
                    aria-describedby="volunteer-review-help"
                    onChange={(event) => {
                      setNote(event.target.value);
                      setError("");
                    }}
                  />
                  <FieldDescription id="volunteer-review-help">
                    Required when declining. The member can read this note.
                  </FieldDescription>
                </Field>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              {reviewable ? (
                <>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={busy !== null}
                    loading={busy === "DECLINED"}
                    onClick={() => void decide("DECLINED")}
                  >
                    Decline
                  </Button>
                  <Button
                    type="button"
                    disabled={busy !== null}
                    loading={busy === "APPROVED"}
                    onClick={() => void decide("APPROVED")}
                  >
                    Approve hours
                  </Button>
                </>
              ) : (
                <Button type="button" variant="tertiary" onClick={close}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
