import type { AppRole } from './auth';

export type ClubDirectoryKind = 'SPONSOR' | 'MEMBER';
export type ClubMemberRole = string;
export type ClubMentionKind = 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
export type ClubJoinPolicy = 'OPEN' | 'REQUEST';
export type ClubChannelVisibility = 'PUBLIC' | 'PRIVATE' | 'MEMBER_READONLY';

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
  role?: ClubMemberRole | null;
  user: ClubUserRef;
}

export interface ClubLeader extends ClubMember {}

export interface ClubSponsor {
  userId: string;
  user: ClubUserRef;
}

export interface ClubChannel {
  id: string;
  clubId?: string;
  name: string;
  description?: string | null;
  visibility: ClubChannelVisibility;
  viewerCanRead?: boolean;
  viewerCanPost?: boolean;
  memberships?: Array<{ userId: string }>;
  _count?: {
    messages?: number;
  };
}

export interface ClubTag {
  id: string;
  name: string;
  slug: string;
  members: Array<{
    user: ClubUserRef;
  }>;
}

export interface ClubDirectoryEntry extends ClubUserRef {
  kind: ClubDirectoryKind;
  clubRole: ClubMemberRole | null;
  joinedAt: string;
}

export interface ClubSummary {
  id: string;
  name: string;
  description?: string | null;
  overview?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string | null;
  joinPolicy?: ClubJoinPolicy;
  role?: ClubMemberRole | null;
  sponsors?: ClubSponsor[];
  _count?: {
    members?: number;
    channels?: number;
  };
}

export interface ClubViewerState {
  isMember: boolean;
  hasClubRole: boolean;
  isSponsor: boolean;
  isAdmin: boolean;
  canAccessWorkspace: boolean;
  canManageChannels: boolean;
  canManageMembership: boolean;
  canApproveJoinRequests: boolean;
  hasPendingJoinRequest: boolean;
}

export interface ClubJoinRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  createdAt: string;
  requester: ClubUserRef;
}

export interface ClubDetail extends ClubSummary {
  members: ClubMember[];
  leaders: ClubLeader[];
  sponsors: ClubSponsor[];
  channels?: ClubChannel[];
  tags?: ClubTag[];
  directory: ClubDirectoryEntry[];
  viewer: ClubViewerState;
  pendingJoinRequests?: ClubJoinRequest[];
  activeJoinCode?: {
    code: string;
    updatedAt?: string | null;
  } | null;
}

export interface ClubInvite {
  id: string;
  club: Pick<ClubSummary, 'id' | 'name' | 'description'>;
  sender: Pick<ClubUserRef, 'id' | 'firstName' | 'lastName'>;
}

export interface ClubChannelMessageMention {
  id: string;
  kind: ClubMentionKind;
  token: string;
  user?: ClubUserRef | null;
  tag?: Pick<ClubTag, 'id' | 'name' | 'slug'> | null;
}

export interface ClubChannelMessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
}

export type ClubChannelMessageRichBody = Array<Record<string, unknown>>;

export interface ClubChannelReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
  reactors: ClubUserRef[];
}

export interface ClubChannelMessage {
  id: string;
  body: string;
  bodyRich?: ClubChannelMessageRichBody | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  poll?: {
    question: string;
    options: Array<{
      id: string;
      label: string;
      count: number;
      votedByCurrentUser: boolean;
    }>;
    totalVotes: number;
    selectedOptionId?: string | null;
  } | null;
  createdAt: string;
  updatedAt?: string;
  parentMessageId?: string | null;
  threadRootId: string;
  author: ClubUserRef;
  mentions: ClubChannelMessageMention[];
  attachments: ClubChannelMessageAttachment[];
  reactions: ClubChannelReactionSummary[];
  replies: ClubChannelMessage[];
  replyCount: number;
}

export interface CreateClubChannelPayload {
  name: string;
  description?: string;
  visibility?: ClubChannelVisibility;
  memberIds?: string[];
  memberUniqueIds?: string[];
}

export interface CreateClubTagPayload {
  name: string;
  memberIds?: string[];
  memberUniqueIds?: string[];
}

export interface CreateClubChannelMessagePayload {
  body?: string;
  bodyRich?: ClubChannelMessageRichBody;
  parentMessageId?: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
    size?: number;
  }>;
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; label: string }>;
}

export interface ToggleClubChannelReactionPayload {
  emoji: string;
}

export interface ChatAttachmentUploadResponse {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ClubBulkInviteResult {
  invited: number;
  skipped: number;
  errors: string[];
}
