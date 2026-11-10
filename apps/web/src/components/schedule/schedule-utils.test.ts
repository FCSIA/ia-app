import { describe, expect, it } from 'vitest';
import { findCurrentAndNext } from './schedule-utils';

const blocks = [
  { startTime: '08:00', endTime: '08:45' },
  { startTime: '08:50', endTime: '09:35' },
  { startTime: '09:40', endTime: '10:25' },
];

describe('findCurrentAndNext', () => {
  it('returns the block in progress and the next one to start', () => {
    expect(findCurrentAndNext(blocks, 8 * 60 + 10)).toEqual({ current: blocks[0], next: blocks[1] });
  });

  it('has no current block between classes', () => {
    expect(findCurrentAndNext(blocks, 8 * 60 + 47)).toEqual({ current: null, next: blocks[1] });
  });

  it('treats the end minute as outside the block', () => {
    expect(findCurrentAndNext(blocks, 9 * 60 + 35).current).toBeNull();
  });

  it('has nothing next after the last block', () => {
    expect(findCurrentAndNext(blocks, 11 * 60)).toEqual({ current: null, next: null });
  });
});
