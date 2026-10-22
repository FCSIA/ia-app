import { describe, expect, test } from 'vitest';
import { createSlateEditor } from 'platejs';
import { BaseMentionPlugin } from '@platejs/mention';
import { appendComposerGifNodes, detachComposerGifLinks, initialComposerGifDraft } from './composer-gif-draft';
import { serializeClubChannelMessagePlainText } from './mention-serialize';

const url = 'https://media.giphy.com/media/abc/giphy.gif';

describe('rich GIF draft conversion', () => {
  test('detaches a link split across marked leaves and preserves the caret/caption', () => {
    const editor = createSlateEditor({ value: [{ type: 'p', children: [
      { text: 'Hello ', bold: true },
      { text: url.slice(0, 25), italic: true },
      { text: `${url.slice(25)} caption`, underline: true },
    ] }] });
    editor.tf.select(editor.api.end([]));
    detachComposerGifLinks(editor, [url]);
    expect(editor.children[0].children).toEqual([
      { text: 'Hello ', bold: true }, { text: ' caption', underline: true },
    ]);
    expect(editor.selection?.anchor).toEqual({ path: [0, 1], offset: 8 });
  });

  test('initial editing preserves mentions and does not mutate the saved rich body', () => {
    const editor = createSlateEditor({ plugins: [BaseMentionPlugin], value: [{ type: 'p', children: [
      { text: 'Hi ' }, { type: 'mention', key: 'STU001', value: 'Sam', children: [{ text: '' }] },
      { text: ` ${url}` },
    ] }] });
    const original = structuredClone(editor.children);
    const draft = initialComposerGifDraft(original, `Hi @Sam ${url}`);
    expect(draft.urls).toEqual([url]);
    expect(serializeClubChannelMessagePlainText(draft.value)).toBe('Hi @Sam ');
    expect(original).toEqual(editor.children);
    expect(serializeClubChannelMessagePlainText(appendComposerGifNodes(draft.value, draft.urls))).toContain(url);
  });

  test('detaches several occurrences backwards and leaves code examples intact', () => {
    const editor = createSlateEditor({ value: [{ type: 'p', children: [{ text: `${url} and ${url} \`${url}\`` }] }] });
    detachComposerGifLinks(editor, [url]);
    expect(serializeClubChannelMessagePlainText(editor.children)).toBe(` and  \`${url}\``);
  });
});
