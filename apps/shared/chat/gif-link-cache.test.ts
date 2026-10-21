import { describe, expect, test, vi } from 'vitest';
import { createGifLinkCache } from './gif-link-cache';

describe('GIF resolution cache', () => {
  test('shares in-flight requests and completed resolutions', async () => {
    const cache = createGifLinkCache();
    const resolve = vi.fn(async () => 'https://media.tenor.com/example.gif');
    const first = cache(resolve, 'share');
    expect(cache(resolve, 'share')).toBe(first);
    expect(await first).toContain('example.gif');
    expect(await cache(resolve, 'share')).toContain('example.gif');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('bounds retained results and retries failures', async () => {
    const cache = createGifLinkCache(2);
    const resolve = vi.fn(async ({ url }: { url: string }) => url);
    for (const url of ['a', 'b', 'c', 'a']) await cache(resolve, url);
    expect(resolve).toHaveBeenCalledTimes(4);
    const failed = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('ok');
    await expect(cache(failed, 'retry')).rejects.toThrow('offline');
    expect(await cache(failed, 'retry')).toBe('ok');
  });

  test('a late evicted failure cannot remove a newer resolution', async () => {
    const cache = createGifLinkCache(1);
    let reject!: (error: Error) => void;
    let calls = 0;
    const resolve = vi.fn(({ url }: { url: string }) => {
      calls += 1;
      return url === 'a' && calls === 1
        ? new Promise<string>((_, fail) => { reject = fail; }) : Promise.resolve(url);
    });
    const first = cache(resolve, 'a');
    const failure = expect(first).rejects.toThrow('offline');
    await cache(resolve, 'b');
    const newer = cache(resolve, 'a');
    reject(new Error('offline'));
    await failure;
    expect(cache(resolve, 'a')).toBe(newer);
    expect(resolve).toHaveBeenCalledTimes(3);
  });
});
