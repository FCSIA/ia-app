export type AppRole =
  | 'STUDENT'
  | 'STUDENT_LEADER'
  | 'STUDENT_ADMIN'
  | 'TEACHER'
  | 'SPONSOR'
  | 'SUPPORT_STAFF'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export interface ClubUserRef {
  id: string;
  uniqueId?: string | null;
  firstName: string;
  lastName: string;
  roles?: AppRole[];
  email?: string | null;
}

export interface ClubMember {
  userId: string;
  role: 'MEMBER' | 'LEADER';
  user: ClubUserRef;
}

export interface ClubSponsor {
  userId: string;
  user: ClubUserRef;
}

export interface ClubChannel {
  id: string;
  clubId?: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  memberships?: Array<{ userId: string }>;
  _count?: { messages?: number };
}

export interface ClubTag {
  id: string;
  name: string;
  slug: string;
  members: Array<{ user: ClubUserRef }>;
}

export interface ClubDirectoryEntry extends ClubUserRef {
  kind: 'SPONSOR' | 'MEMBER';
  clubRole: 'MEMBER' | 'LEADER' | null;
  joinedAt: string;
}

export interface ClubSummary {
  id: string;
  name: string;
  description?: string | null;
  role?: 'MEMBER' | 'LEADER';
  sponsors?: ClubSponsor[];
  _count?: {
    members?: number;
    channels?: number;
  };
}

export interface ClubDetail extends ClubSummary {
  members: ClubMember[];
  sponsors: ClubSponsor[];
  channels?: ClubChannel[];
  tags?: ClubTag[];
  directory: ClubDirectoryEntry[];
}

export interface ClubInvite {
  id: string;
  club: Pick<ClubSummary, 'id' | 'name' | 'description'>;
  sender: Pick<ClubUserRef, 'id' | 'firstName' | 'lastName'>;
}

export interface ClubChannelMessageMention {
  id: string;
  kind: 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
  token: string;
  user?: ClubUserRef | null;
  tag?: Pick<ClubTag, 'id' | 'name' | 'slug'> | null;
}

export interface ClubChannelMessage {
  id: string;
  body: string;
  createdAt: string;
  author: ClubUserRef;
  mentions: ClubChannelMessageMention[];
}

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

export function isSponsorEligible(person: ClubUserRef) {
  return !!person.roles?.includes('SPONSOR');
}
