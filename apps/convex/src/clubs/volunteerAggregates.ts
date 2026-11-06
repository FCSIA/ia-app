import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import type { ApprovalStatus } from "../validators";

/** Aggregate namespaces are per club; callers must not rebuild these strings. */
export const logsNamespace = (clubId: Id<"clubs">) => `logs:${clubId}`;
export const membersNamespace = (clubId: Id<"clubs">) => `members:${clubId}`;

export const volunteerLogs = new TableAggregate<{
  Namespace: string;
  Key: [ApprovalStatus, string];
  DataModel: DataModel;
  TableName: "clubVolunteerLogs";
}>(components.volunteerHours, {
  namespace: (doc) => logsNamespace(doc.clubId),
  sortKey: (doc) => [doc.status, doc.userId],
  sumValue: (doc) => doc.minutes,
});

export const volunteerMembers = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: "clubVolunteerTotals";
}>(components.volunteerHours, {
  namespace: (doc) => membersNamespace(doc.clubId),
  sortKey: () => null,
});
