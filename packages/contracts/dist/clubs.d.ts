import type { AppRole } from './auth';
export type ClubDirectoryKind = 'SPONSOR' | 'MEMBER';
export type ClubMemberRole = 'MEMBER' | 'LEADER';
export type ClubMentionKind = 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
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
    role: ClubMemberRole;
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
    memberships?: Array<{
        userId: string;
    }>;
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
    role?: ClubMemberRole;
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
export interface ClubChannelReactionSummary {
    emoji: string;
    count: number;
    reactedByCurrentUser: boolean;
    reactors: ClubUserRef[];
}
export interface ClubChannelMessage {
    id: string;
    body: string;
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
    isPrivate?: boolean;
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
    parentMessageId?: string;
    attachments?: Array<{
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        size?: number;
    }>;
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
