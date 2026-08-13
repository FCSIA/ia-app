export function canReviewFeedback(user: {
  roles: readonly string[];
  canReviewFeedback?: boolean;
}) {
  return user.roles.includes("SUPER_ADMIN") || user.canReviewFeedback === true;
}
