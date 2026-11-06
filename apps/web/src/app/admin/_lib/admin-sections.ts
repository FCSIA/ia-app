import { ChartLine, ContactRound, FileText, MessageSquareText, MessageSquareWarning, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';

export type AdminAccess = { isSuperAdmin: boolean; canManageWrapped: boolean };

type AdminSection = {
  id: string;
  label: string;
  group: 'People' | 'Safety' | 'Insights';
  icon: LucideIcon;
  canSee: (access: AdminAccess) => boolean;
};

const always = () => true;
const superAdminOnly = ({ isSuperAdmin }: AdminAccess) => isSuperAdmin;

/** Each section, who sees it, and where it sits in the sidebar; the sidebar, the URL and the page body all read this. */
const ADMIN_SECTIONS = [
  { id: 'users', label: 'Users', group: 'People', icon: Users, canSee: always },
  { id: 'schedule', label: 'Student roster', group: 'People', icon: ContactRound, canSee: superAdminOnly },
  { id: 'administrator-roster', label: 'Admin roster', group: 'People', icon: ShieldCheck, canSee: superAdminOnly },
  { id: 'moderation', label: 'Reports', group: 'Safety', icon: MessageSquareWarning, canSee: always },
  { id: 'feedback', label: 'Feedback', group: 'Safety', icon: MessageSquareText, canSee: superAdminOnly },
  { id: 'wrapped', label: 'Wrapped', group: 'Insights', icon: Sparkles, canSee: ({ canManageWrapped }) => canManageWrapped },
  { id: 'analytics', label: 'Analytics', group: 'Insights', icon: ChartLine, canSee: superAdminOnly },
  { id: 'audit', label: 'Audit log', group: 'Insights', icon: FileText, canSee: always },
] as const satisfies readonly AdminSection[];

export type AdminTabId = (typeof ADMIN_SECTIONS)[number]['id'];

export const ADMIN_SECTION_GROUPS = ['People', 'Safety', 'Insights'] as const;

export function visibleAdminSections(access: AdminAccess) {
  return ADMIN_SECTIONS.filter((section) => section.canSee(access));
}

const LEGACY_USER_TABS = new Set(['permissions', 'student-admins']);

export function isLegacyUserTab(tab: string | null) {
  return tab !== null && LEGACY_USER_TABS.has(tab);
}

export function resolveAdminTab(requestedTab: string | null, access: AdminAccess): AdminTabId {
  if (isLegacyUserTab(requestedTab)) return 'users';
  return visibleAdminSections(access).find((section) => section.id === requestedTab)?.id ?? 'users';
}
