import { Bell, Palette, PanelBottom, ShieldAlert, User, type LucideIcon } from 'lucide-react';

export type ProfileSection =
  | 'account'
  | 'notifications'
  | 'appearance'
  | 'navigation'
  | 'moderation'
  | 'whats-new';

export const PROFILE_SECTIONS: Array<{
  id: ProfileSection;
  label: string;
  icon?: LucideIcon;
}> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'navigation', label: 'Navigation', icon: PanelBottom },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'whats-new', label: "What's new" },
];
