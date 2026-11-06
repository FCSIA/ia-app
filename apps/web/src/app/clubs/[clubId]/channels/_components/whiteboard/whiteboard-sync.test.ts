import { describe, expect, test } from 'vitest';
import {
  MAX_WHITEBOARD_ELEMENTS_PER_SAVE,
  MAX_WHITEBOARD_SAVE_BYTES,
} from '~/apps/shared/chat/whiteboard-limits';
import {
  chunkWhiteboardElements,
  cursorActiveSince,
  cursorColor,
  pendingWhiteboardElements,
  stepCursor,
} from './whiteboard-sync';

const supported = new Set(['rectangle', 'text', 'freedraw']);
const el = (id: string, version: number, overrides: Partial<{ type: string; isDeleted: boolean }> = {}) => ({
  id,
  version,
  type: 'rectangle',
  isDeleted: false,
  ...overrides,
});

describe('pending whiteboard elements', () => {
  test('sends only elements whose version was never synced', () => {
    const synced = new Map([['a', 2], ['b', 1]]);
    const pending = pendingWhiteboardElements(
      [el('a', 2), el('b', 3), el('c', 1)],
      {},
      synced,
      supported,
    );
    expect(pending.map((element) => element.id)).toEqual(['b', 'c']);
  });

  test('holds back strokes, text, and gestures that are still in progress', () => {
    const elements = [el('drawing', 5, { type: 'freedraw' }), el('typing', 2, { type: 'text' }), el('dragged', 4), el('still', 1)];
    const pending = pendingWhiteboardElements(
      elements,
      {
        newElement: { id: 'drawing' },
        editingTextElement: { id: 'typing' },
        selectedElementIds: { dragged: true },
        selectedElementsAreBeingDragged: true,
      },
      new Map(),
      supported,
    );
    expect(pending.map((element) => element.id)).toEqual(['still']);
  });

  test('skips unsupported and never-shared deleted elements', () => {
    const pending = pendingWhiteboardElements(
      [el('img', 1, { type: 'image' }), el('gone', 2, { isDeleted: true }), el('removed', 3, { isDeleted: true })],
      {},
      new Map([['removed', 2]]),
      supported,
    );
    expect(pending.map((element) => element.id)).toEqual(['removed']);
  });
});

describe('whiteboard save chunks', () => {
  test("stays within the server's element count bound", () => {
    const elements = Array.from({ length: MAX_WHITEBOARD_ELEMENTS_PER_SAVE * 2 + 1 }, () => '{}');
    const chunks = chunkWhiteboardElements(elements);
    expect(chunks.every((chunk) => chunk.length <= MAX_WHITEBOARD_ELEMENTS_PER_SAVE)).toBe(true);
    expect(chunks.flat()).toHaveLength(elements.length);
  });

  test("stays within the server's byte bound", () => {
    const elements = Array.from({ length: 6 }, () => 'x'.repeat(200_000));
    const chunks = chunkWhiteboardElements(elements);
    expect(chunks.every((chunk) => chunk.join('').length <= MAX_WHITEBOARD_SAVE_BYTES)).toBe(true);
    expect(chunks.flat()).toHaveLength(elements.length);
  });
});

describe('cursor helpers', () => {
  test('rounds the stale cutoff into ten second buckets', () => {
    expect(cursorActiveSince(100_000)).toBe(70_000);
    expect(cursorActiveSince(109_999)).toBe(70_000);
    expect(cursorActiveSince(110_000)).toBe(80_000);
  });

  test('eases toward the target and settles', () => {
    let shown = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const first = stepCursor(shown, target);
    expect(first.point.x).toBeCloseTo(30);
    expect(first.settled).toBe(false);
    let frames = 0;
    for (let settled = false; !settled; frames += 1) {
      const step = stepCursor(shown, target);
      shown = step.point;
      settled = step.settled;
    }
    expect(shown).toEqual(target);
    expect(frames).toBeLessThan(20);
  });

  test('keeps a stable color per user', () => {
    expect(cursorColor('user-a')).toBe(cursorColor('user-a'));
    expect(cursorColor('user-a')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
