import { describe, expect, it } from 'vitest';
import { QUEST_KEY_DISPLAY_MS, visibleQuestKeyCount } from './founders-quest';

describe('Founders’ Quest header keys', () => {
  it('keeps earned keys visible while the quest is in progress', () => {
    expect(visibleQuestKeyCount({ keys: ['copper', 'jade'], completedAt: null }, 1_000_000)).toBe(2);
  });

  it('hides the header keys two minutes after completion without changing progress', () => {
    const progress = { keys: ['copper', 'jade', 'crystal'], completedAt: 10_000 };
    expect(visibleQuestKeyCount(progress, 10_000 + QUEST_KEY_DISPLAY_MS - 1)).toBe(3);
    expect(visibleQuestKeyCount(progress, 10_000 + QUEST_KEY_DISPLAY_MS)).toBe(0);
    expect(progress.keys).toHaveLength(3);
  });
});
