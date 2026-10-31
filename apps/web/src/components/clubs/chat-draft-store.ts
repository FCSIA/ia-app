import type { Value } from 'platejs';

export type ChatDraft = {
  richValue: Value;
  files: File[];
  pollOpen: boolean;
  pollQuestion: string;
  pollOptions: string[];
  replyToMessageId: string | null;
};
export type ChatDraftSnapshot = { draft: ChatDraft; pending: boolean; generation: number };
const emptyDraft = (): ChatDraft => ({
  richValue: [{ type: 'p', children: [{ text: '' }] }],
  files: [], pollOpen: false, pollQuestion: '',
  pollOptions: ['', ''], replyToMessageId: null,
});

/** In-memory only: files survive conversation navigation, never browser reloads. */
export class ChatDraftStore {
  private snapshot: ChatDraftSnapshot = { draft: emptyDraft(), pending: false, generation: 0 };
  private listeners = new Set<() => void>();
  private revisions = new Map<keyof ChatDraft, number>();
  private submissions = new WeakMap<ChatDraft, Map<keyof ChatDraft, number>>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(snapshot: ChatDraftSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  set<K extends keyof ChatDraft>(key: K, value: ChatDraft[K] | ((previous: ChatDraft[K]) => ChatDraft[K])) {
    const next = typeof value === 'function' ? value(this.snapshot.draft[key]) : value;
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    this.publish({ ...this.snapshot, draft: { ...this.snapshot.draft, [key]: next } });
  }
  begin() {
    if (this.snapshot.pending) return null;
    const submitted = this.snapshot.draft;
    this.submissions.set(submitted, new Map(this.revisions));
    this.publish({ ...this.snapshot, pending: true });
    return submitted;
  }
  finish(submitted: ChatDraft, success: boolean) {
    const revisions = this.submissions.get(submitted);
    if (!revisions) return;
    this.submissions.delete(submitted);
    const unchanged = (key: keyof ChatDraft) => this.revisions.get(key) === revisions.get(key);
    if (!success) {
      this.publish({ ...this.snapshot, pending: false });
      return;
    }
    const current = this.snapshot.draft;
    const draft = { ...current };
    const defaults = emptyDraft();
    // Clear only submitted fields that have not been edited since the send began.
    for (const key of Object.keys(defaults) as (keyof ChatDraft)[]) {
      if (unchanged(key)) Object.assign(draft, { [key]: defaults[key] });
    }
    // A poll is one unit: editing its question must retain its options and open state.
    if (!unchanged('pollOpen') || !unchanged('pollQuestion') || !unchanged('pollOptions')) {
      draft.pollOpen = current.pollOpen;
      draft.pollQuestion = current.pollQuestion;
      draft.pollOptions = current.pollOptions;
    }
    // Sent files must not remain attached to the next message, even if new files were added.
    const sentFiles = new Set(submitted.files);
    draft.files = current.files.filter((file) => !sentFiles.has(file));
    this.publish({ draft, pending: false, generation: this.snapshot.generation + (unchanged('richValue') ? 1 : 0) });
  }
}
const stores = new Map<string, ChatDraftStore>();
export function getChatDraftStore(key: string) {
  let store = stores.get(key);
  if (!store) { store = new ChatDraftStore(); stores.set(key, store); }
  return store;
}
export function chatDraftKey(userId: string, channelId: string, threadId?: string | null) {
  return JSON.stringify([userId, channelId, threadId ?? null]);
}
