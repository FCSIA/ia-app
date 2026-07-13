import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage, ComposerMode } from "./types";

export function useChatComposer() {
  const [mode, setMode] = useState<ComposerMode>({ kind: "message" });
  const [draft, setDraft] = useState("");
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const draftRevisionRef = useRef(0);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");

  const bumpDraftRevision = useCallback(() => {
    draftRevisionRef.current += 1;
    setDraftRevision(draftRevisionRef.current);
  }, []);

  const reset = useCallback(() => {
    setMode({ kind: "message" });
    setDraft("");
    setMarkdownDraft("");
    bumpDraftRevision();
    setPollQuestion("");
    setPollOptions("");
  }, [bumpDraftRevision]);

  const startReply = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "reply", target });
      setDraft("");
      setMarkdownDraft("");
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startEdit = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "edit", target });
      setDraft(target.body);
      setMarkdownDraft(target.bodyMarkdown?.trim() || target.body);
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startReport = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "report", target });
      setDraft("");
      setMarkdownDraft("");
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startPoll = useCallback(() => {
    setMode({ kind: "poll" });
    setDraft("");
    setMarkdownDraft("");
    bumpDraftRevision();
    setPollQuestion("");
    setPollOptions("");
  }, [bumpDraftRevision]);

  const setRichDraft = useCallback(
    (plainText: string, markdown: string) => {
      setDraft(plainText);
      setMarkdownDraft(markdown);
      bumpDraftRevision();
    },
    [bumpDraftRevision],
  );

  const restoreDraft = useCallback((plainText: string, markdown: string) => {
    setDraft(plainText);
    setMarkdownDraft(markdown);
  }, []);

  const getDraftRevision = useCallback(() => draftRevisionRef.current, []);

  return useMemo(
    () => ({
      mode,
      draft,
      markdownDraft,
      draftRevision,
      getDraftRevision,
      pollQuestion,
      pollOptions,
      setDraft,
      setRichDraft,
      restoreDraft,
      setPollQuestion,
      setPollOptions,
      reset,
      startReply,
      startEdit,
      startReport,
      startPoll,
    }),
    [
      draft,
      draftRevision,
      getDraftRevision,
      markdownDraft,
      mode,
      pollOptions,
      pollQuestion,
      reset,
      restoreDraft,
      setRichDraft,
      startEdit,
      startPoll,
      startReply,
      startReport,
    ],
  );
}

export type ChatComposerController = ReturnType<typeof useChatComposer>;
