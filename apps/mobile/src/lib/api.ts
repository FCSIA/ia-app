import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Update this to your machine's LAN IP when testing on a physical device
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('ia_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const TOKEN_KEY = 'ia_token';
export const USER_KEY = 'ia_user';

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
};

export const clubsApi = {
  getMyClubs: () => api.get('/clubs/my'),
  getMyInvites: () => api.get('/clubs/my/invites'),
  getOne: (id: string) => api.get(`/clubs/${id}`),
  respondToInvite: (inviteId: string, accept: boolean) =>
    api.post(`/clubs/invites/${inviteId}/respond`, { accept }),
};

export const eventsApi = {
  getAll: () => api.get('/events'),
  getOne: (id: string) => api.get(`/events/${id}`),
};

export const calendarApi = {
  getEntries: (startDate?: string, endDate?: string) =>
    api.get('/calendar', { params: { startDate, endDate } }),
};

export const flexFridayApi = {
  getAll: () => api.get('/flex-friday'),
  getSessions: (fridayId: string) => api.get(`/flex-friday/${fridayId}/sessions`),
  register: (sessionId: string) =>
    api.post(`/flex-friday/sessions/${sessionId}/register`),
  unregister: (sessionId: string) =>
    api.delete(`/flex-friday/sessions/${sessionId}/register`),
  getMyRegistrations: () => api.get('/flex-friday/my/registrations'),
};

export const notificationsApi = {
  getAll: (unreadOnly = false) =>
    api.get('/notifications', { params: { unreadOnly } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
};
