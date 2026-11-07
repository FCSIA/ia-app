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

  const enter = useCallback(
    (nextMode: ComposerMode, plainText = "", markdown = "") => {
      setMode(nextMode);
      setDraft(plainText);
      setMarkdownDraft(markdown);
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const reset = useCallback(() => enter({ kind: "message" }), [enter]);

  const startReply = useCallback(
    (target: ChatMessage) => enter({ kind: "reply", target }),
    [enter],
  );

  const startEdit = useCallback(
    (target: ChatMessage) =>
      enter(
        { kind: "edit", target },
        target.body,
        target.bodyMarkdown?.trim() || target.body,
      ),
    [enter],
  );

  const startReport = useCallback(
    (target: ChatMessage) => enter({ kind: "report", target }),
    [enter],
  );

  const startPoll = useCallback(() => enter({ kind: "poll" }), [enter]);

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
