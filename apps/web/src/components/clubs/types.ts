import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

/** Convex-backed club types — source of truth for ported club UI. */
export type ClubSummary = FunctionReturnType<typeof api.clubs.management.getAll>[number];
export type ClubDetail = NonNullable<FunctionReturnType<typeof api.clubs.detail.get>>;
export type ClubMyClubs = FunctionReturnType<typeof api.clubs.management.getMyClubs>;
export type ClubInvite = FunctionReturnType<typeof api.clubs.management.listMyInvites>[number];
export type ClubChannel = NonNullable<ClubDetail['channels']>[number];
export type ClubTag = NonNullable<ClubDetail['tags']>[number];
export type ClubDirectoryEntry = ClubDetail['directory'][number];
export type ClubMember = ClubDetail['members'][number];
export type ClubSponsor = ClubDetail['sponsors'][number];
export type ClubPerson = ClubMember['user'];
export type ClubUserRef = ClubPerson;
export type ClubChannelMessage = FunctionReturnType<
  typeof api.clubs.channels.getMessages
>[number];

export type { AppRole } from '~/apps/convex/lib/roles';

export interface AnnouncementSummary {
  _id: string;
  title: string;
  body: string;
  createdAt: number | string;
  allowComments: boolean;
  author?: Pick<ClubPerson, '_id' | 'firstName' | 'lastName'>;
  _count?: {
    comments?: number;
  };
}

export function fullName(person: Pick<ClubPerson, 'firstName' | 'lastName'>) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initialsOf(person: Pick<ClubPerson, 'firstName' | 'lastName'>) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

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
  return !!person.roles?.some((role) =>
    ['TEACHER', 'SUPPORT_STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(role),
  );
}
