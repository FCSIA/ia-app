import { useCallback, useMemo, useState } from "react";
import type { ChatMessage, ComposerMode } from "./types";

export function useChatComposer() {
  const [mode, setMode] = useState<ComposerMode>({ kind: "message" });
  const [draft, setDraft] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");

  const reset = useCallback(() => {
    setMode({ kind: "message" });
    setDraft("");
    setPollQuestion("");
    setPollOptions("");
  }, []);

  const startReply = useCallback((target: ChatMessage) => {
    setMode({ kind: "reply", target });
    setDraft("");
    setPollQuestion("");
    setPollOptions("");
  }, []);

  const startEdit = useCallback((target: ChatMessage) => {
    setMode({ kind: "edit", target });
    setDraft(target.body);
    setPollQuestion("");
    setPollOptions("");
  }, []);

  const startReport = useCallback((target: ChatMessage) => {
    setMode({ kind: "report", target });
    setDraft("");
    setPollQuestion("");
    setPollOptions("");
  }, []);

  const startPoll = useCallback(() => {
    setMode({ kind: "poll" });
    setPollQuestion("");
    setPollOptions("");
  }, []);

  return useMemo(
    () => ({
      mode,
      draft,
      pollQuestion,
      pollOptions,
      setDraft,
      setPollQuestion,
      setPollOptions,
      reset,
      startReply,
      startEdit,
      startReport,
      startPoll,
    }),
    [draft, mode, pollOptions, pollQuestion, reset, startEdit, startPoll, startReply, startReport],
  );
}

export type ChatComposerController = ReturnType<typeof useChatComposer>;
