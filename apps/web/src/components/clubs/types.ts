import { CLUB_SPONSOR_ELIGIBLE_ROLES, hasAnyRole } from '~/apps/shared/roles';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

export type ClubSummary = FunctionReturnType<typeof api.clubs.management.getAll>[number];
export type ClubDetail = NonNullable<FunctionReturnType<typeof api.clubs.detail.get>>;
export type ClubWorkspaceNavigation = NonNullable<
  FunctionReturnType<typeof api.clubs.detail.getWorkspaceNavigation>
>;
export type ClubNavigationSummary = ClubWorkspaceNavigation['myClubs'][number];
export type ClubNavigationChannel = ClubWorkspaceNavigation['channels'][number] & {
  hasUnreadMessages: boolean;
};
export type ClubChannel = NonNullable<ClubDetail['channels']>[number];
export type ClubDirectoryEntry = ClubDetail['directory'][number];
export type ClubPerson = ClubDetail['members'][number]['user'];
export type ClubChannelMessage = FunctionReturnType<
  typeof api.clubs.channels.getMessagePage
>['page'][number];
export type ClubHierarchy = FunctionReturnType<typeof api.clubs.hierarchy.list>;
export type ClubUnit = ClubHierarchy['units'][number];
export type ClubUnitMember = FunctionReturnType<
  typeof api.clubs.hierarchy.listMembers
>[number];

export function formatClubRole(role?: string | null) {
  if (!role) return null;
  const hasMultipleLower = /[a-z].*[a-z]/.test(role);
  if (hasMultipleLower && !role.includes('_')) return role;

  return role
    .toLowerCase()
    .split(/_|\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function isSponsorEligible(person: { roles?: string[] }) {
  return hasAnyRole(person, CLUB_SPONSOR_ELIGIBLE_ROLES);
}
