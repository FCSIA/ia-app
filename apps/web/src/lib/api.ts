import axios from 'axios';
import type { AppUser, AuthLoginResponse } from '@ia/contracts/auth';
import type {
  ChatAttachmentUploadResponse,
  ClubBulkInviteResult,
  CreateClubChannelMessagePayload,
  CreateClubChannelPayload,
  CreateClubTagPayload,
  ToggleClubChannelReactionPayload,
} from '@ia/contracts/clubs';
import type {
  SchoolDayBlockPayload,
  UpsertStudentSchedulePayload,
} from '@ia/contracts/schedule';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function toApiUrl(path: string) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ia_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('ia_token');
      localStorage.removeItem('ia_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  login: (uniqueId: string, password: string) =>
    api.post<AuthLoginResponse>('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<AppUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Users
export const usersApi = {
  getAll: (page = 1, limit = 50, search?: string) =>
    api.get('/users', { params: { page, limit, search } }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  assignRoles: (id: string, roles: string[]) =>
    api.patch(`/users/${id}/roles`, { roles }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  activate: (id: string) => api.patch(`/users/${id}/activate`),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  importCsv: (file: File, options?: { generatePasswords?: boolean }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('generatePasswords', String(options?.generatePasswords ?? false));
    return api.post('/users/import/csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportStudentsCsv: () =>
    api.get('/users/export/csv', {
      responseType: 'blob',
    }),
};

// Announcements
export const announcementsApi = {
  getAll: (archived = false, clubId?: string, unreadOnly = false) =>
    api.get('/announcements', { params: { archived, clubId, unreadOnly } }),
  getOne: (id: string) => api.get(`/announcements/${id}`),
  create: (data: any) => api.post('/announcements', data),
  archive: (id: string) => api.patch(`/announcements/${id}/archive`),
  markRead: (id: string) => api.post(`/announcements/${id}/read`),
  markUnread: (id: string) => api.delete(`/announcements/${id}/read`),
  addComment: (id: string, body: string) =>
    api.post(`/announcements/${id}/comments`, { body }),
  deleteComment: (commentId: string) => api.delete(`/announcements/comments/${commentId}`),
};

// Clubs
export const clubsApi = {
  getAll: () => api.get('/clubs'),
  getMyClubs: () => api.get('/clubs/my'),
  getMyInvites: () => api.get('/clubs/my/invites'),
  getOne: (id: string) => api.get(`/clubs/${id}`),
  getChannels: (clubId: string) => api.get(`/clubs/${clubId}/channels`),
  getChannelMessages: (clubId: string, channelId: string) =>
    api.get(`/clubs/${clubId}/channels/${channelId}/messages`),
  create: (data: any) => api.post('/clubs', data),
  update: (id: string, data: any) => api.patch(`/clubs/${id}`, data),
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
  bulkInviteCsv: (clubId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<ClubBulkInviteResult>(`/clubs/${clubId}/invite/csv`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  respondToInvite: (inviteId: string, accept: boolean) =>
    api.post(`/clubs/invites/${inviteId}/respond`, { accept }),
  setMemberRole: (clubId: string, memberId: string, role?: string) =>
    api.patch(`/clubs/${clubId}/members/${memberId}/role`, { role }),
  removeMember: (clubId: string, memberId: string) =>
    api.post(`/clubs/${clubId}/members/${memberId}/remove`),
};

// Events
export const eventsApi = {
  getAll: (clubId?: string) => api.get('/events', { params: { clubId } }),
  getOne: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  approve: (id: string, note?: string) => api.post(`/events/${id}/approve`, { note }),
  reject: (id: string, note?: string) => api.post(`/events/${id}/reject`, { note }),
  cancel: (id: string) => api.patch(`/events/${id}/cancel`),
  getPendingApprovals: () => api.get('/events/pending-approvals'),
};

// Calendar
export const calendarApi = {
  getEntries: (startDate?: string, endDate?: string, tags?: string) =>
    api.get('/calendar', { params: { startDate, endDate, tags } }),
  createEntry: (data: {
    title: string;
    description?: string;
    location?: string;
    startAt: string;
    endAt?: string;
    tags?: string[];
  }) => api.post('/calendar', data),
};

// Schedule
export const scheduleApi = {
  getDashboard: () => api.get('/schedule'),
  saveMine: (data: UpsertStudentSchedulePayload) => api.put('/schedule/me', data),
  searchPeople: (q: string) => api.get('/schedule/search', { params: { q } }),
  sendFriendRequest: (friendId: string) => api.post('/schedule/friends', { friendId }),
  acceptFriendRequest: (requesterId: string) =>
    api.post(`/schedule/friends/${requesterId}/accept`),
  removeFriend: (otherUserId: string) => api.delete(`/schedule/friends/${otherUserId}`),
  createBlock: (data: SchoolDayBlockPayload) => api.post('/schedule/blocks', data),
  updateBlock: (blockId: string, data: SchoolDayBlockPayload) =>
    api.patch(`/schedule/blocks/${blockId}`, data),
  deleteBlock: (blockId: string) => api.delete(`/schedule/blocks/${blockId}`),
};

export const uploadsApi = {
  uploadChatAttachment: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<ChatAttachmentUploadResponse>('/uploads/chat-attachment', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Flex Friday
export const flexFridayApi = {
  getAll: () => api.get('/flex-friday'),
  getOne: (id: string) => api.get(`/flex-friday/${id}`),
  createFriday: (data: any) => api.post('/flex-friday', data),
  getSessions: (fridayId: string) => api.get(`/flex-friday/${fridayId}/sessions`),
  createSession: (fridayId: string, data: any) =>
    api.post(`/flex-friday/${fridayId}/sessions`, data),
  getWorkshops: (fridayId: string, sessionId: string) =>
    api.get(`/flex-friday/${fridayId}/sessions/${sessionId}/workshops`),
  createWorkshop: (fridayId: string, sessionId: string, data: any) =>
    api.post(`/flex-friday/${fridayId}/sessions/${sessionId}/workshops`, data),
  register: (workshopId: string) =>
    api.post(`/flex-friday/workshops/${workshopId}/register`),
  unregister: (workshopId: string) =>
    api.delete(`/flex-friday/workshops/${workshopId}/register`),
  assign: (workshopId: string, studentId: string) =>
    api.post(`/flex-friday/workshops/${workshopId}/assign`, { studentId }),
  getMyRegistrations: () => api.get('/flex-friday/my/registrations'),
  getMyAssignments: () => api.get('/flex-friday/my/assignments'),
  getRoster: (workshopId: string) => api.get(`/flex-friday/workshops/${workshopId}/roster`),
};

// Notifications
export const notificationsApi = {
  getAll: (unreadOnly = false) =>
    api.get('/notifications', { params: { unreadOnly } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  getPreferences: () => api.get('/notifications/preferences'),
  upsertPreference: (category: string, enabled: boolean, clubId?: string) =>
    api.post('/notifications/preferences', { category, enabled, clubId }),
};

// Moderation
export const moderationApi = {
  getKeywords: () => api.get('/moderation/keywords'),
  addKeyword: (keyword: string) => api.post('/moderation/keywords', { keyword }),
  removeKeyword: (id: string) => api.patch(`/moderation/keywords/${id}/remove`),
  getReports: (status?: string) => api.get('/moderation/reports', { params: { status } }),
  submitReport: (data: any) => api.post('/moderation/reports', data),
  updateReport: (id: string, data: any) => api.patch(`/moderation/reports/${id}`, data),
};

// Audit
export const auditApi = {
  getAll: (limit = 100, offset = 0) =>
    api.get('/audit', { params: { limit, offset } }),
};
