export type UserRole =
  | 'STUDENT'
  | 'STUDENT_LEADER'
  | 'STUDENT_ADMIN'
  | 'TEACHER'
  | 'SPONSOR'
  | 'SUPPORT_STAFF'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type Pathway =
  | 'INFORMATION_TECHNOLOGY'
  | 'HEALTH_SCIENCE'
  | 'ENGINEERING';

export interface AppUser {
  id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  gradeLevel?: number | null;
  major?: Pathway | null;
  minor?: Pathway | null;
  email?: string | null;
  isActive?: boolean;
}

export interface CountSummary {
  comments?: number;
  members?: number;
  registrations?: number;
  sessions?: number;
}

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string;
  targetType: string;
  allowComments: boolean;
  isAdminGeneral: boolean;
  status: string;
  createdAt: string;
  expiresAt?: string | null;
  author?: Pick<AppUser, 'id' | 'firstName' | 'lastName'>;
  _count?: CountSummary;
}

export interface AnnouncementComment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  author: Pick<AppUser, 'id' | 'firstName' | 'lastName'>;
}

export interface AnnouncementDetail extends AnnouncementSummary {
  comments: AnnouncementComment[];
}

export interface ClubMembership {
  userId: string;
  role: 'MEMBER' | 'LEADER';
  user: Pick<AppUser, 'id' | 'firstName' | 'lastName' | 'uniqueId'>;
}

export interface ClubSponsor {
  userId: string;
  user: Pick<AppUser, 'id' | 'firstName' | 'lastName' | 'uniqueId'>;
}

export interface ClubDirectoryEntry {
  id: string;
  uniqueId?: string | null;
  firstName: string;
  lastName: string;
  kind: 'SPONSOR' | 'MEMBER';
  clubRole: 'MEMBER' | 'LEADER' | null;
  joinedAt: string;
}

export interface ClubSummary {
  id: string;
  name: string;
  description?: string | null;
  role?: 'MEMBER' | 'LEADER';
  _count?: CountSummary;
}

export interface ClubChannelTag {
  id: string;
  name: string;
  slug: string;
  members: Array<{
    user: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'>;
  }>;
}

export interface ClubChannelSummary {
  id: string;
  clubId: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  memberships?: Array<{ userId: string }>;
  _count?: { messages?: number };
}

export interface ClubDetail extends ClubSummary {
  members: ClubMembership[];
  sponsors: ClubSponsor[];
  channels?: ClubChannelSummary[];
  tags?: ClubChannelTag[];
  directory: ClubDirectoryEntry[];
}

export interface ClubInvite {
  id: string;
  club: Pick<ClubSummary, 'id' | 'name' | 'description'>;
  sender: Pick<AppUser, 'id' | 'firstName' | 'lastName'>;
}

export interface EventRecord {
  id: string;
  authorId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt?: string | null;
  status: string;
  type: string;
  createdAt?: string;
  club?: Pick<ClubSummary, 'id' | 'name'> | null;
  author?: Pick<AppUser, 'id' | 'firstName' | 'lastName'>;
}

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt?: string | null;
  tags: string[];
  event?: {
    id: string;
    status: string;
    type: string;
    club?: Pick<ClubSummary, 'id' | 'name'> | null;
  } | null;
}

export interface FlexFridayRecord {
  id: string;
  date: string;
  type: string;
  isSchoolDay: boolean;
  notes?: string | null;
  _count?: CountSummary;
}

export interface FlexSession {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  capacity?: number | null;
  sessionType: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNED';
  _count?: CountSummary;
  registrations?: Array<{ id: string }>;
  assignments?: Array<{ id: string }>;
}

export interface FlexRegistration {
  id: string;
  sessionId: string;
  session?: {
    id: string;
    title: string;
    location?: string | null;
    flexFriday?: FlexFridayRecord;
  };
}

export interface NotificationRecord {
  id: string;
  category: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  announcementId?: string | null;
  eventId?: string | null;
  clubId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
}

export interface ClubChannelMessageMention {
  id: string;
  kind: 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
  token: string;
  user?: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'> | null;
  tag?: Pick<ClubChannelTag, 'id' | 'name' | 'slug'> | null;
}

export interface ClubChannelMessage {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'>;
  mentions: ClubChannelMessageMention[];
}
