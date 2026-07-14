'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Bold, AtSign, BarChart3, FileText, Italic, Paperclip, Plus, Send, Underline, X } from 'lucide-react';
import type { Value } from 'platejs';
import { Plate, PlateContent, useEditorRef, useEditorSelection, usePlateEditor } from 'platejs/react';
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from '@platejs/basic-nodes/react';
import { MentionInputPlugin, MentionPlugin } from '@platejs/mention/react';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Tooltip } from '@/components/ui/tooltip';
import {
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

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
    <Tooltip content={label}>
      <InputGroupButton
        type="button"
        size="icon-xs"
        aria-label={label}
        className={cn(active && 'bg-accent text-accent-foreground')}
        onMouseDown={(event) => {
          event.preventDefault();
          const transform = (
            editor.tf as unknown as Record<string, { toggle?: () => void }>
          )[mark];
          transform?.toggle?.();
          editor.tf.focus();
        }}
      >
        <Icon />
      </InputGroupButton>
    </Tooltip>
  );
}

export function ChannelMessageComposer({
  suggestionEntries,
  placeholder,
  submitLabel,
  isPending,
  initialBody = '',
  initialBodyMarkdown,
  initialBodyRich,
  onSubmit,
  canAttach = true,
  canCreatePoll = false,
}: ChannelMessageComposerProps) {
  const initialValue = useMemo(
    () =>
      initialBodyRich ??
      deserializeClubChannelMessageBody(initialBodyMarkdown?.trim() || initialBody),
    [initialBody, initialBodyMarkdown, initialBodyRich],
  );
  const editor = usePlateEditor(
    {
      plugins: [
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        MentionPlugin.withComponent(MentionElement),
        MentionInputPlugin.withComponent(MentionInputElement),
      ],
      value: initialValue,
    },
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [plainText, setPlainText] = useState(() =>
    serializeClubChannelMessagePlainText(initialValue),
  );
  const [richValue, setRichValue] = useState<Value>(initialValue);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const isMarkdownSource = !initialBodyRich && !!initialBodyMarkdown?.trim();
  const [markdownSource, setMarkdownSource] = useState(initialBodyMarkdown ?? '');

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
        <div className="flex flex-col gap-2">
          {files.length > 0 ? (
            <AttachmentGroup className="gap-1.5 py-0">
              {files.map((file) => (
                <Attachment key={file.name} size="xs" className="max-w-56 flex-nowrap">
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      size="icon-sm"
                      className="size-6"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        setAttachmentError(null);
                        setFiles((current) =>
                          current.filter((entry) => entry.name !== file.name),
                        );
                      }}
                    >
                      <X className="size-3" />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </AttachmentGroup>
          ) : null}

          {attachmentError ? (
            <p role="alert" className="px-1 text-xs text-destructive">
              {attachmentError}
            </p>
          ) : null}

          {pollOpen ? (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">Poll</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-6"
                  aria-label="Remove poll"
                  onClick={() => setPollOpen(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <Input
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Poll question"
                className="bg-background"
              />
              <div className="grid gap-1.5 sm:grid-cols-2">
                {pollOptions.map((option, index) => (
                  <Input
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
                    className="h-8 bg-background"
                  />
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => setPollOptions((current) => [...current, ''])}
                disabled={pollOptions.length >= 6}
              >
                <Plus className="size-3.5" />
                Add option
              </Button>
            </div>
          ) : null}

          <InputGroup className="h-auto min-h-20 overflow-hidden rounded-xl border-border/80 bg-background shadow-sm">
            {isMarkdownSource ? (
              <InputGroupTextarea
                aria-label="Markdown message source"
                value={markdownSource}
                onChange={(event) => setMarkdownSource(event.target.value)}
                onKeyDown={handleMarkdownSourceKeyDown}
                placeholder={placeholder}
                className="max-h-64 min-h-16 resize-y font-mono text-sm leading-6"
              />
            ) : (
              <PlateContent
                data-slot="input-group-control"
                placeholder={placeholder}
                onKeyDown={handleKeyDown}
                className={cn(
                  'max-h-64 min-h-12 w-full overflow-y-auto px-3 pt-3 text-sm leading-6 outline-none',
                  '[&_[data-slate-placeholder=true]]:text-muted-foreground [&_[data-slate-placeholder=true]]:top-3',
                )}
              />
            )}

            <InputGroupAddon align="block-end" className="justify-between gap-2 px-2 pb-2 pt-1">
              <div className="flex min-w-0 items-center gap-0.5">
                {!isMarkdownSource ? (
                  <>
                    <MarkButton icon={Bold} label="Bold" mark="bold" />
                    <MarkButton icon={Italic} label="Italic" mark="italic" />
                    <MarkButton icon={Underline} label="Underline" mark="underline" />
                    <Tooltip content="Mention someone">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        aria-label="Mention someone"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          editor.tf.insertText('@');
                          editor.tf.focus();
                        }}
                      >
                        <AtSign />
                      </InputGroupButton>
                    </Tooltip>
                  </>
                ) : null}
                {canAttach ? (
                  <Tooltip content="Attach files">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      aria-label="Attach files"
                      disabled={files.length >= MAX_ATTACHMENTS}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip />
                    </InputGroupButton>
                  </Tooltip>
                ) : null}
                {canCreatePoll ? (
                  <Tooltip content="Create a poll">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      aria-label="Create a poll"
                      className={cn(pollOpen && 'bg-accent text-accent-foreground')}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setPollOpen((current) => !current);
                      }}
                    >
                      <BarChart3 />
                    </InputGroupButton>
                  </Tooltip>
                ) : null}
              </div>

              <Tooltip content={isPending ? 'Sending…' : submitLabel}>
                <Button
                  type="button"
                  size="icon-sm"
                  className="size-8 shrink-0"
                  aria-label={isPending ? 'Sending message' : submitLabel}
                  disabled={!canSend}
                  loading={isPending}
                  onClick={handleSubmit}
                >
                  <Send className="size-4" />
                </Button>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
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
            const oversized = nextFiles.find((file) => file.size > MAX_ATTACHMENT_BYTES);
            if (oversized) {
              setAttachmentError(`${oversized.name} is larger than 10 MB.`);
            } else if (nextFiles.length > 0) {
              const additions = nextFiles.filter(
                (file) => !files.some((entry) => entry.name === file.name),
              );
              if (files.length + additions.length > MAX_ATTACHMENTS) {
                setAttachmentError('You can attach up to 5 files.');
              } else {
                setAttachmentError(null);
                setFiles((current) => [...current, ...additions]);
              }
            }
            event.currentTarget.value = '';
          }}
        />
      ) : null}
    </Plate>
  );
}
