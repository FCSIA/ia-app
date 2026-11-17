import { expect, test } from 'vitest';
import { selectUnreadChannels } from './unread-channel-selection';

test('intersects readable navigation with unread activity and preserves navigation order', () => {
  const channels = [{ _id: 'b' }, { _id: 'a' }, { _id: 'read' }];
  expect(selectUnreadChannels(channels, [
    { channelId: 'hidden', hasUnreadMessages: true },
    { channelId: 'a', hasUnreadMessages: true },
    { channelId: 'b', hasUnreadMessages: true },
    { channelId: 'read', hasUnreadMessages: false },
  ])).toEqual([{ _id: 'b' }, { _id: 'a' }]);
  expect(channels).toHaveLength(3);
});

test('missing activity never invents unread state', () => {
  expect(selectUnreadChannels([{ _id: 'a' }], [])).toEqual([]);
});
