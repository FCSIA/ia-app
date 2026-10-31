import { describe, expect, test } from 'vitest';
import { ChatDraftStore, chatDraftKey, getChatDraftStore } from './chat-draft-store';

function populated() {
  const store = new ChatDraftStore();
  store.set('richValue', [{ type: 'p', children: [{ text: 'Hello', bold: true }] }]);
  store.set('replyToMessageId', 'reply-1');
  store.set('files', [new File(['photo'], 'photo.png', { type: 'image/png' })]);
  store.set('pollOpen', true);
  store.set('pollQuestion', 'When?');
  store.set('pollOptions', ['Today', 'Tomorrow']);
  return store;
}
describe('chat send recovery', () => {
  test.each(['upload', 'post'])('%s failure retains rich text, reply, files and poll for retry', () => {
    const store = populated();
    const draft = store.getSnapshot().draft;
    const submitted = store.begin()!;
    expect(store.begin()).toBeNull();
    store.finish(submitted, false);
    expect(store.getSnapshot().draft).toBe(draft);
    expect(store.getSnapshot().pending).toBe(false);
    const retry = store.begin()!;
    expect(retry).toBe(draft);
    store.finish(retry, true);
    expect(store.getSnapshot().draft.files).toEqual([]);
    expect(store.getSnapshot().draft.replyToMessageId).toBeNull();
    expect(store.getSnapshot().draft.pollOpen).toBe(false);
    expect(store.getSnapshot().draft.richValue).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });
  test.each([true, false])('newer typing and reply survive completion (success=%s)', (success) => {
    const store = populated();
    const submitted = store.begin()!;
    const newer = [{ type: 'p', children: [{ text: 'Newer typing' }] }];
    store.set('richValue', newer);
    store.set('replyToMessageId', 'reply-2');
    store.finish(submitted, success);
    expect(store.getSnapshot().draft.richValue).toBe(newer);
    expect(store.getSnapshot().draft.replyToMessageId).toBe('reply-2');
  });
  test('a newly selected reply survives even when it returns to the original target', () => {
    const store = populated();
    const submitted = store.begin()!;
    store.set('replyToMessageId', null);
    store.set('replyToMessageId', 'reply-1');
    store.finish(submitted, true);
    expect(store.getSnapshot().draft.replyToMessageId).toBe('reply-1');
  });
  test('edited polls retain their complete options after successful send', () => {
    const store = populated();
    const submitted = store.begin()!;
    store.set('pollQuestion', 'Where?');
    store.finish(submitted, true);
    expect(store.getSnapshot().draft).toMatchObject({ pollOpen: true, pollQuestion: 'Where?', pollOptions: ['Today', 'Tomorrow'] });
  });
  test('successful files cannot be duplicated with a later attachment', () => {
    const store = populated();
    const submitted = store.begin()!;
    const nextFile = new File(['next'], 'next.txt');
    store.set('files', (files) => [...files, nextFile]);
    store.finish(submitted, true);
    expect(store.getSnapshot().draft.files).toEqual([nextFile]);
  });
  test('navigation and remount retain pending sends and failed drafts', () => {
    const key = chatDraftKey('navigation-user', 'channel');
    const store = getChatDraftStore(key);
    store.set('files', [new File(['x'], 'x.txt')]);
    const submitted = store.begin()!;
    const remounted = getChatDraftStore(key);
    expect(remounted.getSnapshot().pending).toBe(true);
    expect(remounted.begin()).toBeNull();
    store.finish(submitted, false);
    expect(remounted.getSnapshot().draft.files[0].name).toBe('x.txt');
    expect(remounted.begin()).not.toBeNull();
  });
  test('users, channels and threads have independent drafts and pending sends', () => {
    const stores = [
      chatDraftKey('a', 'one'), chatDraftKey('a', 'two'),
      chatDraftKey('a', 'one', 'thread1'), chatDraftKey('a', 'one', 'thread2'),
      chatDraftKey('b', 'one'),
    ].map(getChatDraftStore);
    expect(new Set(stores).size).toBe(stores.length);
    const submissions = stores.map((store, index) => {
      store.set('replyToMessageId', `reply-${index}`);
      return store.begin()!;
    });
    stores[0].finish(submissions[0], true);
    stores[1].finish(submissions[1], false);
    expect(stores[0].getSnapshot().draft.replyToMessageId).toBeNull();
    expect(stores[1].getSnapshot().draft.replyToMessageId).toBe('reply-1');
    expect(stores[2].getSnapshot().pending).toBe(true);
    expect(stores[3].getSnapshot().pending).toBe(true);
  });
});
