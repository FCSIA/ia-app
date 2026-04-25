import 'client-only';
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
import type { CourseDetail, CourseSummary } from '@ia/contracts/courses';
import type {
  SchoolDayBlockPayload,
  UpsertStudentSchedulePayload,
} from '@ia/contracts/schedule';

export type UpdateClubChannelPayload = Partial<CreateClubChannelPayload>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  getAll: (page = 1, limit = 50, search?: string, roleGroup?: string) =>
    api.get('/users', { params: { page, limit, search, roleGroup } }),
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
  getDashboardLayout: () =>
    api.get<string[]>('/users/me/dashboard-layout').then((res) => res.data),
  updateDashboardLayout: (layout: string[]) =>
    api.patch('/users/me/dashboard-layout', { layout }),
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
  join: (id: string) => api.post(`/clubs/${id}/join`),
  requestToJoin: (id: string) => api.post(`/clubs/${id}/request-join`),
  redeemJoinCode: (id: string, code: string) =>
    api.post(`/clubs/${id}/join-code/redeem`, { code }),
  generateJoinCode: (id: string) => api.post(`/clubs/${id}/join-code`),
  respondToJoinRequest: (id: string, requestId: string, accept: boolean) =>
    api.post(`/clubs/${id}/join-requests/${requestId}/respond`, { accept }),
  getChannels: (clubId: string) => api.get(`/clubs/${clubId}/channels`),
  getChannelMessages: (clubId: string, channelId: string) =>
    api.get(`/clubs/${clubId}/channels/${channelId}/messages`),
  create: (data: any) => api.post('/clubs', data),
  update: (id: string, data: any) => api.patch(`/clubs/${id}`, data),
  createChannel: (clubId: string, data: CreateClubChannelPayload) =>
    api.post(`/clubs/${clubId}/channels`, data),
  deleteChannel: (clubId: string, channelId: string) =>
    api.delete(`/clubs/${clubId}/channels/${channelId}`),
  updateChannel: (clubId: string, channelId: string, data: UpdateClubChannelPayload) =>
    api.patch(`/clubs/${clubId}/channels/${channelId}`, data),
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
export type CalendarSource = 'DISTRICT' | 'SCHOOL' | 'CLUB' | 'PERSONAL';

export const calendarApi = {
  getEntries: (startDate?: string, endDate?: string, tags?: string, sources?: CalendarSource[]) =>
    api.get('/calendar', {
      params: {
        startDate,
        endDate,
        tags,
        sources: sources && sources.length > 0 ? sources.join(',') : undefined,
      },
    }),
  createEntry: (data: {
    title: string;
    description?: string;
    location?: string;
    startAt: string;
    endAt?: string;
    tags?: string[];
  }) => api.post('/calendar', data),
  deleteEntry: (id: string) => api.delete(`/calendar/${id}`),
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

export const coursesApi = {
  list: (params?: {
    q?: string;
    department?: string;
    pathway?: string;
    gradeLevel?: number;
    limit?: number;
  }) => api.get<CourseSummary[]>('/courses', { params }),
  getOne: (slug: string) => api.get<CourseDetail>(`/courses/${slug}`),
};

export const uploadsApi = {
  uploadChatAttachment: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<ChatAttachmentUploadResponse>('/uploads/chat-attachment', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadClubImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ url: string; filename: string; originalName: string; mimeType: string; size: number }>(
      '/uploads/club-image',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
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
  updateSession: (sessionId: string, data: any) =>
    api.patch(`/flex-friday/sessions/${sessionId}`, data),
  deleteSession: (sessionId: string) =>
    api.delete(`/flex-friday/sessions/${sessionId}`),
  getWorkshops: (fridayId: string, sessionId: string) =>
    api.get(`/flex-friday/${fridayId}/sessions/${sessionId}/workshops`),
  createWorkshop: (fridayId: string, data: any) =>
    api.post(`/flex-friday/${fridayId}/workshops`, data),
  updateWorkshop: (workshopId: string, data: any) =>
    api.patch(`/flex-friday/workshops/${workshopId}`, data),
  deleteWorkshop: (workshopId: string) =>
    api.delete(`/flex-friday/workshops/${workshopId}`),
  register: (workshopId: string) =>
    api.post(`/flex-friday/workshops/${workshopId}/register`),
  unregister: (workshopId: string) =>
    api.delete(`/flex-friday/workshops/${workshopId}/register`),
  assign: (workshopId: string, studentId: string) =>
    api.post(`/flex-friday/workshops/${workshopId}/assign`, { studentId }),
  getMyRegistrations: () => api.get('/flex-friday/my/registrations'),
  getMyAssignments: () => api.get('/flex-friday/my/assignments'),
  getMyCredits: () => api.get('/flex-friday/my/credits'),
  getStudentCredits: (studentId: string, schoolYear?: number) =>
    api.get(`/flex-friday/students/${studentId}/credits`, {
      params: schoolYear != null ? { schoolYear } : undefined,
    }),
  getRoster: (workshopId: string) => api.get(`/flex-friday/workshops/${workshopId}/roster`),
  markAttendance: (
    workshopId: string,
    studentId: string,
    status: 'PRESENT' | 'ABSENT' | 'EXCUSED' = 'PRESENT',
  ) =>
    api.post(`/flex-friday/workshops/${workshopId}/attendance`, { studentId, status }),
  clearAttendance: (workshopId: string, studentId: string) =>
    api.delete(`/flex-friday/workshops/${workshopId}/attendance/${studentId}`),
  bulkMarkAttendance: (
    workshopId: string,
    entries: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'EXCUSED' }>,
  ) => api.post(`/flex-friday/workshops/${workshopId}/attendance/bulk`, { entries }),
};

// Wrapped (year-in-review)
export type WrappedPathway = 'HEALTH_SCIENCE' | 'INFORMATION_TECHNOLOGY' | 'ENGINEERING';

export interface WrappedSummary {
  userId: string;
  schoolYearStart: number;
  schoolYearLabel: string;
  rangeStart: string;
  rangeEnd: string;

  messagesSent: number;
  channelsEngaged: number;
  friends: number;
  clubs: number;

  flexCredits: number;
  flexCreditsRequired: number;
  pathwayFlexCredits: number;

  topChannel: {
    channelId: string;
    channelName: string;
    clubId: string;
    clubName: string;
    messages: number;
  } | null;
  topMentioned: {
    userId: string;
    firstName: string;
    lastName: string;
    mentions: number;
  } | null;

  pathway: {
    major: WrappedPathway | null;
    minor: WrappedPathway | null;
    lanyardColor: string | null;
    label: string | null;
    peers: number;
  };
  mostUsedWord: { word: string; count: number } | null;
  peakHour: { hour: number; messages: number } | null;
  longestStreak: number;
  mostActiveDay: { date: string; messages: number } | null;
  reactionsReceived: number;
  topEmoji: { emoji: string; count: number } | null;
  longestMessageChars: number;
}

export interface WrappedAvailability {
  open: boolean;
  schoolYear: number;
  schoolYearLabel: string;
  opensAt: string;
  closesAt: string;
  secondsUntilOpen: number;
}

export const wrappedApi = {
  getAvailability: () => api.get<WrappedAvailability>('/wrapped/availability'),
  getMine: (schoolYear?: number) =>
    api.get<WrappedSummary>('/wrapped/me', {
      params: schoolYear != null ? { schoolYear } : undefined,
    }),
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
  getAll: (params?: {
    limit?: number;
    offset?: number;
    query?: string;
    actor?: string;
    entityId?: string;
    action?: string;
    entityType?: string;
    actorScope?: 'USER' | 'SYSTEM';
    startDate?: string;
    endDate?: string;
  }) => api.get('/audit', { params }),
  getOne: (id: string) => api.get(`/audit/entries/${id}`),
};
