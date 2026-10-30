'use client';

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import {
  AtSign,
  BarChart3,
  Bold,
  Check,
  FileText,
  ImagePlay,
  Italic,
  Paperclip,
  Plus,
  Send,
  Underline,
  X,
} from 'lucide-react';
import type { Value } from 'platejs';
import {
  Plate,
  PlateContent,
  useEditorRef,
  useEditorSelection,
  usePlateEditor,
} from 'platejs/react';
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import { MentionInputPlugin, MentionPlugin } from '@platejs/mention/react';
import { Button } from '@/components/ui/button';
import {
  InputControl,
  InputControlAddon,
  InputControlButton,
  InputControlTextarea,
} from '@/components/ui/input-control-group';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
import {
  deserializeClubChannelMessageBody,
  createEmptyClubChannelMessageValue,
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
import { SchoolGifPicker } from './school-gif-picker';
import { extractChatGifLinks, isGifAttachment } from '~/apps/shared/chat/gifs';
import { AnimatedGif } from '@/components/media/animated-gif';

export type ChannelMentionSuggestion = {
  token: string;
  label: string;
  searchNames?: string[];
  detail: string;
  avatarUrl?: string | null;
  kind: 'built-in' | 'tag' | 'person' | 'role' | 'unit';
};

/** An attachment already saved on the message being edited. */
export type ExistingComposerAttachment = {
  _id: string;
  fileName: string;
  mimeType?: string;
  fileUrl: string;
};

type DraftFile = { id: string; file: File; previewUrl: string | null };

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
    removedAttachmentIds: string[];
    pollQuestion?: string;
    pollOptions?: Array<{ id: string; label: string }>;
  }) => void;
  canAttach?: boolean;
  /** Attachments already on the message; shown removable when editing. */
  existingAttachments?: ExistingComposerAttachment[];
  canCreatePoll?: boolean;
  onMentionIntent?: () => void;
  /** Lets the chat focus the editor, e.g. after choosing Reply. */
  handleRef?: Ref<ChannelMessageComposerHandle>;
  mode?: 'message' | 'edit';
  /** Comments use the same dock with a plain-text field and no media tools. */
  variant?: 'chat' | 'comment';
  maxCharacters?: number;
  onTypingActivity?: (hasText: boolean) => void;
  onCancel?: () => void;
  onEditLast?: () => void;
  replyTo?: { author: string; excerpt: string; onCancel: () => void };
};

export type ChannelMessageComposerHandle = {
  /**
   * Focuses the editor synchronously, so a call from a tap handler still
   * raises the iOS keyboard.
   */
  focus: () => void;
  clear: () => void;
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS = 12_000;
function isPreviewableImage(mimeType: string | undefined, fileName: string) {
  if (mimeType?.toLowerCase() === 'image/svg+xml') return false;
  return (
    !!mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(fileName)
  );
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

let draftFileSequence = 0;

/** Pasted screenshots all arrive named "image.png"; give each a distinct name. */
function nameForPastedFile(file: File) {
  if (file.name && !/^image\.[a-z]+$/i.test(file.name)) return file;
  const extension = IMAGE_EXTENSIONS[file.type] ?? 'png';
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return new File(
    [file],
    `pasted-image-${stamp}-${++draftFileSequence}.${extension}`,
    {
      type: file.type,
      lastModified: file.lastModified,
    },
  );
}

const MAX_CHANNEL_POLL_QUESTION_CHARACTERS = 240;
const MAX_CHANNEL_POLL_OPTION_CHARACTERS = 120;

type ComposerMark = 'bold' | 'italic' | 'underline';

function SelectionToolbar() {
  const selection = useEditorSelection();
  if (
    !selection ||
    (selection.anchor.offset === selection.focus.offset &&
      selection.anchor.path.join('.') === selection.focus.path.join('.'))
  )
    return null;
  return (
    <div
      role="toolbar"
      aria-label="Format selected text"
      className="absolute bottom-full left-2 z-10 mb-2 flex gap-1 rounded-xl bg-surface-3 p-1 shadow-surface-3"
    >
      <MarkToolButton icon={Bold} label="Bold" mark="bold" onApply={() => {}} />
      <MarkToolButton
        icon={Italic}
        label="Italic"
        mark="italic"
        onApply={() => {}}
      />
      <MarkToolButton
        icon={Underline}
        label="Underline"
        mark="underline"
        onApply={() => {}}
      />
    </div>
  );
}

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

  const marks = (editor.api.marks() ?? {}) as Partial<
    Record<ComposerMark, boolean>
  >;
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

function ComposerAttachmentTile({
  name,
  previewUrl,
  mimeType,
  disabled,
  onRemove,
}: {
  name: string;
  previewUrl: string | null;
  mimeType?: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        'group/tile relative overflow-hidden rounded-xl border bg-muted',
        previewUrl ? 'size-20' : 'flex h-20 w-40 items-center gap-2 px-2.5',
      )}
    >
      {previewUrl && isGifAttachment({ fileName: name, mimeType }) ? (
        <AnimatedGif src={previewUrl} name={name} thumbnail maxHeight={80} />
      ) : previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={name} className="size-full object-cover" />
      ) : (
        <>
          <FileText
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 truncate pr-5 text-xs" title={name}>
            {name}
          </span>
        </>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(
          'absolute right-1 top-1 flex size-6 items-center justify-center rounded-full',
          'bg-background/90 text-foreground shadow ring-1 ring-border backdrop-blur',
          'transition hover:bg-destructive hover:text-white focus-visible:outline-2',
          'disabled:pointer-events-none disabled:opacity-50',
          // Touch screens have no hover, so the button stays visible there.
          'pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100 pointer-fine:focus-visible:opacity-100',
        )}
      >
        <X className="size-3.5" />
      </button>
    </li>
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
  canAttach: allowAttachments = true,
  existingAttachments,
  canCreatePoll: allowPolls = false,
  onMentionIntent,
  handleRef,
  mode = 'message',
  variant = 'chat',
  maxCharacters = MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS,
  onCancel,
  onTypingActivity,
  onEditLast,
  replyTo,
}: ChannelMessageComposerProps) {
  const isComment = variant === 'comment';
  const canAttach = !isComment && allowAttachments;
  const canCreatePoll = !isComment && allowPolls;
  const initialValue = useMemo(
    () =>
      initialBodyRich ??
      deserializeClubChannelMessageBody(
        initialBodyMarkdown?.trim() || initialBody,
      ),
    [initialBody, initialBodyMarkdown, initialBodyRich],
  );
  const editor = usePlateEditor(
    {
      plugins: [
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        // A space after a picked mention, so the next word never runs into it.
        MentionPlugin.configure({
          options: { insertSpaceAfterMention: true },
        }).withComponent(MentionElement),
        MentionInputPlugin.withComponent(MentionInputElement),
      ],
      value: initialValue,
    },
    [],
  );
  const isMarkdownSource =
    !isComment && !initialBodyRich && !!initialBodyMarkdown?.trim();
  const isSourceInput = isComment || isMarkdownSource;
  const markdownSourceRef = useRef<HTMLTextAreaElement>(null);
  // Plain focus: asking Plate to move the caret first defers the DOM focus
  // to a timer, which iOS no longer treats as part of the tap.
  useEffect(() => {
    if (mode !== 'edit') return;
    if (isSourceInput) {
      const input = markdownSourceRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    } else {
      editor.tf.select(editor.api.end([]));
      editor.tf.focus();
    }
  }, [editor, isSourceInput, mode]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<DraftFile[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const draftsRef = useRef<DraftFile[]>([]);
  draftsRef.current = drafts;
  const keptExisting = (existingAttachments ?? []).filter(
    (a) => !removedIds.includes(a._id),
  );
  const files = useMemo(() => drafts.map((draft) => draft.file), [drafts]);
  const attachmentCount = keptExisting.length + drafts.length;
  useEffect(
    () => () => {
      for (const draft of draftsRef.current) {
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }
    },
    [],
  );

  const addFiles = (incoming: File[]) => {
    if (!canAttach || isPending || incoming.length === 0) return;
    const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setAttachmentError(`${oversized.name} is larger than 10 MB.`);
      return;
    }
    const room = MAX_ATTACHMENTS - attachmentCount;
    if (room <= 0) {
      setAttachmentError('You can attach up to 5 files.');
      return;
    }
    setAttachmentError(
      incoming.length > room
        ? `Only ${room} more ${room === 1 ? 'file fits' : 'files fit'} (5 max).`
        : null,
    );
    const accepted = incoming.slice(0, room).map((file): DraftFile => ({
      id: `draft-${++draftFileSequence}`,
      file,
      previewUrl: isPreviewableImage(file.type, file.name)
        ? URL.createObjectURL(file)
        : null,
    }));
    setDrafts((current) => [...current, ...accepted]);
  };

  const removeDraft = (id: string) => {
    setAttachmentError(null);
    const target = draftsRef.current.find((draft) => draft.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    if (!canAttach) return;
    const pasted = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    // Copying from a page can carry an image and its text together; only an
    // image with no text is treated as an attachment paste.
    if (pasted.length === 0 || event.clipboardData.getData('text/plain'))
      return;
    event.preventDefault();
    addFiles(pasted.map(nameForPastedFile));
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canAttach || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragActive(true);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    setDragActive(false);
    if (!canAttach || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [plainText, setPlainText] = useState(() =>
    serializeClubChannelMessagePlainText(initialValue),
  );
  const [richValue, setRichValue] = useState<Value>(initialValue);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollBuilderOpen, setPollBuilderOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [markdownSource, setMarkdownSource] = useState(
    initialBodyMarkdown ?? '',
  );
  useImperativeHandle(
    handleRef,
    () => ({
      focus: () => {
        if (isSourceInput) markdownSourceRef.current?.focus();
        else editor.tf.focus();
      },
      clear: () => {
        // Retain the DOM contenteditable (and the iOS keyboard) while replacing
        // its value. reset() restores initialValue, which is wrong for edits.
        const empty = createEmptyClubChannelMessageValue();
        editor.tf.setValue(empty);
        editor.tf.select(editor.api.end([]));
        if (isSourceInput) markdownSourceRef.current?.focus();
        else editor.tf.focus();
        setRichValue(empty);
        setPlainText('');
        onTypingActivity?.(false);
        setMarkdownSource('');
        for (const draft of draftsRef.current) {
          if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
        }
        setDrafts([]);
        setRemovedIds([]);
        setPollOpen(false);
        setPollBuilderOpen(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setAttachmentError(null);
        setToolsOpen(false);
      },
    }),
    [editor, isSourceInput, onTypingActivity],
  );

  const mentionables = useMemo<MentionableItem[]>(
    () =>
      suggestionEntries.map((entry) => ({
        key: entry.token,
        // The key stays the stable token that the backend resolves. Person
        // mentions render and serialize with a readable name instead.
        text: entry.kind === 'person' ? entry.label : entry.token,
        label: entry.label,
        detail: entry.detail,
        avatarUrl: entry.avatarUrl,
        kind: entry.kind,
        keywords: [
          entry.label,
          entry.detail,
          ...(entry.searchNames ?? []),
        ].filter(Boolean),
      })),
    [suggestionEntries],
  );
  const normalizedPollOptions = pollOptions
    .map((label, index) => ({ id: `option-${index + 1}`, label: label.trim() }))
    .filter((option) => option.label);
  const hasPoll =
    pollOpen && pollQuestion.trim() && normalizedPollOptions.length >= 2;
  const currentBody = isMarkdownSource ? markdownSource : plainText;
  const canSend =
    !isPending &&
    currentBody.length <= maxCharacters &&
    (currentBody.trim().length > 0 || attachmentCount > 0 || !!hasPoll);
  const pendingLabel =
    mode === 'edit'
      ? 'Saving changes'
      : isComment
        ? 'Posting comment'
        : 'Sending message';
  const hasComposerTools =
    !isComment &&
    mode !== 'edit' &&
    (canAttach || canCreatePoll || !isMarkdownSource);

  const handleSubmit = () => {
    if (!canSend) return;

    onSubmit({
      body: currentBody,
      bodyMarkdown: isComment
        ? ''
        : isMarkdownSource
          ? markdownSource.trim()
          : serializeClubChannelMessageMarkdown(richValue),
      bodyRich:
        plainText.trim() && !isSourceInput
          ? (richValue as unknown as ClubChannelMessageRichBody)
          : null,
      files,
      removedAttachmentIds: removedIds,
      pollQuestion: hasPoll ? pollQuestion.trim() : undefined,
      pollOptions: hasPoll ? normalizedPollOptions : undefined,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && (replyTo || onCancel)) {
      event.preventDefault();
      event.stopPropagation();
      (replyTo?.onCancel ?? onCancel)?.();
      return;
    }
    if (event.key === 'ArrowUp' && !currentBody.trim() && onEditLast) {
      event.preventDefault();
      onEditLast();
      return;
    }
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

  const handleMarkdownSourceKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
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
        const text = serializeClubChannelMessagePlainText(nextValue);
        setPlainText(text);
        onTypingActivity?.(!!text.trim());
      }}
    >
      <div className="relative">
        <MentionablesProvider items={mentionables}>
          <div
            className={cn(
              'relative flex flex-col gap-2 rounded-lg',
              dragActive &&
                'ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
            )}
            onFocusCapture={onMentionIntent}
            onPasteCapture={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setDragActive(false);
              }
            }}
            onDrop={handleDrop}
          >
            {!isSourceInput ? <SelectionToolbar /> : null}
            {replyTo ? (
              <div className="flex min-w-0 items-center gap-2 rounded-t-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  Replying to{' '}
                  <span className="font-medium text-foreground">
                    {replyTo.author}
                  </span>
                  {replyTo.excerpt ? ` · ${replyTo.excerpt}` : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-compact"
                  aria-label="Cancel reply"
                  onClick={replyTo.onCancel}
                >
                  <X />
                </Button>
              </div>
            ) : null}
            {attachmentCount > 0 ? (
              <ul
                aria-label={`${attachmentCount} ${attachmentCount === 1 ? 'attachment' : 'attachments'}`}
                className="flex flex-wrap gap-2 px-0.5"
              >
                {keptExisting.map((attachment) => (
                  <ComposerAttachmentTile
                    key={attachment._id}
                    name={attachment.fileName}
                    mimeType={attachment.mimeType}
                    previewUrl={
                      isPreviewableImage(
                        attachment.mimeType,
                        attachment.fileName,
                      )
                        ? attachment.fileUrl
                        : null
                    }
                    disabled={isPending}
                    onRemove={() => {
                      setAttachmentError(null);
                      setRemovedIds((current) => [...current, attachment._id]);
                    }}
                  />
                ))}
                {drafts.map((draft) => (
                  <ComposerAttachmentTile
                    key={draft.id}
                    name={draft.file.name}
                    mimeType={draft.file.type}
                    previewUrl={draft.previewUrl}
                    disabled={isPending}
                    onRemove={() => removeDraft(draft.id)}
                  />
                ))}
              </ul>
            ) : null}

            {attachmentError ? (
              <p role="alert" className="px-1 text-sm text-destructive">
                {attachmentError}
              </p>
            ) : null}

            {pollOpen ? (
              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <BarChart3 className="size-3.5" />
                <span className="min-w-0 truncate">
                  {pollQuestion || 'New poll'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPollBuilderOpen(true)}
                >
                  Edit poll
                </Button>
              </div>
            ) : null}
            <Popover open={pollBuilderOpen} onOpenChange={setPollBuilderOpen}>
              <PopoverAnchor className="absolute bottom-0 left-0 size-px" />
              <PopoverContent
                side="top"
                align="start"
                className="w-96 max-w-[calc(100vw-2rem)] p-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Poll
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove poll"
                      onClick={() => {
                        setPollOpen(false);
                        setPollBuilderOpen(false);
                      }}
                    >
                      <X data-icon="inline-start" />
                    </Button>
                  </div>
                  <Input
                    value={pollQuestion}
                    maxLength={MAX_CHANNEL_POLL_QUESTION_CHARACTERS}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    aria-label="Poll question"
                    placeholder="Poll question"
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
                        aria-label={`Poll option ${index + 1}`}
                        placeholder={`Option ${index + 1}`}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    leadingIcon={Plus}
                    className="self-start"
                    onClick={() =>
                      setPollOptions((current) => [...current, ''])
                    }
                    disabled={pollOptions.length >= 6}
                  >
                    Add option
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <InputControl className={cn('h-auto min-h-10 overflow-hidden')}>
              {isSourceInput ? (
                <InputControlTextarea
                  ref={markdownSourceRef}
                  aria-label={isComment ? 'Comment' : 'Markdown message source'}
                  value={isComment ? plainText : markdownSource}
                  readOnly={isComment && isPending}
                  rows={isComment ? 1 : undefined}
                  maxLength={maxCharacters}
                  onChange={(event) => {
                    if (isComment) setPlainText(event.target.value);
                    else setMarkdownSource(event.target.value);
                    onTypingActivity?.(!!event.target.value.trim());
                  }}
                  onKeyDown={handleMarkdownSourceKeyDown}
                  placeholder={placeholder}
                  spellCheck
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  inputMode="text"
                  enterKeyHint="send"
                  className={cn(
                    'max-h-40 min-h-10 resize-none py-2.5',
                    'text-sm pointer-coarse:text-base leading-5',
                    isMarkdownSource && 'font-mono',
                  )}
                />
              ) : (
                <PlateContent
                  data-slot="input-group-control"
                  placeholder={placeholder}
                  onKeyDown={handleKeyDown}
                  onBlur={() => onTypingActivity?.(false)}
                  spellCheck
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  inputMode="text"
                  enterKeyHint="send"
                  className={cn(
                    'max-h-40 min-h-10 min-w-0 flex-1 overflow-y-auto',
                    'py-2 pl-1 pr-2 text-sm pointer-coarse:text-base leading-5 outline-none',
                    '[&_[data-slate-placeholder=true]]:top-2 [&_[data-slate-placeholder=true]]:max-w-full [&_[data-slate-placeholder=true]]:overflow-hidden [&_[data-slate-placeholder=true]]:text-ellipsis [&_[data-slate-placeholder=true]]:whitespace-nowrap',
                    '[&_[data-slate-placeholder=true]]:text-muted-foreground',
                  )}
                />
              )}

              {hasComposerTools ? (
                <InputControlAddon
                  align="inline-start"
                  className="self-end p-1 pl-2 pr-0"
                >
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
                    <PopoverContent
                      side="top"
                      align="start"
                      className="w-auto p-1"
                    >
                      <div className="flex flex-wrap items-center gap-0.5">
                        {canAttach ? (
                          <InputControlButton
                            type="button"
                            size="icon-sm"
                            aria-label="Attach files"
                            disabled={attachmentCount >= MAX_ATTACHMENTS}
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
                            aria-label={
                              pollOpen ? 'Remove poll' : 'Create a poll'
                            }
                            className={cn(
                              pollOpen && 'bg-accent text-accent-foreground',
                            )}
                            onClick={() => {
                              setPollOpen(true);
                              setPollBuilderOpen(true);
                              setToolsOpen(false);
                            }}
                          >
                            <BarChart3 data-icon="inline-start" />
                          </InputControlButton>
                        ) : null}
                        {canAttach ? (
                          <InputControlButton
                            type="button"
                            size="icon-sm"
                            aria-label="Choose a GIF"
                            disabled={
                              isPending ||
                              extractChatGifLinks(currentBody).length >= 5
                            }
                            onClick={() => {
                              setToolsOpen(false);
                              setGifPickerOpen(true);
                            }}
                          >
                            <ImagePlay data-icon="inline-start" />
                          </InputControlButton>
                        ) : null}
                        {!isMarkdownSource && (canAttach || canCreatePoll) ? (
                          <Separator
                            orientation="vertical"
                            className="mx-0.5 h-4"
                          />
                        ) : null}
                        {!isMarkdownSource ? (
                          <>
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

              <InputControlAddon
                align="inline-end"
                className="self-end p-1 pl-0 pr-2"
              >
                <Tooltip content={isPending ? `${pendingLabel}…` : submitLabel}>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={canSend ? 'primary' : 'ghost'}
                    className="shrink-0"
                    aria-label={isPending ? pendingLabel : submitLabel}
                    disabled={!canSend}
                    loading={isPending}
                    onClick={handleSubmit}
                  >
                    {mode === 'edit' ? <Check /> : <Send />}
                  </Button>
                </Tooltip>
              </InputControlAddon>
            </InputControl>
            {mode === 'edit' ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Esc to cancel
                </Button>
                <span>·</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canSend}
                  onClick={handleSubmit}
                >
                  Enter to save
                </Button>
              </div>
            ) : null}
          </div>
        </MentionablesProvider>

        {canAttach ? (
          <SchoolGifPicker
            open={gifPickerOpen}
            onOpenChange={setGifPickerOpen}
            onSelect={(gif) => {
              if (isMarkdownSource) {
                setMarkdownSource(
                  (current) =>
                    `${current.trimEnd()}${current.trim() ? '\n' : ''}${gif.url}`,
                );
              } else {
                editor.tf.select(editor.api.end([]));
                if (plainText.trim()) editor.tf.insertBreak();
                editor.tf.insertText(gif.url);
              }
              setGifPickerOpen(false);
            }}
          />
        ) : null}
        {canAttach ? (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = '';
            }}
          />
        ) : null}
      </div>
    </Plate>
  );
}
