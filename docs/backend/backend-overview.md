---
tags: [backend, nestjs]
---

# Backend Overview — NestJS

← [[index|Home]]

---

## What Is the Backend?

The backend is a program that runs on a server (or your laptop during development). It:
- Has no visual interface — it only speaks JSON over HTTP
- Receives requests from the web app
- Applies business logic (checks permissions, validates data)
- Reads and writes to the database
- Returns structured responses

It runs on **port 3001**. You can also browse its auto-generated API docs at `http://localhost:3001/docs`.

---

## Node.js and TypeScript

**Node.js** is the runtime — it lets JavaScript (a language originally for browsers) run on a server.

**TypeScript** adds a type system on top of JavaScript. Every variable, function parameter, and return value has a declared type. This catches entire categories of bugs before you ever run the code.

---

## NestJS

NestJS is a framework that gives Node.js apps structure. Without it you'd start from a blank file. NestJS provides:

- **Modules** — organize code by feature
- **Controllers** — map URLs to handler functions
- **Services** — contain business logic, injected where needed
- **Guards** — intercept requests to check authentication/authorization
- **Pipes** — transform and validate incoming data
- **Decorators** — `@Get()`, `@Post()`, `@Body()`, etc.

---

## Entry Point

**`apps/api/src/main.ts`** — the very first file that runs:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the web app (port 3000) to call this API
  app.enableCors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  });

  // Automatically validate all incoming request bodies
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strip unknown fields
    transform: true,       // auto-convert types (e.g. "true" → true)
    forbidNonWhitelisted: true,
  }));

  await app.listen(process.env.API_PORT || 3001);
}
bootstrap();
```

### CORS

CORS (Cross-Origin Resource Sharing) is a browser security feature. Browsers block requests from one domain to another by default. `enableCors` tells the browser: "requests from `localhost:3000` are allowed here."

Without this, every API call from the web app would be rejected by the browser.

---

## Root Module

**`apps/api/src/app.module.ts`** imports every feature module:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // loads .env
    PrismaModule,          // database connection
    AuthModule,
    UsersModule,
    AnnouncementsModule,
    ClubsModule,
    EventsModule,
    CalendarModule,
    FlexFridayModule,
    ModerationModule,
    NotificationsModule,
    AuditModule,
    UploadsModule,
  ],
})
export class AppModule {}
```

`ConfigModule` reads your `.env` file and makes all variables available anywhere via `process.env.VARIABLE_NAME`.

---

## Folder Structure

```
apps/api/src/
├── main.ts                  ← entry point
├── app.module.ts            ← root module
│
├── auth/                    ← authentication
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/login.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── strategies/
│       └── jwt.strategy.ts
│
├── users/                   ← user management
├── announcements/           ← announcements + comments
├── clubs/                   ← clubs, members, invites
├── events/                  ← events + approvals
├── calendar/                ← calendar entries
├── flex-friday/             ← flex friday scheduling
├── notifications/           ← notification delivery
├── moderation/              ← keyword filter + reports
├── audit/                   ← audit log
├── uploads/                 ← file uploads
│
├── common/
│   └── decorators/
│       ├── current-user.decorator.ts   ← @CurrentUser()
│       └── roles.decorator.ts          ← @Roles()
│
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts    ← database connection
```

Every feature folder follows the same three-file pattern — see [[modules]].

---

## Decorators

Decorators are the `@Something` syntax you see throughout NestJS. They attach metadata to classes and methods that NestJS reads at startup.

```typescript
@Controller('clubs')          // "this class handles /clubs routes"
@UseGuards(JwtAuthGuard)      // "require auth for all routes in this class"
export class ClubsController {

  @Get()                      // "this method handles GET /clubs"
  getAll() { ... }

  @Post(':id/invite')         // "this method handles POST /clubs/abc123/invite"
  sendInvite(@Param('id') id: string, @Body() dto: any) { ... }
}
```

---

## Dependency Injection

A core NestJS pattern. Instead of creating instances of services yourself (`new UsersService()`), you declare what you need in the constructor and NestJS provides it:

```typescript
@Injectable()
export class ClubsService {
  // NestJS creates and injects PrismaService automatically
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.club.findMany();
  }
}
```

This makes testing easier (you can inject mock services) and prevents creating multiple database connection instances.

---

## Related

- [[modules]] — The module system in depth
- [[controllers]] — How HTTP routes are defined
- [[services]] — Business logic layer
- [[dtos]] — Request validation
- [[backend-auth]] — JWT authentication
- [[prisma]] — Database queries
