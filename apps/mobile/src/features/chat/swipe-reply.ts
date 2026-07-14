export const SWIPE_REPLY_THRESHOLD = 72;

export function resistedReplySwipeDistance(distance: number) {
  "worklet";
  const positiveDistance = Math.max(0, distance);
  return positiveDistance > SWIPE_REPLY_THRESHOLD
    ? SWIPE_REPLY_THRESHOLD +
        (positiveDistance - SWIPE_REPLY_THRESHOLD) * 0.2
    : positiveDistance;
}

export function shouldTriggerSwipeReply(
  translationX: number,
  velocityX: number,
  thresholdReached: boolean,
) {
  "worklet";
  return thresholdReached || (translationX < -28 && velocityX < -850);
}
