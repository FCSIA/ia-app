'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ClubChannelMessageRichBody } from '@ia/contracts/clubs';
import { Bold, AtSign, Italic, Paperclip, Send, Underline, X } from 'lucide-react';
import type { Value } from 'platejs';
import { Plate, PlateContent, useEditorRef, useEditorSelection, usePlateEditor } from 'platejs/react';
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from '@platejs/basic-nodes/react';
import { MentionInputPlugin, MentionPlugin } from '@platejs/mention/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  createEmptyClubChannelMessageValue,
  serializeClubChannelMessagePlainText,
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
  onSubmit: (args: {
    body: string;
    bodyRich: ClubChannelMessageRichBody | null;
    files: File[];
  }) => void;
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
  onSubmit,
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
      value: createEmptyClubChannelMessageValue(),
    },
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [plainText, setPlainText] = useState('');
  const [richValue, setRichValue] = useState<Value>(createEmptyClubChannelMessageValue());

  useEffect(() => {
    const emptyValue = createEmptyClubChannelMessageValue();
    setFiles([]);
    setPlainText('');
    setRichValue(emptyValue);
    editor.tf.setValue(emptyValue);
  }, [editor, resetKey]);

  const builtInMentions = suggestionEntries.filter((entry) => entry.kind === 'built-in');
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
  const canSend = !isPending && (plainText.trim().length > 0 || files.length > 0);

  const handleSubmit = () => {
    if (!canSend) return;

    onSubmit({
      body: plainText,
      bodyRich: plainText.trim()
        ? (richValue as unknown as ClubChannelMessageRichBody)
        : null,
      files,
    });
  };

  const insertMention = (token: string) => {
    const insert = (
      editor.tf.insert as unknown as {
        mention?: (options: { key: string; search?: string; value: string }) => void;
      }
    ).mention;

    if (!insert) return;

    insert({ key: token, search: '', value: token });
    editor.tf.move({ unit: 'offset' });
    editor.tf.insertText(' ');
    editor.tf.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
            <div className="ml-auto text-[11px] text-muted-foreground">
              Type @ to search mentions
            </div>
          </div>

          {files.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {files.map((file) => (
                <Badge key={file.name} variant="outline" className="gap-1 pr-1">
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

          <div className="px-3 py-3">
            <PlateContent
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              className={cn(
                'max-h-64 min-h-24 overflow-y-auto text-sm leading-6 outline-none',
                '[&_[data-slate-placeholder=true]]:text-muted-foreground',
              )}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Attach
              </Button>
              {builtInMentions.map((suggestion) => (
                <Button
                  key={suggestion.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-[11px]"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(suggestion.token);
                  }}
                >
                  @{suggestion.token}
                </Button>
              ))}
            </div>

            <Button type="button" size="sm" className="h-8" disabled={!canSend} onClick={handleSubmit}>
              <Send className="size-3.5" />
              {isPending ? 'Sending...' : submitLabel}
            </Button>
          </div>
        </div>
      </MentionablesProvider>

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
    </Plate>
  );
}
