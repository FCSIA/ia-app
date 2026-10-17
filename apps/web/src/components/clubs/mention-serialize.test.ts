import { describe, expect, test } from 'vitest';
import type { Value } from 'platejs';
import {
  serializeClubChannelMessageMarkdown,
  serializeClubChannelMessagePlainText,
} from './mention-serialize';

const paragraph = (...children: unknown[]) => [{ type: 'p', children }] as unknown as Value;
const mention = (value: string) => ({ type: 'mention', value, key: value, children: [{ text: '' }] });

describe('mention serialization', () => {
  test('a word typed straight after a mention is spaced from it', () => {
    const value = paragraph({ text: '' }, mention('all'), { text: 'We have a meeting' });
    expect(serializeClubChannelMessagePlainText(value)).toBe('@all We have a meeting');
    expect(serializeClubChannelMessageMarkdown(value)).toBe('[@all](user://all) We have a meeting');
  });

  test('formatted words are spaced too', () => {
    const value = paragraph(mention('all'), { text: 'today', bold: true });
    expect(serializeClubChannelMessageMarkdown(value)).toBe('[@all](user://all) **today**');
  });

  test('existing spaces and punctuation are left alone', () => {
    expect(
      serializeClubChannelMessagePlainText(
        paragraph({ text: 'hi ' }, mention('all'), { text: ', see you' }),
      ),
    ).toBe('hi @all, see you');
    expect(
      serializeClubChannelMessagePlainText(paragraph(mention('all'), { text: "'s turn" })),
    ).toBe("@all's turn");
  });

  test('a word right before a mention is spaced from it', () => {
    expect(
      serializeClubChannelMessagePlainText(paragraph({ text: 'thanks' }, mention('sam'))),
    ).toBe('thanks @sam');
  });
});
