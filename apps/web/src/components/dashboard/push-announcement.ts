import type { DevicePlatform } from '@/lib/pwa';
import type { PushAvailability } from '@/lib/push-notifications';

export type PushAnnouncementDevice = {
  platform: DevicePlatform;
  availability: PushAvailability;
  permission: NotificationPermission | 'unsupported';
  optedOut: boolean;
};

/** First-time setup is desktop-only; preserve lost-push recovery on mobile. */
export function getPushAnnouncement(
  device: PushAnnouncementDevice | null,
  promptReenable: boolean,
): 'enable' | 'reenable' | 'blocked' | null {
  if (!device || device.availability !== 'supported' || device.optedOut) return null;
  if (device.platform === 'desktop') {
    if (device.permission === 'denied') return 'blocked';
    if (device.permission === 'default') return promptReenable ? 'reenable' : 'enable';
  } else if (promptReenable && device.permission === 'default') {
    return 'reenable';
  }
  return null;
}
