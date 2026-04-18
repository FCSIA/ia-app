---
tags: [frontend, react, tanstack-query, state]
---

# State Management — TanStack Query

← [[index|Home]] / [[frontend-overview]]

---

## The Problem with Fetching Data in React

Fetching data naively creates a lot of boilerplate:

```tsx
// Without TanStack Query — lots to manage manually
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetch('/api/clubs')
    .then(r => r.json())
    .then(data => { setData(data); setIsLoading(false); })
    .catch(err => { setError(err); setIsLoading(false); });
}, []);
```

You'd also need to handle: caching, re-fetching on window focus, background updates, invalidating stale data after mutations, and pagination.

**TanStack Query** handles all of this.

---

## useQuery — Fetching Data

```tsx
const { data: clubs = [], isLoading, isError } = useQuery({
  queryKey: ['clubs'],
  queryFn: () => clubsApi.getAll().then(r => r.data),
});
```

That's it. TanStack Query handles loading state, caching, background re-fetching, and error state automatically.

### Parameters

```typescript
useQuery({
  queryKey: ['clubs'],               // cache identifier
  queryFn: () => clubsApi.getAll(), // the async function that fetches data
  staleTime: 60_000,                // treat cached data as fresh for 60s
  refetchInterval: 30_000,          // poll every 30 seconds
  enabled: tab === 'members',       // only fetch when condition is true
})
```

### Return Values

```typescript
const {
  data,        // the fetched data (undefined while loading)
  isLoading,   // true on first load (no cache yet)
  isFetching,  // true whenever a fetch is in progress
  isError,     // true if the query failed
  error,       // the error object
  refetch,     // function to manually trigger a re-fetch
} = useQuery({ ... });
```

### Default Values

```typescript
// data is undefined while loading — use a default to avoid crashes
const { data: clubs = [] } = useQuery({ ... });
//                     ↑ empty array if data not loaded yet
```

---

## Query Keys — The Cache

The `queryKey` uniquely identifies a piece of cached data. Same key = same cache entry.

```typescript
// These all share one cache entry — same key
useQuery({ queryKey: ['clubs'] })
useQuery({ queryKey: ['clubs'] })

// Different keys = different cache entries
useQuery({ queryKey: ['clubs'] })           // all clubs
useQuery({ queryKey: ['club', 'abc-123'] }) // specific club
useQuery({ queryKey: ['club', 'xyz-456'] }) // different club
```

When you invalidate a key, TanStack Query re-fetches all matching queries.

---

## useMutation — Modifying Data

```typescript
const addCommentMutation = useMutation({
  mutationFn: (body: string) => announcementsApi.addComment(id, body),
  onSuccess: () => {
    // Invalidate the announcement cache — triggers a re-fetch
    qc.invalidateQueries({ queryKey: ['announcement', id] });
    setComment('');
    toast.success('Comment posted');
  },
  onError: (error: any) => {
    toast.error(error.response?.data?.message || 'Failed to post');
  },
});

// Call it:
addCommentMutation.mutate('Great announcement!');
```

### Mutation States

```typescript
mutation.isPending    // true while the request is in flight
mutation.isSuccess    // true after successful completion
mutation.isError      // true if it failed
mutation.data         // the response data on success
mutation.error        // the error on failure
```

---

## QueryClient — Managing the Cache

`useQueryClient()` gives access to the global query cache:

```typescript
const qc = useQueryClient();

// Force a re-fetch of specific queries
qc.invalidateQueries({ queryKey: ['clubs'] });

// Remove from cache entirely
qc.removeQueries({ queryKey: ['club', id] });

// Manually set cache data (optimistic updates)
qc.setQueryData(['club', id], newClubData);
```

The `QueryClient` is set up in `src/app/providers.tsx`:

```tsx
// providers.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,             // retry failed queries once
      staleTime: 30_000,    // data is fresh for 30 seconds
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

## Polling — The Notification Badge

The unread notification count is **polled** (checked repeatedly):

```tsx
const { data: unreadCount = 0 } = useQuery({
  queryKey: ['unread-count'],
  queryFn: () => notificationsApi.getUnreadCount().then(r => r.data.count),
  refetchInterval: 30_000,  // re-fetch every 30 seconds automatically
});
```

Every 30 seconds, a request goes to `/notifications/unread-count` and updates the badge in the sidebar. This is simpler than WebSockets but uses more requests.

---

### Invalidation
```typescript
const qc = useQueryClient();

const mutation = useMutation({
  mutationFn: (data) => api.post('/some-action', data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['some-resource'] });
  },
});
```

---

## Related

- [[api-layer]] — The Axios definitions
- [[components]] — Where TanStack Query is used
- [[frontend-overview]] — React overview

