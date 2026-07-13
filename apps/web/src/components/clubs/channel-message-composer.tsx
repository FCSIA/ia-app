'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Bold, AtSign, BarChart3, Italic, Paperclip, Plus, Send, Underline, X } from 'lucide-react';
import type { Value } from 'platejs';
import { Plate, PlateContent, useEditorRef, useEditorSelection, usePlateEditor } from 'platejs/react';
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from '@platejs/basic-nodes/react';
import { MentionInputPlugin, MentionPlugin } from '@platejs/mention/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  createEmptyClubChannelMessageValue,
  deserializeClubChannelMessageBody,
  serializeClubChannelMessageMarkdown,
  serializeClubChannelMessagePlainText,
  type ClubChannelMessageRichBody,
} from '@/components/clubs/mention-body';
import {
  MentionElement,
  MentionInputElement,
  MentionablesProvider,
  type MentionableItem,
} from '@/components/ui/mention-node';
import { cn } from '@/lib/utils';

export type ChannelMentionSuggestion = {
  token: string;
  label: string;
  detail: string;
  kind: 'built-in' | 'tag' | 'person';
};

type ChannelMessageComposerProps = {
  suggestionEntries: ChannelMentionSuggestion[];
  placeholder: string;
  submitLabel: string;
  isPending: boolean;
  resetKey: number;
  initialBody?: string;
  initialBodyMarkdown?: string | null;
  initialBodyRich?: ClubChannelMessageRichBody | null;
  onSubmit: (args: {
    body: string;
    bodyMarkdown: string;
    bodyRich: ClubChannelMessageRichBody | null;
    files: File[];
    pollQuestion?: string;
    pollOptions?: Array<{ id: string; label: string }>;
  }) => void;
  canAttach?: boolean;
  canCreatePoll?: boolean;
};

type ComposerMark = 'bold' | 'italic' | 'underline';

function MarkButton({
  icon: Icon,
  label,
  mark,
}: {
  icon: typeof Bold;
  label: string;
  mark: ComposerMark;
}) {
  const editor = useEditorRef();
  useEditorSelection();

  const marks = (editor.api.marks() ?? {}) as Partial<Record<ComposerMark, boolean>>;
  const active = !!marks[mark];

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'size-8 p-0 text-muted-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
      onMouseDown={(event) => {
        event.preventDefault();
        const transform = (
          editor.tf as unknown as Record<string, { toggle?: () => void }>
        )[mark];
        transform?.toggle?.();
        editor.tf.focus();
      }}
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function ChannelMessageComposer({
  suggestionEntries,
  placeholder,
  submitLabel,
  isPending,
  resetKey,
  initialBody = '',
  initialBodyMarkdown,
  initialBodyRich,
  onSubmit,
  canAttach = true,
  canCreatePoll = false,
}: ChannelMessageComposerProps) {
  const editor = usePlateEditor(
    {
      plugins: [
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        MentionPlugin.withComponent(MentionElement),
        MentionInputPlugin.withComponent(MentionInputElement),
      ],
      value:
        initialBodyRich ??
        deserializeClubChannelMessageBody(initialBodyMarkdown?.trim() || initialBody),
    },
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [plainText, setPlainText] = useState('');
  const [richValue, setRichValue] = useState<Value>(createEmptyClubChannelMessageValue());
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMarkdownSource, setIsMarkdownSource] = useState(
    !initialBodyRich && !!initialBodyMarkdown?.trim(),
  );
  const [markdownSource, setMarkdownSource] = useState(initialBodyMarkdown ?? '');

  useEffect(() => {
    const nextValue =
      initialBodyRich ??
      deserializeClubChannelMessageBody(initialBodyMarkdown?.trim() || initialBody);
    setFiles([]);
    setPlainText(serializeClubChannelMessagePlainText(nextValue));
    setRichValue(nextValue);
    setIsMarkdownSource(!initialBodyRich && !!initialBodyMarkdown?.trim());
    setMarkdownSource(initialBodyMarkdown ?? '');
    setPollOpen(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    editor.tf.setValue(nextValue);
  }, [editor, initialBody, initialBodyMarkdown, initialBodyRich, resetKey]);

  const mentionables = useMemo<MentionableItem[]>(
    () =>
      suggestionEntries.map((entry) => ({
        key: entry.token,
        text: entry.token,
        label: entry.label,
        detail: entry.detail,
        kind: entry.kind,
        keywords: [entry.label, entry.detail].filter(Boolean),
      })),
    [suggestionEntries],
  );
  const normalizedPollOptions = pollOptions
    .map((label, index) => ({ id: `option-${index + 1}`, label: label.trim() }))
    .filter((option) => option.label);
  const hasPoll = pollOpen && pollQuestion.trim() && normalizedPollOptions.length >= 2;
  const currentBody = isMarkdownSource ? markdownSource : plainText;
  const canSend = !isPending && (currentBody.trim().length > 0 || files.length > 0 || !!hasPoll);

  const handleSubmit = () => {
    if (!canSend) return;

    onSubmit({
      body: currentBody,
      bodyMarkdown: isMarkdownSource
        ? markdownSource.trim()
        : serializeClubChannelMessageMarkdown(richValue),
      bodyRich: plainText.trim() && !isMarkdownSource
        ? (richValue as unknown as ClubChannelMessageRichBody)
        : null,
      files,
      pollQuestion: hasPoll ? pollQuestion.trim() : undefined,
      pollOptions: hasPoll ? normalizedPollOptions : undefined,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        editor.tf.insertBreak();
      } else if (!event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleMarkdownSourceKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Plate
      editor={editor}
      onValueChange={({ value }) => {
        const nextValue = value as Value;
        setRichValue(nextValue);
        setPlainText(serializeClubChannelMessagePlainText(nextValue));
      }}
    >
      <MentionablesProvider items={mentionables}>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
          <div className="flex flex-wrap items-center gap-1 border-b px-2 py-2">
            {isMarkdownSource ? (
              <span className="px-1 text-xs font-medium text-muted-foreground">
                Markdown source · ⌘/Ctrl+Enter to save
              </span>
            ) : (
              <>
                <MarkButton icon={Bold} label="Bold" mark="bold" />
                <MarkButton icon={Italic} label="Italic" mark="italic" />
                <MarkButton icon={Underline} label="Underline" mark="underline" />
                <Separator orientation="vertical" className="mx-1 h-5" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-muted-foreground"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    editor.tf.insertText('@');
                    editor.tf.focus();
                  }}
                >
                  <AtSign className="size-4" />
                  Mention
                </Button>
              </>
            )}
            {canAttach ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
                Attach
              </Button>
            ) : null}
            {canCreatePoll ? (
              <Button
                type="button"
                variant={pollOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setPollOpen((current) => !current);
                }}
              >
                <BarChart3 className="size-4" />
                Poll
              </Button>
            ) : null}
            {!isMarkdownSource ? (
              <div className="ml-auto text-[11px] text-muted-foreground">
                Type @ to search mentions
              </div>
            ) : null}
          </div>

          {files.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {files.map((file) => (
                <Badge key={file.name} variant="dot" className="gap-1 pr-1">
                  <span className="max-w-40 truncate">{file.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() =>
                      setFiles((current) => current.filter((entry) => entry.name !== file.name))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          {pollOpen ? (
            <div className="space-y-2 border-b px-3 py-3">
              <input
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Poll question"
                className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="space-y-1.5">
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? event.target.value : entry,
                        ),
                      )
                    }
                    placeholder={`Option ${index + 1}`}
                    className="h-8 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="tertiary"
                onClick={() => setPollOptions((current) => [...current, ''].slice(0, 8))}
                disabled={pollOptions.length >= 8}
              >
                <Plus className="size-3.5" />
                Add option
              </Button>
            </div>
          ) : null}

          <div className="flex items-end gap-3 px-3 py-3">
            <div className="flex-1 min-w-0">
              {isMarkdownSource ? (
                <textarea
                  aria-label="Markdown message source"
                  value={markdownSource}
                  onChange={(event) => setMarkdownSource(event.target.value)}
                  onKeyDown={handleMarkdownSourceKeyDown}
                  className="max-h-64 min-h-24 w-full resize-y bg-transparent py-2 font-mono text-sm leading-6 outline-none placeholder:text-muted-foreground"
                />
              ) : (
                <PlateContent
                  placeholder={placeholder}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    'max-h-64 min-h-[40px] overflow-y-auto py-2 text-sm leading-6 outline-none',
                    '[&_[data-slate-placeholder=true]]:text-muted-foreground [&_[data-slate-placeholder=true]]:top-2',
                  )}
                />
              )}
            </div>

            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={!canSend}
              onClick={handleSubmit}
            >
              <Send className="size-4" />
              {isPending ? 'Sending...' : submitLabel}
            </Button>
          </div>
        </div>
      </MentionablesProvider>

      {canAttach ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const nextFiles = Array.from(event.target.files ?? []);
            if (nextFiles.length > 0) {
              setFiles((current) => [
                ...current,
                ...nextFiles.filter((file) => !current.some((entry) => entry.name === file.name)),
              ]);
            }
            event.currentTarget.value = '';
          }}
        />
      ) : null}
    </Plate>
  );
}
