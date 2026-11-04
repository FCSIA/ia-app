import type { Doc } from '~/apps/convex/src/_generated/dataModel';
import {
  STAFF_FEEDBACK_STATUS_LABELS,
  SUBMITTER_FEEDBACK_STATUS_LABELS,
} from '~/apps/shared/feedback-status';
import { Badge } from '@/components/ui/badge';

type ReportStatus = Doc<'moderationReports'>['status'];

/**
 * Review states share the app's review colors (see `VolunteerStatus`):
 * waiting is amber, being handled is blue, done is emerald, set aside is gray.
 */
const REPORT_STATUS_COLORS = {
  PENDING: 'amber',
  IN_REVIEW: 'blue',
  RESOLVED: 'emerald',
  DISMISSED: 'gray',
} as const satisfies Record<ReportStatus, string>;

const MODERATION_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pending',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

const LABELS = {
  feedback: STAFF_FEEDBACK_STATUS_LABELS,
  submitter: SUBMITTER_FEEDBACK_STATUS_LABELS,
  moderation: MODERATION_STATUS_LABELS,
} as const;

/** The status of a moderation report or feedback item, worded for its reader. */
export function ReportStatusBadge({
  status,
  audience,
}: {
  status: ReportStatus;
  audience: keyof typeof LABELS;
}) {
  return (
    <Badge size="sm" color={REPORT_STATUS_COLORS[status]}>
      {LABELS[audience][status]}
    </Badge>
  );
}
