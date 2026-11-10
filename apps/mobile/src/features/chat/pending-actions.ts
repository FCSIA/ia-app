/** Keys for in-flight message actions; one key blocks a repeat of the same action. */
export const pendingKey = {
  composer: "composer",
  reaction: (messageId: string, reaction: string) => `reaction:${messageId}:${reaction}`,
  poll: (messageId: string) => `poll:${messageId}`,
  pin: (messageId: string) => `pin:${messageId}`,
  delete: (messageId: string) => `delete:${messageId}`,
} as const;

/** Optimistic ids contain ":" themselves, so match by substring rather than splitting the key. */
export function hasPendingAction(pending: ReadonlySet<string>, messageId: string) {
  for (const key of pending) {
    if (key.includes(messageId)) return true;
  }
  return false;
}
