import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    api.post('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
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
  getAll: (archived = false, clubId?: string) =>
    api.get('/announcements', { params: { archived, clubId } }),
  getOne: (id: string) => api.get(`/announcements/${id}`),
  create: (data: any) => api.post('/announcements', data),
  archive: (id: string) => api.patch(`/announcements/${id}/archive`),
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
  createChannel: (clubId: string, data: any) =>
    api.post(`/clubs/${clubId}/channels`, data),
  createTag: (clubId: string, data: any) =>
    api.post(`/clubs/${clubId}/tags`, data),
  postChannelMessage: (clubId: string, channelId: string, body: string) =>
    api.post(`/clubs/${clubId}/channels/${channelId}/messages`, { body }),
  sendInvite: (clubId: string, uniqueId: string) =>
    api.post(`/clubs/${clubId}/invite`, { uniqueId }),
  bulkInviteCsv: (clubId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/clubs/${clubId}/invite/csv`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  respondToInvite: (inviteId: string, accept: boolean) =>
    api.post(`/clubs/invites/${inviteId}/respond`, { accept }),
  promoteMember: (clubId: string, memberId: string) =>
    api.post(`/clubs/${clubId}/members/${memberId}/promote`),
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
};

// Flex Friday
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
