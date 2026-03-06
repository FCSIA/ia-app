---
tags: [frontend, api, axios]
---

# API Layer — Axios

← [[index|Home]] / [[frontend-overview]]

---

## What Is the API Layer?

`src/lib/api.ts` is the single file that contains every HTTP call the web app makes to the backend. It uses **Axios** — a library for making HTTP requests.

Having all API calls in one place means:
- Easy to find any endpoint
- Consistent error handling
- One place to change the base URL

---

## The Axios Instance

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});
```

`axios.create()` makes a configured instance. All calls made through `api` inherit these settings — you never need to repeat the base URL.

---

## Request Interceptor — Attaching the JWT

Every request automatically gets the JWT attached:

```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

An **interceptor** runs before/after every request. This one reads the token from `localStorage` and adds it to the `Authorization` header. You never need to manually attach the token anywhere.

---

## Response Interceptor — Handling 401

```typescript
api.interceptors.response.use(
  (response) => response,  // success: pass through
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — log the user out
      localStorage.removeItem('ia_token');
      localStorage.removeItem('ia_user');
      window.location.href = '/login';
    }
    return Promise.reject(error); // pass error to the caller
  }
);
```

If any request returns `401 Unauthorized` (token expired, invalid, or missing), the user is immediately logged out and redirected to the login page.

---

## API Groups

All endpoints are grouped by feature into exported objects:

### authApi
```typescript
export const authApi = {
  login: (uniqueId: string, password: string) =>
    api.post('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};
```

### usersApi
```typescript
export const usersApi = {
  getAll: (page = 1, limit = 20, search?: string) =>
    api.get('/users', { params: { page, limit, search } }),
  getOne: (id: string) => api.get(`/users/${id}`),
  assignRoles: (id: string, roles: string[]) =>
    api.patch(`/users/${id}/roles`, { roles }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  activate: (id: string) => api.patch(`/users/${id}/activate`),
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

### announcementsApi
```typescript
export const announcementsApi = {
  getAll: (adminOnly = false, clubId?: string) =>
    api.get('/announcements', { params: { adminOnly, clubId } }),
  getOne: (id: string) => api.get(`/announcements/${id}`),
  create: (data: any) => api.post('/announcements', data),
  archive: (id: string) => api.patch(`/announcements/${id}/archive`),
  addComment: (id: string, body: string) =>
    api.post(`/announcements/${id}/comments`, { body }),
  deleteComment: (commentId: string) =>
    api.delete(`/announcements/comments/${commentId}`),
};
```

### clubsApi
```typescript
export const clubsApi = {
  getAll: () => api.get('/clubs'),
  getMyClubs: () => api.get('/clubs/mine'),
  getMyInvites: () => api.get('/clubs/invites'),
  getOne: (id: string) => api.get(`/clubs/${id}`),
  create: (data: any) => api.post('/clubs', data),
  sendInvite: (clubId: string, recipientId: string) =>
    api.post(`/clubs/${clubId}/invite`, { recipientId }),
  respondToInvite: (inviteId: string, accept: boolean) =>
    api.patch(`/clubs/invites/${inviteId}`, { accept }),
  promoteMember: (clubId: string, userId: string) =>
    api.patch(`/clubs/${clubId}/members/${userId}/promote`),
  removeMember: (clubId: string, userId: string) =>
    api.delete(`/clubs/${clubId}/members/${userId}`),
};
```

### notificationsApi
```typescript
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  getPreferences: () => api.get('/notifications/preferences'),
  upsertPreference: (category: string, enabled: boolean) =>
    api.put('/notifications/preferences', { category, enabled }),
};
```

---

## HTTP Methods in REST

| Method | Used for | Example |
|--------|----------|---------|
| `GET` | Fetching data (no body) | `api.get('/clubs')` |
| `POST` | Creating new data | `api.post('/clubs', { name: 'Chess' })` |
| `PATCH` | Partial update | `api.patch('/users/123/deactivate')` |
| `PUT` | Full replace | `api.put('/notifications/preferences', {...})` |
| `DELETE` | Removing data | `api.delete('/clubs/123/members/456')` |

---

## Using the API in Components

```tsx
import { clubsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// Inside a component:
const { data: clubs } = useQuery({
  queryKey: ['clubs'],
  queryFn: () => clubsApi.getAll().then(r => r.data), // .data unwraps Axios response
});
```

`r.data` extracts the actual response body from Axios's response wrapper (which includes status, headers, etc.).

---

## Related

- [[state-management]] — TanStack Query wraps these API calls
- [[frontend-auth]] — The token that the interceptor attaches
- [[data-flow]] — Full request lifecycle
