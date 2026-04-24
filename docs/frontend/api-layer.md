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
  login: (uniqueId, password) => api.post('/auth/login', { uniqueId, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (cur, next) => api.post('/auth/change-password', { cur, next }),
};
```

### announcementsApi
Supports read tracking and unread filtering:
- `getAll(archived, clubId, unreadOnly)`
- `markRead(id)` / `markUnread(id)`
- `addComment(id, body)` / `deleteComment(id)`

### clubsApi
Now handles join requests and codes:
- `join(id)`
- `requestToJoin(id)`
- `redeemJoinCode(id, code)`
- `generateJoinCode(id)`
- `respondToJoinRequest(id, reqId, accept)`
- `createChannel(clubId, data)` // Supports PRIVATE and MEMBER_READONLY
- `setMemberRole(clubId, mid, role)`

### eventsApi
- `getAll(clubId)`
- `approve(id, note)` / `reject(id, note)`
- `getPendingApprovals()`

### scheduleApi
- `getDashboard()`
- `saveMine(data)`
- `sendFriendRequest(friendId)`
- `acceptFriendRequest(requesterId)`
- `removeFriend(userId)`

### coursesApi
- `list(params)` // fuzzy search, department, pathway filters
- `getOne(slug)`

### flexFridayApi
- `createFriday(data)`
- `createSession(fid, data)`
- `createWorkshop(fid, sid, data)`
- `register(wid)` / `unregister(wid)`
- `assign(wid, studentId)`
- `getRoster(wid)`

### notificationsApi
- `getAll(unreadOnly)`
- `getUnreadCount()` // Polled every 30s
- `upsertPreference(category, enabled, clubId)`

### moderationApi
- `getKeywords()` / `addKeyword(kw)`
- `getReports(status)` / `submitReport(data)`
- `updateReport(id, data)`

---

## HTTP Methods in REST

| Method | Used for | Example |
|--------|----------|---------|
| `GET` | Fetching data | `api.get('/clubs')` |
| `POST` | Creating new data | `api.post('/clubs', data)` |
| `PATCH` | Partial update | `api.patch('/clubs/1/role', data)` |
| `PUT` | Full replace | `api.put('/schedule/me', data)` |
| `DELETE` | Removing data | `api.delete('/notifications/1/read')` |

---

## Using the API in Components

The app uses **TanStack Query** to wrap these API calls, providing caching, loading states, and automatic refetching.

```tsx
import { clubsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const { data: clubs } = useQuery({
  queryKey: ['clubs'],
  queryFn: () => clubsApi.getAll().then(r => r.data),
});
```

`r.data` extracts the actual response body from Axios's response wrapper.

---

## Related

- [[state-management]] — TanStack Query patterns
- [[frontend-auth]] — The token interceptor
- [[data-flow]] — Full request lifecycle

