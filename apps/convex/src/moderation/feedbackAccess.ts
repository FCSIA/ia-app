import { isSuperAdmin } from "../../../shared/roles";
export function canReviewFeedback(user: {
  roles: readonly string[];
  canReviewFeedback?: boolean;
}) {
  return isSuperAdmin(user) || user.canReviewFeedback === true;
}
