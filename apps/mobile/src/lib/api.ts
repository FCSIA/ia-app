import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import type { AppUser, AuthLoginResponse } from '@ia/contracts/auth';
import type {
  ChatAttachmentUploadResponse,
  CreateClubChannelMessagePayload,
  CreateClubChannelPayload,
  CreateClubTagPayload,
  ToggleClubChannelReactionPayload,
} from '@ia/contracts/clubs';
import type {
  SchoolDayBlockPayload,
  UpsertStudentSchedulePayload,
} from '@ia/contracts/schedule';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const TOKEN_KEY = 'ia_token';
export const USER_KEY = 'ia_user';

export function toApiUrl(path: string) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (uniqueId: string, password: string) =>
    api.post<AuthLoginResponse>('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<AppUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const announcementsApi = {
  getAll: (archived = false, clubId?: string) =>
    api.get('/announcements', { params: { archived, clubId } }),
  getOne: (id: string) => api.get(`/announcements/${id}`),
  create: (data: {
    title: string;
    body: string;
    targetType: string;
    clubId?: string;
    allowComments?: boolean;
    targetRoles?: string[];
    targetGradeLevels?: number[];
    targetPathway?: string;
    expiresAt?: string;
  }) => api.post('/announcements', data),
  archive: (id: string) => api.patch(`/announcements/${id}/archive`),
  addComment: (id: string, body: string) =>
    api.post(`/announcements/${id}/comments`, { body }),
  deleteComment: (commentId: string) =>
    api.delete(`/announcements/comments/${commentId}`),
};

export const clubsApi = {
  getAll: () => api.get('/clubs'),
  getMyClubs: () => api.get('/clubs/my'),
  getMyInvites: () => api.get('/clubs/my/invites'),
  getOne: (id: string) => api.get(`/clubs/${id}`),
  getChannels: (clubId: string) => api.get(`/clubs/${clubId}/channels`),
  getChannelMessages: (clubId: string, channelId: string) =>
    api.get(`/clubs/${clubId}/channels/${channelId}/messages`),
  createChannel: (clubId: string, data: CreateClubChannelPayload) =>
    api.post(`/clubs/${clubId}/channels`, data),
  createTag: (clubId: string, data: CreateClubTagPayload) =>
    api.post(`/clubs/${clubId}/tags`, data),
  postChannelMessage: (
    clubId: string,
    channelId: string,
    data: CreateClubChannelMessagePayload,
  ) => api.post(`/clubs/${clubId}/channels/${channelId}/messages`, data),
  toggleChannelReaction: (
    clubId: string,
    channelId: string,
    messageId: string,
    data: ToggleClubChannelReactionPayload,
  ) =>
    api.post(
      `/clubs/${clubId}/channels/${channelId}/messages/${messageId}/reactions`,
      data,
    ),
  sendInvite: (clubId: string, uniqueId: string) =>
    api.post(`/clubs/${clubId}/invite`, { uniqueId }),
  respondToInvite: (inviteId: string, accept: boolean) =>
    api.post(`/clubs/invites/${inviteId}/respond`, { accept }),
  promoteMember: (clubId: string, memberId: string) =>
    api.post(`/clubs/${clubId}/members/${memberId}/promote`),
  removeMember: (clubId: string, memberId: string) =>
    api.post(`/clubs/${clubId}/members/${memberId}/remove`),
};

export const eventsApi = {
  getAll: (clubId?: string) => api.get('/events', { params: { clubId } }),
  getOne: (id: string) => api.get(`/events/${id}`),
  create: (data: {
    title: string;
    description?: string;
    location?: string;
    flyerUrl?: string;
    startAt: string;
    endAt?: string;
    clubId?: string;
  }) => api.post('/events', data),
  approve: (id: string, note?: string) => api.post(`/events/${id}/approve`, { note }),
  reject: (id: string, note?: string) => api.post(`/events/${id}/reject`, { note }),
  cancel: (id: string) => api.patch(`/events/${id}/cancel`),
  getPendingApprovals: () => api.get('/events/pending-approvals'),
};

export const calendarApi = {
  getEntries: (startDate?: string, endDate?: string, tags?: string) =>
    api.get('/calendar', { params: { startDate, endDate, tags } }),
};

export const scheduleApi = {
  getDashboard: () => api.get('/schedule'),
  saveMine: (data: UpsertStudentSchedulePayload) => api.put('/schedule/me', data),
  searchPeople: (q: string) => api.get('/schedule/search', { params: { q } }),
  addFriend: (friendId: string) => api.post('/schedule/friends', { friendId }),
  removeFriend: (friendId: string) => api.delete(`/schedule/friends/${friendId}`),
  createBlock: (data: SchoolDayBlockPayload) => api.post('/schedule/blocks', data),
  updateBlock: (blockId: string, data: SchoolDayBlockPayload) =>
    api.patch(`/schedule/blocks/${blockId}`, data),
  deleteBlock: (blockId: string) => api.delete(`/schedule/blocks/${blockId}`),
};

export const uploadsApi = {
  uploadChatAttachment: (file: {
    uri: string;
    name: string;
    mimeType?: string | null;
  }) => {
    const fd = new FormData();
    fd.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);

    return api.post<ChatAttachmentUploadResponse>('/uploads/chat-attachment', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const flexFridayApi = {
  getAll: () => api.get('/flex-friday'),
  getOne: (id: string) => api.get(`/flex-friday/${id}`),
  createFriday: (data: {
    date: string;
    type: string;
    gradeLevel?: number;
    pathway?: string;
    isSchoolDay?: boolean;
    notes?: string;
  }) => api.post('/flex-friday', data),
  getSessions: (fridayId: string) => api.get(`/flex-friday/${fridayId}/sessions`),
  createSession: (
    fridayId: string,
    data: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
      sessionType: string;
      targetPathway?: string;
      targetGrade?: number;
    },
  ) => api.post(`/flex-friday/${fridayId}/sessions`, data),
  register: (sessionId: string) =>
    api.post(`/flex-friday/sessions/${sessionId}/register`),
  unregister: (sessionId: string) =>
    api.delete(`/flex-friday/sessions/${sessionId}/register`),
  assign: (sessionId: string, studentId: string) =>
    api.post(`/flex-friday/sessions/${sessionId}/assign`, { studentId }),
  getMyRegistrations: () => api.get('/flex-friday/my/registrations'),
  getMyAssignments: () => api.get('/flex-friday/my/assignments'),
  getRoster: (sessionId: string) => api.get(`/flex-friday/sessions/${sessionId}/roster`),
};

export const notificationsApi = {
  getAll: (unreadOnly = false) =>
    api.get('/notifications', { params: { unreadOnly } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  getPreferences: () => api.get('/notifications/preferences'),
};

export const moderationApi = {
  submitReport: (data: {
    contentType: string;
    contentId: string;
    reason: string;
    reportedUserId?: string;
  }) => api.post('/moderation/reports', data),
};
