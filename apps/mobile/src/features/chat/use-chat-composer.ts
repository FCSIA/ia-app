import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage, ComposerMode } from "./types";
import { appendChatGifLinks, mergeChatGifUrls, splitChatGifDraft } from "~/apps/shared/chat/gifs";

const emptyDraft = () => ({ text: "", markdown: "", gifUrls: [] as string[] });

export function useChatComposer() {
  const [mode, setMode] = useState<ComposerMode>({ kind: "message" });
  const [content, setContent] = useState(emptyDraft);
  const draft = appendChatGifLinks(content.text, content.gifUrls);
  const markdownDraft = appendChatGifLinks(content.markdown, content.gifUrls);
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
    setContent(emptyDraft());
    bumpDraftRevision();
    setPollQuestion("");
    setPollOptions("");
  }, [bumpDraftRevision]);

  const startReply = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "reply", target });
      setContent(emptyDraft());
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startEdit = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "edit", target });
      setContent(splitChatGifDraft(target.body, target.bodyMarkdown?.trim() || target.body));
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startReport = useCallback(
    (target: ChatMessage) => {
      setMode({ kind: "report", target });
      setContent(emptyDraft());
      bumpDraftRevision();
      setPollQuestion("");
      setPollOptions("");
    },
    [bumpDraftRevision],
  );

  const startPoll = useCallback(() => {
    setMode({ kind: "poll" });
    setContent(emptyDraft());
    bumpDraftRevision();
    setPollQuestion("");
    setPollOptions("");
  }, [bumpDraftRevision]);

  const setRichDraft = useCallback(
    (plainText: string, markdown: string) => {
      setContent((current) => splitChatGifDraft(plainText, markdown, current.gifUrls));
      bumpDraftRevision();
    },
    [bumpDraftRevision],
  );

  const restoreDraft = useCallback((plainText: string, markdown: string) => {
    setContent(splitChatGifDraft(plainText, markdown));
  }, []);

  const setDraft = useCallback((text: string) => {
    // Reports are plain text; a provider URL in a report is evidence, not media.
    if (mode.kind === "report") setContent({ text, markdown: "", gifUrls: [] });
    else setRichDraft(text, text);
  }, [mode.kind, setRichDraft]);

  const addGif = useCallback((url: string) => {
    setContent((current) => ({ ...current, gifUrls: mergeChatGifUrls(current.gifUrls, url) }));
    bumpDraftRevision();
  }, [bumpDraftRevision]);

  const removeGif = useCallback((url: string) => {
    setContent((current) => ({ ...current, gifUrls: current.gifUrls.filter((item) => item !== url) }));
    bumpDraftRevision();
  }, [bumpDraftRevision]);

  const getDraftRevision = useCallback(() => draftRevisionRef.current, []);

  return useMemo(
    () => ({
      mode,
      draft,
      markdownDraft,
      caption: content.text,
      captionMarkdown: content.markdown,
      gifUrls: content.gifUrls,
      addGif,
      removeGif,
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
      content,
      addGif,
      removeGif,
      draftRevision,
      getDraftRevision,
      markdownDraft,
      mode,
      pollOptions,
      pollQuestion,
      reset,
      restoreDraft,
      setRichDraft,
      setDraft,
      startEdit,
      startPoll,
      startReply,
      startReport,
    ],
  );
}

export type ChatComposerController = ReturnType<typeof useChatComposer>;
