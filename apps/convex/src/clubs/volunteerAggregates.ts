import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

export const volunteerLogs = new TableAggregate<{
  Namespace: string;
  Key: ["PENDING" | "APPROVED" | "DECLINED", string];
  DataModel: DataModel;
  TableName: "clubVolunteerLogs";
}>(components.volunteerHours, {
  namespace: (doc) => `logs:${doc.clubId}`,
  sortKey: (doc) => [doc.status, doc.userId],
  sumValue: (doc) => doc.minutes,
});

export const volunteerMembers = new TableAggregate<{
  Namespace: string;
  Key: null;
  DataModel: DataModel;
  TableName: "clubVolunteerTotals";
}>(components.volunteerHours, {
  namespace: (doc) => `members:${doc.clubId}`,
  sortKey: () => null,
});
