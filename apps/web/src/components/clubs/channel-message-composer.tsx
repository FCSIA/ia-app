'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AtSign, BarChart3, Bold, FileText, Italic, Paperclip, Plus, Send, Underline, X } from 'lucide-react';
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
import {
  InputControl,
  InputControlAddon,
  InputControlButton,
  InputControlTextarea,
} from '@/components/ui/input-control-group';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
  onMentionIntent?: () => void;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS = 12_000;
const MAX_CHANNEL_POLL_QUESTION_CHARACTERS = 240;
const MAX_CHANNEL_POLL_OPTION_CHARACTERS = 120;

type ComposerMark = 'bold' | 'italic' | 'underline';

function MarkToolButton({
  icon: Icon,
  label,
  mark,
  onApply,
}: {
  icon: typeof Bold;
  label: string;
  mark: ComposerMark;
  onApply: () => void;
}) {
  const editor = useEditorRef();
  useEditorSelection();

  const marks = (editor.api.marks() ?? {}) as Partial<Record<ComposerMark, boolean>>;
  const active = !!marks[mark];

  return (
    <InputControlButton
      type="button"
      size="icon-sm"
      aria-label={label}
      className={cn(active && 'bg-accent text-accent-foreground')}
      onMouseDown={(event) => {
        event.preventDefault();
        const transform = (
          editor.tf as unknown as Record<string, { toggle?: () => void }>
        )[mark];
        transform?.toggle?.();
        onApply();
        requestAnimationFrame(() => editor.tf.focus());
      }}
    >
      <Icon data-icon="inline-start" />
    </InputControlButton>
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
  onMentionIntent,
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
  const [toolsOpen, setToolsOpen] = useState(false);
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
  const hasComposerTools = canAttach || canCreatePoll || !isMarkdownSource;

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
    if (event.key === '@') onMentionIntent?.();
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
        <div className="flex flex-col gap-2" onFocusCapture={onMentionIntent}>
          {files.length > 0 ? (
            <AttachmentGroup className="gap-1.5 py-0">
              {files.map((file) => (
                <Attachment key={file.name} size="sm" className="max-w-56 flex-nowrap">
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      size="icon-sm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        setAttachmentError(null);
                        setFiles((current) =>
                          current.filter((entry) => entry.name !== file.name),
                        );
                      }}
                    >
                      <X data-icon="inline-start" />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </AttachmentGroup>
          ) : null}

          {attachmentError ? (
            <p role="alert" className="px-1 text-sm text-destructive">
              {attachmentError}
            </p>
          ) : null}

          {pollOpen ? (
            <div className="flex flex-col gap-2 rounded-xl border bg-background p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">Poll</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove poll"
                  onClick={() => setPollOpen(false)}
                >
                  <X data-icon="inline-start" />
                </Button>
              </div>
              <Input
                value={pollQuestion}
                maxLength={MAX_CHANNEL_POLL_QUESTION_CHARACTERS}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Poll question"
                className="bg-background"
              />
              <div className="grid gap-1.5 sm:grid-cols-2">
                {pollOptions.map((option, index) => (
                  <Input
                    key={index}
                    value={option}
                    maxLength={MAX_CHANNEL_POLL_OPTION_CHARACTERS}
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
                leadingIcon={Plus}
                className="self-start"
                onClick={() => setPollOptions((current) => [...current, ''])}
                disabled={pollOptions.length >= 6}
              >
                Add option
              </Button>
            </div>
          ) : null}

          <InputControl
            className={cn(
              'h-auto min-h-10 overflow-hidden rounded-lg',
              'border-border bg-muted shadow-none',
            )}
          >
            {isMarkdownSource ? (
              <InputControlTextarea
                aria-label="Markdown message source"
                value={markdownSource}
                maxLength={MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS}
                onChange={(event) => setMarkdownSource(event.target.value)}
                onKeyDown={handleMarkdownSourceKeyDown}
                placeholder={placeholder}
                spellCheck
                autoCapitalize="sentences"
                autoCorrect="on"
                inputMode="text"
                enterKeyHint="send"
                className={cn(
                  'max-h-40 min-h-10 resize-none py-2.5',
                  'font-mono text-sm any-pointer-coarse:text-base leading-5',
                )}
              />
            ) : (
              <PlateContent
                data-slot="input-group-control"
                placeholder={placeholder}
                onKeyDown={handleKeyDown}
                spellCheck
                autoCapitalize="sentences"
                autoCorrect="on"
                inputMode="text"
                enterKeyHint="send"
                className={cn(
                  'max-h-40 min-h-10 min-w-0 flex-1 overflow-y-auto',
                  'py-2 pl-1 pr-2 text-sm any-pointer-coarse:text-base leading-5 outline-none',
                  '[&_[data-slate-placeholder=true]]:top-2 [&_[data-slate-placeholder=true]]:max-w-full [&_[data-slate-placeholder=true]]:overflow-hidden [&_[data-slate-placeholder=true]]:text-ellipsis [&_[data-slate-placeholder=true]]:whitespace-nowrap',
                  '[&_[data-slate-placeholder=true]]:text-muted-foreground',
                )}
              />
            )}

            {hasComposerTools ? (
              <InputControlAddon align="inline-start" className="self-end p-1 pl-2 pr-0">
                <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Message tools"
                      aria-expanded={toolsOpen}
                    >
                      <Plus data-icon="inline-start" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto p-1">
                    <div className="flex items-center gap-0.5">
                      {canAttach ? (
                        <InputControlButton
                          type="button"
                          size="icon-sm"
                          aria-label="Attach files"
                          disabled={files.length >= MAX_ATTACHMENTS}
                          onClick={() => {
                            setToolsOpen(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <Paperclip data-icon="inline-start" />
                        </InputControlButton>
                      ) : null}
                      {canCreatePoll ? (
                        <InputControlButton
                          type="button"
                          size="icon-sm"
                          aria-label={pollOpen ? 'Remove poll' : 'Create a poll'}
                          className={cn(pollOpen && 'bg-accent text-accent-foreground')}
                          onClick={() => {
                            setPollOpen((current) => !current);
                            setToolsOpen(false);
                          }}
                        >
                          <BarChart3 data-icon="inline-start" />
                        </InputControlButton>
                      ) : null}
                      {!isMarkdownSource && (canAttach || canCreatePoll) ? (
                        <Separator orientation="vertical" className="mx-0.5 h-4" />
                      ) : null}
                      {!isMarkdownSource ? (
                        <>
                          <MarkToolButton
                            icon={Bold}
                            label="Bold"
                            mark="bold"
                            onApply={() => setToolsOpen(false)}
                          />
                          <MarkToolButton
                            icon={Italic}
                            label="Italic"
                            mark="italic"
                            onApply={() => setToolsOpen(false)}
                          />
                          <MarkToolButton
                            icon={Underline}
                            label="Underline"
                            mark="underline"
                            onApply={() => setToolsOpen(false)}
                          />
                          <InputControlButton
                            type="button"
                            size="icon-sm"
                            aria-label="Mention someone"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onMentionIntent?.();
                              editor.tf.insertText('@');
                              setToolsOpen(false);
                              requestAnimationFrame(() => editor.tf.focus());
                            }}
                          >
                            <AtSign data-icon="inline-start" />
                          </InputControlButton>
                        </>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
              </InputControlAddon>
            ) : null}

            <InputControlAddon align="inline-end" className="self-end p-1 pl-0 pr-2">
              <Tooltip content={isPending ? 'Sending…' : submitLabel}>
                <Button
                  type="button"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={isPending ? 'Sending message' : submitLabel}
                  disabled={!canSend}
                  loading={isPending}
                  onClick={handleSubmit}
                >
                  <Send data-icon="inline-start" />
                </Button>
              </Tooltip>
            </InputControlAddon>
          </InputControl>
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
