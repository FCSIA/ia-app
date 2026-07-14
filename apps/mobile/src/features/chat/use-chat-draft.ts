import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  chatDraftKey,
  parseChatDraft,
  serializeChatDraft,
  shouldRestoreChatDraft,
  type ChatDraftIdentity,
} from "./chat-drafts";

const SAVE_DEBOUNCE_MS = 450;

type UseChatDraftArgs = {
  identity: ChatDraftIdentity | null;
  enabled: boolean;
  getRevision: () => number;
  plainText: string;
  markdown: string;
  onRestore: (plainText: string, markdown: string) => void;
};

export function useChatDraft({
  identity,
  enabled,
  getRevision,
  plainText,
  markdown,
  onRestore,
}: UseChatDraftArgs) {
  const identityKey = identity ? chatDraftKey(identity) : null;
  const activeKey = enabled ? identityKey : null;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const activeKeyRef = useRef(activeKey);
  const previousIdentityKeyRef = useRef(identityKey);
  const getRevisionRef = useRef(getRevision);
  const restoreRef = useRef(onRestore);

  activeKeyRef.current = activeKey;
  getRevisionRef.current = getRevision;
  restoreRef.current = onRestore;

  useEffect(() => {
    const previousKey = previousIdentityKeyRef.current;
    if (previousKey && previousKey !== identityKey) {
      restoreRef.current("", "");
    }
    previousIdentityKeyRef.current = identityKey;
  }, [identityKey]);

  useEffect(() => {
    setHydratedKey(null);
    if (!activeKey || !identity) return;

    let cancelled = false;
    let hydrationTimer: ReturnType<typeof setTimeout> | null = null;
    const keyAtReadStart = activeKey;
    const revisionAtReadStart = getRevisionRef.current();

    AsyncStorage.getItem(keyAtReadStart)
      .then((raw) => {
        if (cancelled) return;
        const draft = parseChatDraft(raw, identity);
        if (raw && !draft)
          void AsyncStorage.removeItem(keyAtReadStart).catch(() => {});
        if (
          draft &&
          shouldRestoreChatDraft({
            keyAtReadStart,
            activeKey: activeKeyRef.current,
            revisionAtReadStart,
            activeRevision: getRevisionRef.current(),
          })
        ) {
          restoreRef.current(draft.plainText, draft.markdown);
        }
        hydrationTimer = setTimeout(() => {
          if (!cancelled && activeKeyRef.current === keyAtReadStart) {
            setHydratedKey(keyAtReadStart);
          }
        }, 0);
      })
      .catch(() => {
        if (!cancelled && activeKeyRef.current === keyAtReadStart) {
          setHydratedKey(keyAtReadStart);
        }
      });

    return () => {
      cancelled = true;
      if (hydrationTimer) clearTimeout(hydrationTimer);
    };
  }, [
    activeKey,
    identity?.channelId,
    identity?.clubId,
    identity?.threadId,
    identity?.userId,
  ]);

  const persist = useCallback(async () => {
    if (!activeKey || !identity || hydratedKey !== activeKey) return;
    if (!plainText.trim() && !markdown.trim()) {
      await AsyncStorage.removeItem(activeKey);
      return;
    }
    await AsyncStorage.setItem(
      activeKey,
      serializeChatDraft(identity, plainText, markdown),
    );
  }, [activeKey, hydratedKey, identity, markdown, plainText]);

  useEffect(() => {
    if (!activeKey || hydratedKey !== activeKey) return;
    const timer = setTimeout(
      () => void persist().catch(() => {}),
      SAVE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [activeKey, hydratedKey, persist]);

  const clear = useCallback(async () => {
    if (activeKey) await AsyncStorage.removeItem(activeKey).catch(() => {});
  }, [activeKey]);

  return { clear, flush: persist };
}
