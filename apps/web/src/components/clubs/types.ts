export type {
  ClubBulkInviteResult,
  ClubChannel,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubChannelMessageMention,
  ClubChannelReactionSummary,
  ClubDetail,
  ClubDirectoryEntry,
  ClubInvite,
  ClubMember,
  ClubSponsor,
  ClubSummary,
  ClubTag,
  ClubUserRef,
  CreateClubChannelMessagePayload,
} from '@ia/contracts/clubs';

export type { AppRole } from '@ia/contracts/auth';

import type { ClubUserRef } from '@ia/contracts/clubs';

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  allowComments: boolean;
  author?: Pick<ClubUserRef, 'id' | 'firstName' | 'lastName'>;
  _count?: {
    comments?: number;
  };
}

export function fullName(person: Pick<ClubUserRef, 'firstName' | 'lastName'>) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initialsOf(person: Pick<ClubUserRef, 'firstName' | 'lastName'>) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export function formatClubRole(role?: string | null) {
  if (!role) return null;
  return role.toLowerCase().replace(/_/g, ' ');
}

export function isSponsorEligible(person: { roles?: string[] }) {
  return !!person.roles?.includes('SPONSOR');
}
