'use client';

import { useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
} from 'lucide-react';
import type { Value } from 'platejs';
import { Plate, PlateContent, PlateElement, useEditorRef, useEditorSelection, usePlateEditor, type PlateElementProps } from 'platejs/react';
import {
  BlockquotePlugin,
  BoldPlugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabItem, TabsList, TabPanel } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { Toggle } from '@/components/ui/toggle';

const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }];

type Leaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

type Node = {
  type?: string;
  children: Array<Node | Leaf>;
};

function isLeaf(node: Node | Leaf): node is Leaf {
  return 'text' in node;
}

function plainText(value: Value) {
  const visit = (node: Node | Leaf): string =>
    isLeaf(node) ? node.text : node.children.map(visit).join('');
  return (value as Array<Node | Leaf>).map(visit).join('\n').trim();
}

function markdownLeaf(leaf: Leaf) {
  let value = leaf.text.replace(/([\\`*_[\]~])/g, '\\$1');
  if (!value) return value;
  if (leaf.bold) value = `**${value}**`;
  if (leaf.italic) value = `*${value}*`;
  if (leaf.underline) value = `__${value}__`;
  if (leaf.strikethrough) value = `~~${value}~~`;
  return value;
}

function markdownValue(value: Value) {
  const inline = (node: Node | Leaf): string =>
    isLeaf(node) ? markdownLeaf(node) : node.children.map(inline).join('');
  return (value as Node[])
    .map((node) => {
      const content = node.children.map(inline).join('');
      if (node.type === 'h2') return `## ${content}`;
      if (node.type === 'h3') return `### ${content}`;
      if (node.type === 'blockquote') return content.split('\n').map((line) => `> ${line}`).join('\n');
      return content;
    })
    .join('\n\n')
    .trim();
}

function markdownInlineValue(text: string): Leaf[] {
  const leaves: Leaf[] = [];
  const expression = /(\*\*|__|~~|\*|_)(.+?)\1/g;
  let cursor = 0;

  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    if (index > cursor) leaves.push({ text: text.slice(cursor, index) });
    const marker = match[1];
    leaves.push({
      text: match[2],
      ...(marker === '**' ? { bold: true } : {}),
      ...(marker === '*' || marker === '_' ? { italic: true } : {}),
      ...(marker === '__' ? { underline: true } : {}),
      ...(marker === '~~' ? { strikethrough: true } : {}),
    });
    cursor = index + match[0].length;
  }

  if (cursor < text.length || leaves.length === 0) leaves.push({ text: text.slice(cursor) });
  return leaves;
}

function markdownToValue(markdown: string): Value {
  if (!markdown.trim()) return EMPTY_VALUE;
  return markdown.split(/\n{2,}/).map((block) => {
    const heading = block.match(/^(#{2,3})\s+([\s\S]*)$/);
    const quote = block.match(/^>\s?([\s\S]*)$/);
    const content = (heading?.[2] ?? quote?.[1] ?? block).replace(/\n/g, ' ');
    return {
      type: heading ? (heading[1].length === 2 ? 'h2' : 'h3') : quote ? 'blockquote' : 'p',
      children: markdownInlineValue(content),
    };
  }) as Value;
}

function canEditVisually(markdown: string) {
  return !/(^|\n)(?:#{1}(?!#)|[-+*]\s|\d+\.\s|```|\||!\[|\[)|`/.test(markdown);
}

function HeadingTwoElement(props: PlateElementProps) {
  return <PlateElement as="h2" {...props} className="text-xl font-semibold leading-tight" />;
}

function HeadingThreeElement(props: PlateElementProps) {
  return <PlateElement as="h3" {...props} className="text-lg font-semibold leading-tight" />;
}

function BlockquoteElement(props: PlateElementProps) {
  return <PlateElement as="blockquote" {...props} className="border-l-2 border-primary/30 pl-4 text-muted-foreground" />;
}

function markdownPlainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^(?:#{1,6}|>|[-*+] |\d+\. )\s*/gm, '')
    .replace(/(`{1,3}|\*{1,3}|_{1,3}|~~|==)/g, '')
    .trim();
}

function FormatToggle({
  icon: Icon,
  label,
  command,
  disabled,
}: {
  icon: typeof Bold;
  label: string;
  command: 'bold' | 'italic' | 'underline' | 'strikethrough';
  disabled: boolean;
}) {
  const editor = useEditorRef();
  useEditorSelection();
  const active = Boolean((editor.api.marks() as Record<string, boolean> | null)?.[command]);
  const toggle = () => {
    const transform = (editor.tf as unknown as Record<string, { toggle?: () => void }>)[command];
    transform?.toggle?.();
    requestAnimationFrame(() => editor.tf.focus());
  };

  return (
    <Tooltip content={label}>
      <Toggle
        type="button"
        size="sm"
        aria-label={label}
        pressed={active}
        disabled={disabled}
        onPressedChange={toggle}
      >
        <Icon />
      </Toggle>
    </Tooltip>
  );
}

type AnnouncementEditorProps = {
  value: string;
  onChange: (body: string, bodyMarkdown: string) => void;
  disabled?: boolean;
};

export function AnnouncementEditor({ value, onChange, disabled = false }: AnnouncementEditorProps) {
  const [mode, setMode] = useState<'write' | 'markdown'>('write');
  const [markdownNotice, setMarkdownNotice] = useState<string | null>(null);
  const changeMode = (next: string) => {
    if (next === 'write' && !canEditVisually(value)) {
      setMarkdownNotice('This announcement uses Markdown that the visual editor does not support. Continue editing it in Markdown to preserve its formatting.');
      return;
    }
    setMarkdownNotice(null);
    setMode(next as 'write' | 'markdown');
  };

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <TabsList aria-label="Announcement editor mode">
        <TabItem value="write" label="Write" />
        <TabItem value="markdown" label="Markdown" />
      </TabsList>
      <TabPanel value="write" className="mt-2">
        {mode === 'write' ? <VisualAnnouncementEditor value={value} onChange={onChange} disabled={disabled} /> : null}
      </TabPanel>
      <TabPanel value="markdown" className="mt-2 space-y-2">
        {markdownNotice ? <p role="status" className="text-sm text-muted-foreground">{markdownNotice}</p> : null}
        <Textarea
          value={value}
          onChange={(event) => onChange(markdownPlainText(event.target.value), event.target.value)}
          placeholder="Write Markdown…"
          disabled={disabled}
          className="min-h-52 resize-y font-mono text-sm leading-6"
        />
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
          <div className="typeset max-w-none text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value || 'Nothing to preview yet.'}</ReactMarkdown></div>
        </div>
      </TabPanel>
    </Tabs>
  );
}

function VisualAnnouncementEditor({ value, onChange, disabled = false }: AnnouncementEditorProps) {
  const [initialValue] = useState(() => markdownToValue(value));
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      StrikethroughPlugin,
      H2Plugin.withComponent(HeadingTwoElement),
      H3Plugin.withComponent(HeadingThreeElement),
      BlockquotePlugin.withComponent(BlockquoteElement),
    ],
    value: initialValue,
  }, []);

  return (
    <Plate
      editor={editor}
      onValueChange={({ value: nextValue }) => {
        const next = nextValue as Value;
        onChange(plainText(next), markdownValue(next));
      }}
    >
      <div className="overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
          <FormatToggle icon={Bold} label="Bold" command="bold" disabled={disabled} />
          <FormatToggle icon={Italic} label="Italic" command="italic" disabled={disabled} />
          <FormatToggle icon={Underline} label="Underline" command="underline" disabled={disabled} />
          <FormatToggle icon={Strikethrough} label="Strikethrough" command="strikethrough" disabled={disabled} />
        </div>
        <PlateContent
          placeholder="Write your announcement..."
          disabled={disabled}
          className="typeset min-h-52 max-h-96 overflow-y-auto px-3 py-3 text-sm leading-6 outline-none pointer-coarse:text-base"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Use the Markdown tab for headings, links, lists, tables, code blocks, quotes, and other Markdown formatting.</p>
    </Plate>
  );
}
