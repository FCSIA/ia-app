import { describe, expect, test } from 'vitest';
import { appendChatGifLinks, splitChatGifDraft } from './gifs';

const url = 'https://media.giphy.com/media/abc/giphy.gif';

describe('GIF draft items', () => {
  test('detaches pasted Markdown links without losing captions, code or other URLs', () => {
    const draft = splitChatGifDraft(`Nice ${url}.`, `**Nice** [reaction](${url}).`);
    expect(draft).toEqual({ text: 'Nice .', markdown: '**Nice** .', gifUrls: [url] });
    expect(splitChatGifDraft(`\`${url}\` https://example.com`, '').gifUrls).toEqual([]);
  });

  test('caption edits keep GIFs, formatting and typed trailing spaces', () => {
    expect(splitChatGifDraft('Hello ', '**Hello** ', [url])).toEqual({
      text: 'Hello ', markdown: '**Hello** ', gifUrls: [url],
    });
    expect(splitChatGifDraft('', '', [url]).gifUrls).toEqual([url]);
  });

  test('serializes and restores GIF-only drafts and deduplicates equivalent links', () => {
    const payload = appendChatGifLinks('', [url]);
    expect(splitChatGifDraft(payload, payload)).toEqual({ text: '', markdown: '', gifUrls: [url] });
    expect(splitChatGifDraft(url, url, [url]).gifUrls).toEqual([url]);
    const caption = splitChatGifDraft(`Hi\n${url}`, `**Hi**\n${url}`);
    expect(caption.text).toBe('Hi');
    expect(caption.markdown).toBe('**Hi**');
    expect(appendChatGifLinks('Hi ', [])).toBe('Hi ');
  });

  test('keeps excess URLs editable instead of silently dropping them', () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://media.giphy.com/media/id${i}/giphy.gif`);
    const draft = splitChatGifDraft(urls.join(' '), '');
    expect(draft.gifUrls).toEqual(urls.slice(0, 5));
    expect(draft.text.trim()).toBe(urls[5]);
  });
});
