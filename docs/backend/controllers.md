---
tags: [backend, nestjs, controllers]
---

# Controllers

← [[index|Home]] / [[backend-overview]]

---

## What Is a Controller?

A controller maps **HTTP requests** (a URL + method) to a handler function. Think of it as a receptionist: it receives the request, extracts the data from it, passes it to the right service, and returns the result.

Controllers know **nothing** about databases. They only handle HTTP concerns.

---

## Basic Structure

```typescript
@Controller('clubs')           // base path: /clubs
@UseGuards(JwtAuthGuard)       // all routes require a valid JWT
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.clubsService.getAll(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.clubsService.getOne(id, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreateClubDto, @CurrentUser() user: User) {
    return this.clubsService.create(dto, user);
  }

  @Post(':id/invite')
  sendInvite(
    @Param('id') clubId: string,
    @Body() dto: InviteDto,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.sendInvite(clubId, dto.uniqueId, user.id, user.role);
  }

  @Post(':id/invite/csv')
  @UseInterceptors(FileInterceptor('file'))
  bulkInviteFromCsv(
    @Param('id') clubId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.bulkInviteFromCsv(clubId, file.buffer, user.id, user.role);
  }

  @Get(':id/channels')
  getChannels(@Param('id') clubId: string, @CurrentUser() user: User) {
    return this.clubsService.getChannels(clubId, user.id, user.role);
  }

  @Post(':id/channels')
  createChannel(
    @Param('id') clubId: string,
    @Body() dto: CreateClubChannelDto,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.createChannel(clubId, dto, user.id, user.role);
  }

  @Post(':id/tags')
  createTag(
    @Param('id') clubId: string,
    @Body() dto: CreateClubTagDto,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.createTag(clubId, dto, user.id, user.role);
  }

  @Get(':id/channels/:channelId/messages')
  getChannelMessages(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.getChannelMessages(clubId, channelId, user.id, user.role);
  }

  @Post(':id/channels/:channelId/messages')
  postChannelMessage(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @Body() dto: CreateClubChannelMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.postChannelMessage(clubId, channelId, dto.body, user.id, user.role);
  }

  @Post(':id/members/:memberId/remove')
  removeMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.clubsService.removeMember(clubId, memberId, user.id, user.role);
  }
}
```

---

## HTTP Method Decorators

These map to the standard HTTP verbs:

| Decorator | HTTP Method | Typical Use |
|-----------|-------------|-------------|
| `@Get()` | GET | Fetch data |
| `@Post()` | POST | Create new data |
| `@Patch()` | PATCH | Update part of a record |
| `@Put()` | PUT | Replace an entire record |
| `@Delete()` | DELETE | Remove a record |

---

## Parameter Decorators

These extract data from different parts of the request:

| Decorator | Extracts | Example |
|-----------|----------|---------|
| `@Param('id')` | URL segment | `/clubs/abc123` → `"abc123"` |
| `@Body()` | Request body | `{ "name": "Chess Club" }` |
| `@Query('page')` | Query string | `/clubs?page=2` → `"2"` |
| `@CurrentUser()` | JWT user | The logged-in user object |

### @CurrentUser() — Custom Decorator

```typescript
// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // set by JwtAuthGuard
  },
);
```

---

## Route Parameters

`:id` in a route path is a **URL parameter** — a variable segment:

```typescript
@Get(':id')                         // matches /clubs/any-string-here
getOne(@Param('id') id: string) {}  // id = "any-string-here"

@Post(':id/members/:memberId/remove')    // two parameters
removeMember(
  @Param('id') clubId: string,
  @Param('memberId') memberId: string,
) {}
```

---

## Guards on Controllers

Guards intercept the request before it reaches the handler. They can allow or reject:

```typescript
// Applied to every route in the controller
@UseGuards(JwtAuthGuard)
export class ClubsController {}

// Applied to a single route only
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
create() {}
```

In this app, `JwtAuthGuard` is applied globally in `main.ts`, so you don't need to add it to every controller. The `@Public()` decorator opts specific routes out.

---

## Response Codes

NestJS returns `200 OK` for GET/PATCH/DELETE success and `201 Created` for POST success by default. You can override:

```typescript
@Post()
@HttpCode(200)   // return 200 instead of 201
login() {}
```

Errors are thrown as exceptions:
```typescript
throw new NotFoundException('Club not found');      // 404
throw new ForbiddenException('Not a member');       // 403
throw new BadRequestException('Invalid input');     // 400
throw new UnauthorizedException('Login required');  // 401
```

---

## All Controllers in This App

| Controller | Base Path | Key Routes |
|-----------|-----------|------------|
| `AuthController` | `/auth` | `POST /login`, `POST /logout`, `GET /me`, `POST /change-password` |
| `UsersController` | `/users` | `GET /`, `PATCH /:id`, `POST /import/csv`, `GET /export/csv` |
| `AnnouncementsController` | `/announcements` | `GET /`, `POST /`, `POST /:id/comments`, `DELETE /:id/comments/:cid` |
| `ClubsController` | `/clubs` | `GET /`, `GET /my`, `POST /`, `POST /:id/invite`, `POST /:id/invite/csv`, `GET /:id/channels`, `POST /:id/channels`, `POST /:id/tags`, `POST /:id/channels/:channelId/messages` |
| `EventsController` | `/events` | `GET /`, `POST /`, `POST /:id/approve`, `POST /:id/reject` |
| `CalendarController` | `/calendar` | `GET /entries` |
| `FlexFridayController` | `/flex-friday` | `GET /`, `GET /:id/sessions`, `POST /:id/sessions`, `POST /:fid/sessions/:sid/register` |
| `NotificationsController` | `/notifications` | `GET /`, `GET /unread-count`, `POST /mark-read`, `POST /mark-all-read` |
| `ModerationController` | `/moderation` | `GET /keywords`, `POST /keywords`, `GET /reports`, `PATCH /reports/:id` |
| `AuditController` | `/audit` | `GET /` |

---

## Related

- [[services]] — The business logic controllers delegate to
- [[dtos]] — How request bodies are validated
- [[backend-auth]] — Guards and authentication
- [[modules]] — How controllers are registered
