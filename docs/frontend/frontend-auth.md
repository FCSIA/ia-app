---
tags: [frontend, auth, jwt, localstorage]
---

# Frontend Authentication

← [[index|Home]] / [[frontend-overview]]

---

## How Auth Works on the Frontend

After logging in, the backend sends back a JWT token and the user object. The frontend stores both, then attaches the token to every subsequent API request.

```
Login → receive token + user
     → store in localStorage
     → attach token to every API call
     → read user from localStorage for UI decisions
```

---

## The Auth Helpers (`src/lib/auth.ts`)

```typescript
const TOKEN_KEY = 'ia_token';
const USER_KEY = 'ia_user';

// Store token + user after successful login
export const setAuth = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Clear everything on logout
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Read the current token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Read and parse the current user
export const getUser = (): any | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

// Role checks
export const hasRole = (user: any, ...roles: string[]): boolean =>
  roles.some((r) => user?.roles?.includes(r));

export const isAdmin = (user: any): boolean =>
  hasRole(user, 'ADMIN', 'SUPER_ADMIN');

export const isSuperAdmin = (user: any): boolean =>
  hasRole(user, 'SUPER_ADMIN');
```

---

## localStorage

`localStorage` is a browser API that stores key-value pairs as strings, permanently (until cleared). Data persists across browser sessions — closing and reopening the browser keeps the user logged in.

```typescript
localStorage.setItem('ia_token', 'eyJhbGc...');   // store
localStorage.getItem('ia_token');                  // read → "eyJhbGc..."
localStorage.removeItem('ia_token');               // delete
```

Since values must be strings, objects are serialized with `JSON.stringify` and parsed back with `JSON.parse`.

---

## Login Flow

```tsx
// app/login/page.tsx
const loginMutation = useMutation({
  mutationFn: ({ uniqueId, password }: any) =>
    authApi.login(uniqueId, password).then(r => r.data),
  onSuccess: (data) => {
    setAuth(data.token, data.user); // store token + user
    router.push('/dashboard');              // redirect
  },
  onError: () => toast.error('Invalid credentials'),
});
```

---

## Logout Flow

```tsx
// In AppShell.tsx
const handleSignOut = async () => {
  try {
    await authApi.logout(); // tell backend to invalidate session
  } catch {}
  clearAuth();              // clear localStorage
  router.push('/login');    // redirect
};
```

---

## Using the Logged-in User

```tsx
import { getUser, hasRole } from '@/lib/auth';

export default function SomePage() {
  const user = getUser(); // read from localStorage

  return (
    <div>
      <p>Hello, {user?.firstName}</p>

      {/* Conditional rendering based on role */}
      {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
        <AdminPanel />
      )}
    </div>
  );
}
```

`user?.firstName` uses optional chaining — if `user` is null (not logged in), it returns `undefined` instead of throwing an error.

---

## Token Expiry

JWTs have an expiry (`7d` = 7 days in this app). When a token expires:
1. The next API call returns `401 Unauthorized`
2. The Axios response interceptor catches it
3. `localStorage` is cleared
4. User is redirected to `/login`

---

## Security Note

Storing JWTs in `localStorage` is common but has trade-offs:
- **Accessible to JavaScript** — vulnerable to XSS if malicious scripts run on the page
- **Alternative**: `httpOnly` cookies (not accessible to JS, but requires CSRF protection)

For a school app, `localStorage` is an acceptable choice.

---

## Related

- [[backend-auth]] — How the backend signs and validates tokens
- [[api-layer]] — The Axios interceptor that attaches the token
