---
tags: [backend, auth, jwt, security]
---

# Authentication & Authorization

← [[index|Home]] / [[backend-overview]]

---

## Two Different Concepts

**Authentication** — "Who are you?" → verifying identity (login with password)

**Authorization** — "Are you allowed to do this?" → checking roles/permissions

This app uses **JWT** for authentication and **role-based guards** for authorization.

---

## JWT — JSON Web Token

A JWT is a self-contained signed token. Think of it like a wristband at a concert — it proves you paid without needing to check the ticket desk every time.

### Structure

A JWT has three base64-encoded parts separated by dots:
```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWlkIiwicm9sZXMiOlsiU1RVREVOVCI...
─────────────────────.──────────────────────────────────────────────────────
      HEADER                            PAYLOAD
```

- **Header** — algorithm used (`HS256`)
- **Payload** — the data (user id, roles, expiry)
- **Signature** — proves the token wasn't tampered with (signed with `JWT_SECRET`)

Anyone can decode the payload (it's just base64). But they **cannot forge** a token without knowing `JWT_SECRET`.

---

## Login Flow

```typescript
// auth/auth.service.ts
async login(uniqueId: string, password: string) {
  // 1. Find user
  const user = await this.prisma.user.findUnique({ where: { uniqueId } });
  if (!user) throw new UnauthorizedException('Invalid credentials');

  // 2. Compare password against stored hash
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedException('Invalid credentials');

  // 3. Sign a JWT with the user's id and roles
  const payload = { sub: user.id, roles: user.roles };
  const token = this.jwtService.sign(payload, { expiresIn: '7d' });

  return { access_token: token, user };
}
```

### bcrypt

Passwords are **never stored in plain text**. bcrypt is a one-way hashing function:

```typescript
// When user is created / password is changed:
const hash = await bcrypt.hash(plainTextPassword, 12);
// Stored: "$2b$12$abcdef..." (never the original)

// When logging in:
const valid = await bcrypt.compare(enteredPassword, storedHash);
// Returns true or false — original password is never recoverable
```

The `12` is the "cost factor" — higher means slower to compute, which makes brute-force attacks harder.

---

## JWT Strategy

```typescript
// auth/strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; roles: Role[] }) {
    // Called after token signature is verified
    // payload.sub = the user's id (stored when token was signed)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user; // attached to request.user
  }
}
```

`validate()` is called automatically after the token signature passes. It fetches the full user from the database (so you always have fresh data) and attaches it to `request.user`.

---

## JwtAuthGuard

```typescript
// auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Otherwise require valid JWT
    return super.canActivate(context);
  }
}
```

This guard is registered **globally** — it runs on every single request. The `@Public()` decorator is the escape hatch for routes that don't need auth (like `/auth/login`).

```typescript
// Marking a route as public:
@Public()
@Post('login')
login(@Body() dto: LoginDto) { ... }
```

---

## RolesGuard

```typescript
// auth/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true; // no roles required — allow

    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

Used with the `@Roles()` decorator:
```typescript
@Delete(':id')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
deleteUser(@Param('id') id: string) { ... }
```

---

## The Full Auth Pipeline Per Request

```
Incoming request
       ↓
JwtAuthGuard.canActivate()
  → Is route @Public? Yes → pass through
  → No → extract Bearer token from Authorization header
       → verify signature with JWT_SECRET
       → call JwtStrategy.validate(payload)
         → fetch user from DB
         → check user.isActive
         → attach user to request.user
       ↓
RolesGuard.canActivate()
  → Does route have @Roles()? No → pass through
  → Yes → check request.user.roles includes required role
       ↓
Controller method runs with @CurrentUser() user
```

---

## Token Storage

| Platform | Storage | Why |
|----------|---------|-----|
| Web (Next.js) | `localStorage` | Simple, persistent across browser sessions |
| Mobile (Expo) | `expo-secure-store` | Encrypted, backed by device secure enclave |

The web app stores the token under the key `ia_token`. Every Axios request reads it and adds it to the `Authorization` header automatically. See [[frontend-auth]].

---

## Sessions

The database has an `AuthSession` model that tracks active sessions. This allows features like "log out everywhere" — when implemented, you can invalidate all tokens for a user by deleting their sessions.

---

## Related

- [[roles-and-permissions]] — All roles and what they can do
- [[frontend-auth]] — How the web app stores and uses tokens
- [[dtos]] — The LoginDto
- [[data-flow]] — Full login flow traced end-to-end
