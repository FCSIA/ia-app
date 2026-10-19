import { describe, expect, test } from 'vitest';
import { getPushAnnouncement, type PushAnnouncementDevice } from './push-announcement';

const desktop: PushAnnouncementDevice = {
  platform: 'desktop',
  availability: 'supported',
  permission: 'default',
  optedOut: false,
};

describe('dashboard push announcement eligibility', () => {
  test('offers first-time desktop setup without requiring a lost-push report', () => {
    expect(getPushAnnouncement(desktop, false)).toBe('enable');
    expect(getPushAnnouncement(null, true)).toBeNull();
  });

  test('offers settings guidance when desktop permission is blocked', () => {
    expect(getPushAnnouncement({ ...desktop, permission: 'denied' }, false)).toBe('blocked');
    expect(getPushAnnouncement({ ...desktop, permission: 'denied' }, true)).toBe('blocked');
  });

  test('never prompts an intentionally opted-out browser, including lost-push reports', () => {
    for (const permission of ['default', 'denied', 'granted'] as const) {
      for (const platform of ['desktop', 'ios', 'android'] as const) {
        expect(getPushAnnouncement({ ...desktop, permission, platform, optedOut: true }, true)).toBeNull();
      }
    }
  });

  test('hides after permission is granted even if a recovery report is stale', () => {
    expect(getPushAnnouncement({ ...desktop, permission: 'granted' }, true)).toBeNull();
  });

  test('excludes unsupported browsers and iOS tabs requiring installation', () => {
    expect(getPushAnnouncement({ ...desktop, availability: 'unsupported' }, true)).toBeNull();
    expect(getPushAnnouncement({ ...desktop, permission: 'unsupported' }, false)).toBeNull();
    expect(getPushAnnouncement({ ...desktop, platform: 'ios', availability: 'needs-ios-install' }, true)).toBeNull();
  });

  test('preserves recovery on all supported platforms without prompting new mobile installs', () => {
    for (const platform of ['desktop', 'ios', 'android'] as const) {
      expect(getPushAnnouncement({ ...desktop, platform }, true)).toBe('reenable');
    }
    for (const platform of ['ios', 'android'] as const) {
      expect(getPushAnnouncement({ ...desktop, platform }, false)).toBeNull();
      expect(getPushAnnouncement({ ...desktop, platform, permission: 'denied' }, true)).toBeNull();
    }
  });
});
