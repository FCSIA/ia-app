import { createSlateEditor, type SlateEditor, type Value } from 'platejs';
import { BaseMentionPlugin } from '@platejs/mention';
import { chatGifLinkRanges, extractChatGifLinks } from '../../../../shared/chat/gifs';

/** Convert links to draft items through Slate transforms, preserving marks and selection. */
export function detachComposerGifLinks(editor: SlateEditor, urls: string[]) {
  if (!urls.length) return;
  const leaves: Array<{ path: number[]; start: number; end: number }> = [];
  let text = '';
  let block = -1;
  for (const [node, path] of editor.api.nodes({ at: [], match: (node) => typeof node.text === 'string' })) {
    if (block !== -1 && block !== path[0]) text += '\n';
    block = path[0];
    const value = node.text as string;
    leaves.push({ path, start: text.length, end: text.length + value.length });
    text += value;
  }
  const ranges = urls.flatMap((url) => chatGifLinkRanges(text, url));
  // Work backwards so each path/offset still points at the original text.
  editor.tf.withoutNormalizing(() => {
    for (const range of ranges.sort((a, b) => b.start - a.start)) {
      const first = leaves.find((leaf) => leaf.start <= range.start && range.start < leaf.end);
      const last = leaves.find((leaf) => leaf.start < range.end && range.end <= leaf.end);
      if (first && last) editor.tf.delete({ at: {
        anchor: { path: first.path, offset: range.start - first.start },
        focus: { path: last.path, offset: range.end - last.start },
      } });
    }
  });
}

export function initialComposerGifDraft(value: Value, source: string) {
  const urls = extractChatGifLinks(source).map((link) => link.url);
  if (!urls.length) return { value, urls };
  const editor = createSlateEditor({ plugins: [BaseMentionPlugin], value: structuredClone(value) });
  detachComposerGifLinks(editor, urls);
  return { value: editor.children, urls };
}

/** Retain the existing message contract without putting transport URLs in the editor. */
export function appendComposerGifNodes(value: Value, urls: string[]): Value {
  return [...value, ...urls.map((url) => ({ type: 'p', children: [{ text: url }] }))];
}
