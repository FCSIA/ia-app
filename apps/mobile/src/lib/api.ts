import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const TOKEN_KEY = 'ia_token';
export const USER_KEY = 'ia_user';

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
    api.post('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const announcementsApi = {
  getAll: (archived = false, clubId?: string) =>
    api.get('/announcements', { params: { archived, clubId } }),
  getOne: (id: string) => api.get(`/announcements/${id}`),
  create: (data: any) => api.post('/announcements', data),
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
  createChannel: (clubId: string, data: any) =>
    api.post(`/clubs/${clubId}/channels`, data),
  createTag: (clubId: string, data: any) =>
    api.post(`/clubs/${clubId}/tags`, data),
  postChannelMessage: (clubId: string, channelId: string, body: string) =>
    api.post(`/clubs/${clubId}/channels/${channelId}/messages`, { body }),
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
  create: (data: any) => api.post('/events', data),
  approve: (id: string, note?: string) => api.post(`/events/${id}/approve`, { note }),
  reject: (id: string, note?: string) => api.post(`/events/${id}/reject`, { note }),
  cancel: (id: string) => api.patch(`/events/${id}/cancel`),
  getPendingApprovals: () => api.get('/events/pending-approvals'),
};

export const calendarApi = {
  getEntries: (startDate?: string, endDate?: string, tags?: string) =>
    api.get('/calendar', { params: { startDate, endDate, tags } }),
};

export const flexFridayApi = {
  getAll: () => api.get('/flex-friday'),
  getOne: (id: string) => api.get(`/flex-friday/${id}`),
  createFriday: (data: any) => api.post('/flex-friday', data),
  getSessions: (fridayId: string) => api.get(`/flex-friday/${fridayId}/sessions`),
  createSession: (fridayId: string, data: any) =>
    api.post(`/flex-friday/${fridayId}/sessions`, data),
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
