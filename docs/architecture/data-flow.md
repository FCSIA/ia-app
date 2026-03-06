---
tags: [architecture, data-flow]
---

# Data Flow — End to End

← [[index|Home]] / [[overview]]

This page traces a single action — **a student posting a comment on an announcement** — through every layer of the application.

---

## The Full Journey

```
User types comment → presses Enter
         ↓
   React event handler
         ↓
  TanStack Query mutation
         ↓
     Axios HTTP call
         ↓
━━━━━━━━ NETWORK ━━━━━━━━
         ↓
  NestJS receives request
         ↓
   JwtAuthGuard (auth)
         ↓
   ValidationPipe (DTO)
         ↓
  Controller routes call
         ↓
  Service (business logic)
         ↓
    Prisma generates SQL
         ↓
  PostgreSQL executes SQL
         ↓
Prisma maps rows → objects
         ↓
Service → Controller → JSON
━━━━━━━━ NETWORK ━━━━━━━━
         ↓
  Axios receives response
         ↓
TanStack Query invalidates cache
         ↓
   React re-renders
         ↓
  Comment appears on screen
```

---

## Step 1 — User Interaction (React)

In `apps/web/src/app/announcements/[id]/page.tsx`:

```tsx
const [comment, setComment] = useState('');

const addCommentMutation = useMutation({
  mutationFn: (body: string) => announcementsApi.addComment(id, body),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['announcement', id] });
    setComment('');
  },
});

// When user presses Enter:
addCommentMutation.mutate(comment.trim());
```

`useState` holds the text currently typed. `useMutation` wraps the API call and handles loading/success/error states automatically. See [[state-management]].

---

## Step 2 — HTTP Request (Axios)

In `apps/web/src/lib/api.ts`:

```typescript
export const announcementsApi = {
  addComment: (id: string, body: string) =>
    api.post(`/announcements/${id}/comments`, { body }),
};
```

Axios sends:
```http
POST http://localhost:3001/announcements/abc-123/comments
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{ "body": "Great announcement!" }
```

The `Authorization` header is attached automatically by the Axios request interceptor — it reads the JWT from `localStorage` before every request. See [[api-layer]].

---

## Step 3 — NestJS Receives (main.ts → AppModule)

The running NestJS process has been listening on port 3001. It receives the request and routes it through the middleware pipeline.

---

## Step 4 — Authentication Guard

In `apps/api/src/auth/guards/jwt-auth.guard.ts`:

```typescript
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.get(IS_PUBLIC_KEY, context.getHandler());
  if (isPublic) return true;
  return super.canActivate(context); // validates JWT
}
```

The guard:
1. Checks if the route is marked `@Public()` — it's not, so proceed
2. Extracts the `Bearer` token from the `Authorization` header
3. Verifies the token's signature against `JWT_SECRET`
4. Decodes the payload to get the user's id
5. Fetches the full user from the database via `JwtStrategy`
6. Attaches the user object to the request

If the token is missing or invalid → returns `401 Unauthorized` immediately.

See [[backend-auth]].

---

## Step 5 — Validation Pipe

NestJS applies the global `ValidationPipe`. It reads the `AddCommentDto`:

```typescript
export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
```

If `body` is missing or empty → returns `400 Bad Request`. Otherwise, continues. See [[dtos]].

---

## Step 6 — Controller Routes the Call

In `apps/api/src/announcements/announcements.controller.ts`:

```typescript
@Post(':id/comments')
addComment(
  @Param('id') id: string,
  @Body() dto: AddCommentDto,
  @CurrentUser() user: User,
) {
  return this.announcementsService.addComment(id, dto.body, user);
}
```

- `@Param('id')` extracts `abc-123` from the URL
- `@Body()` extracts the validated `{ body: "Great announcement!" }` object
- `@CurrentUser()` extracts the user attached by the JWT guard
- Delegates to the service

See [[controllers]].

---

## Step 7 — Service (Business Logic)

In `apps/api/src/announcements/announcements.service.ts`:

```typescript
async addComment(announcementId: string, body: string, user: User) {
  // Check announcement exists and allows comments
  const ann = await this.prisma.announcement.findUnique({
    where: { id: announcementId },
  });
  if (!ann || !ann.allowComments) throw new ForbiddenException();

  return this.prisma.comment.create({
    data: { body, announcementId, authorId: user.id },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
}
```

See [[services]].

---

## Step 8 — Prisma → PostgreSQL

Prisma translates the `comment.create()` call into SQL and sends it to PostgreSQL:

```sql
INSERT INTO "Comment" ("id", "body", "announcementId", "authorId", "createdAt")
VALUES (gen_random_uuid(), 'Great announcement!', 'abc-123', 'user-uuid', NOW())
RETURNING "id", "body", "createdAt",
  (SELECT row_to_json(u) FROM "User" u WHERE u.id = "authorId") as author;
```

PostgreSQL writes the row and returns it. Prisma maps the result back to a TypeScript object. See [[prisma]].

---

## Step 9 — Response Travels Back

The comment object flows back through: `Service → Controller → NestJS HTTP layer → JSON response`

```json
{
  "id": "comment-uuid",
  "body": "Great announcement!",
  "createdAt": "2026-03-05T10:30:00.000Z",
  "author": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## Step 10 — TanStack Query Updates the UI

```tsx
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['announcement', id] });
}
```

`invalidateQueries` marks the announcement's cached data as stale. TanStack Query re-fetches the full announcement (including all comments). React re-renders the comment list. The new comment appears instantly. See [[state-management]].

---

## Login Flow (Special Case)

Login is slightly different because no JWT exists yet:

```
Frontend: POST /auth/login { uniqueId, password }
     ↓
AuthService: finds user by uniqueId
     ↓
bcrypt.compare(password, user.passwordHash)
     ↓
If valid: sign JWT with user.id + roles
     ↓
Return { access_token, user }
     ↓
Frontend: localStorage.setItem('ia_token', token)
     ↓
All future requests attach token automatically
```

See [[backend-auth]] and [[frontend-auth]].

---

## Related

- [[backend-overview]] — NestJS internals
- [[frontend-overview]] — React / Next.js internals
- [[backend-auth]] — How JWT works
- [[api-layer]] — The Axios setup
- [[state-management]] — TanStack Query
