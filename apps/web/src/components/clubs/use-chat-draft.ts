'use client';

import { useState, useSyncExternalStore } from 'react';
import { ChatDraftStore, getChatDraftStore } from './chat-draft-store';

export function useChatDraft(key?: string) {
  const [localStore] = useState(() => new ChatDraftStore());
  const store = key ? getChatDraftStore(key) : localStore;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, ...snapshot };
}
