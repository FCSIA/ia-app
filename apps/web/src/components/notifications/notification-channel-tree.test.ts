import { describe, expect, test } from 'vitest';
import { buildNotificationChannelTree } from './notification-channel-tree';

const unit = (_id: string, parentUnitId: string | null, position = 0) => ({ _id, parentUnitId, position });
const channel = (_id: string, ownerUnitId?: string) => ({ _id, ownerUnitId });

describe('notification channel hierarchy', () => {
  test('preserves nested placement and workspace ordering while pruning empty units', () => {
    const root = unit('root', null);
    const child = unit('child', 'root');
    const first = unit('first', null, -1);
    const rootChannel = channel('root-channel', 'root');
    const childChannel = channel('child-channel', 'child');
    const firstChannel = channel('first-channel', 'first');
    expect(buildNotificationChannelTree([child, root, unit('empty', null), first], [firstChannel, rootChannel, childChannel])).toEqual([
      { kind: 'unit', unit: first, children: [{ kind: 'channel', channel: firstChannel }] },
      { kind: 'unit', unit: root, children: [
        { kind: 'channel', channel: rootChannel },
        { kind: 'unit', unit: child, children: [{ kind: 'channel', channel: childChannel }] },
      ] },
    ]);
  });

  test('keeps unplaced channels and orphaned branches available', () => {
    const orphan = unit('orphan', 'missing');
    const unplaced = channel('unplaced');
    const missingOwner = channel('missing-owner', 'missing');
    const nested = channel('nested', 'orphan');
    expect(buildNotificationChannelTree([orphan], [unplaced, missingOwner, nested])).toEqual([
      { kind: 'channel', channel: unplaced },
      { kind: 'channel', channel: missingOwner },
      { kind: 'unit', unit: orphan, children: [{ kind: 'channel', channel: nested }] },
    ]);
  });

  test('terminates stale parent cycles without duplicating or dropping channels', () => {
    const a = unit('a', 'b');
    const b = unit('b', 'a');
    const readable = channel('readable', 'b');
    expect(buildNotificationChannelTree([a, b], [readable])).toEqual([
      { kind: 'unit', unit: a, children: [
        { kind: 'unit', unit: b, children: [{ kind: 'channel', channel: readable }] },
      ] },
    ]);
  });
});
