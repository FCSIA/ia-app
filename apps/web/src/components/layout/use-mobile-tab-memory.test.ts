import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStored, tabIdForPathname } from './use-mobile-tab-memory';

afterEach(() => vi.unstubAllGlobals());

describe('mobile Home route memory', () => {
  it('recognizes root as Home while retaining other tab destinations', () => {
    expect(tabIdForPathname('/')).toBe('dashboard');
    expect(tabIdForPathname('/clubs/club/channels/channel')).toBe('clubs');
    expect(tabIdForPathname('/announcements')).toBe('announcements');
    expect(tabIdForPathname('/profile')).toBeNull();
  });

  it.each([
    ['/dashboard', '/'],
    ['/dashboard?view=home', '/?view=home'],
    ['/', '/'],
    ['/?view=home', '/?view=home'],
    ['/clubs/club', null],
    ['//external.example', null],
    ['/dashboard-other', null],
  ])('normalizes the stored Home destination %s to %s', (stored, expected) => {
    vi.stubGlobal('window', { localStorage: { getItem: () => stored } });
    expect(readStored('dashboard')).toBe(expected);
  });

  it('keeps saved channel destinations within the Clubs tab', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => '/clubs/club/channels/channel?thread=reply' },
    });
    expect(readStored('clubs')).toBe('/clubs/club/channels/channel?thread=reply');
    expect(readStored('dashboard')).toBeNull();
  });
});
