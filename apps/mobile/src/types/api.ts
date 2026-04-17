import type { AppRole, AppUser, Pathway } from '@ia/contracts/auth';
import type {
  ClubChannel,
  ClubChannel as ClubChannelSummary,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubChannelMessageMention,
  ClubDetail,
  ClubDirectoryEntry,
  ClubInvite,
  ClubMember,
  ClubMember as ClubMembership,
  ClubSponsor,
  ClubSummary,
  ClubTag,
  ClubTag as ClubChannelTag,
} from '@ia/contracts/clubs';
import type {
  FriendshipStatus,
  ScheduleDashboardResponse,
  ScheduleFriend,
  ScheduleFriendRequest,
  ScheduleSearchResult,
  ScheduleVisibility,
  ScheduleWeekday,
  SchoolDayBlock,
  SchoolDayBlockPayload,
  StudentScheduleEntry,
  StudentScheduleRecord,
  UpsertStudentSchedulePayload,
} from '@ia/contracts/schedule';

export type { AppRole as UserRole, AppUser, Pathway };
export type {
  ClubChannel,
  ClubChannelSummary,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubChannelMessageMention,
  ClubDetail,
  ClubDirectoryEntry,
  ClubInvite,
  ClubMember,
  ClubMembership,
  ClubSponsor,
  ClubSummary,
  ClubTag,
  ClubChannelTag,
};
export type {
  FriendshipStatus,
  ScheduleDashboardResponse,
  ScheduleFriend,
  ScheduleFriendRequest,
  ScheduleSearchResult,
  ScheduleVisibility,
  ScheduleWeekday,
  SchoolDayBlock,
  SchoolDayBlockPayload,
  StudentScheduleEntry,
  StudentScheduleRecord,
  UpsertStudentSchedulePayload,
};

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
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count?: CountSummary;
}

export interface AnnouncementComment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface AnnouncementDetail extends AnnouncementSummary {
  comments: AnnouncementComment[];
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
  clubId?: string | null;
  createdAt?: string;
  club?: Pick<ClubSummary, 'id' | 'name'> | null;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
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
    clubId?: string | null;
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
