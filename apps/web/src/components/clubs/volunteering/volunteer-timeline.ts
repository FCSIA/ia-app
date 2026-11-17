import { format, parseISO } from "date-fns";
import type { TimelineEvent } from "@/components/ui/timeline";
import { serviceDateLabel } from "./volunteer-format";

export function volunteerTimeline(log: {
  serviceDate: string;
  submittedAt: number;
  reviewedAt?: number | null;
  status: "PENDING" | "APPROVED" | "DECLINED";
  reviewerName?: string | null;
}): TimelineEvent[] {
  const timestamp = (value: number) => ({ dateTime: new Date(value).toISOString(), label: format(value, "MMM d, yyyy 'at' h:mm a") });
  const events = [
    { order: parseISO(log.serviceDate).getTime(), event: { id: "service", title: "Service date", timestamp: { dateTime: log.serviceDate, label: serviceDateLabel(log.serviceDate) } } },
    { order: log.submittedAt, event: { id: "submitted", title: "Submitted", timestamp: timestamp(log.submittedAt) } },
  ];
  const result: TimelineEvent[] = events.sort((a, b) => a.order - b.order).map(({ event }) => event);
  if (log.status === "PENDING") {
    result.push({ id: "pending", title: "Pending review", status: "current", description: "Awaiting a review decision." });
  } else {
    const decision: TimelineEvent = { id: "decision", title: log.status === "APPROVED" ? "Approved" : "Declined", status: "final", description: `Reviewed by ${log.reviewerName ?? "Former reviewer"}.${log.reviewedAt == null ? " Decision date unavailable." : ""}`, ...(log.reviewedAt == null ? {} : { timestamp: timestamp(log.reviewedAt) }) };
    if (log.reviewedAt == null) result.push(decision);
    else {
      const position = events.filter(({ order }) => order <= log.reviewedAt!).length;
      result.splice(position, 0, decision);
    }
  }
  return result;
}
