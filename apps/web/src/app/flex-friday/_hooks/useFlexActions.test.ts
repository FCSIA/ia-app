import { describe, expect, it, vi } from 'vitest';
import { runFlexAction } from './useFlexActions';

describe('runFlexAction', () => {
  it('reports success without calling the failure handler', async () => {
    const onFailure = vi.fn();
    await expect(runFlexAction(async () => 'ok', onFailure)).resolves.toBe(true);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reports the error message and returns false instead of throwing', async () => {
    const onFailure = vi.fn();
    const failing = async () => {
      throw new Error('Workshop is full');
    };
    await expect(runFlexAction(failing, onFailure)).resolves.toBe(false);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('Workshop is full');
  });

  it('falls back to a generic message for non-Error failures', async () => {
    const onFailure = vi.fn();
    await expect(runFlexAction(() => Promise.reject('nope'), onFailure)).resolves.toBe(false);
    expect(onFailure).toHaveBeenCalledWith('Failed');
  });
});
