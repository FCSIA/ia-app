---
tags: [backend, nestjs, validation, dto]
---

# DTOs — Data Transfer Objects

← [[index|Home]] / [[backend-overview]]

---

## What Is a DTO?

A **DTO** (Data Transfer Object) describes the expected shape of data coming into your API from the frontend. It serves two purposes:

1. **Type safety** — TypeScript knows exactly what fields exist
2. **Automatic validation** — NestJS rejects invalid requests before your code runs

Without DTOs, a user could send anything in the request body and crash your server.

---

## A Simple DTO

```typescript
// announcements/dto/announcement.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { AnnouncementTarget } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(AnnouncementTarget)
  targetType: AnnouncementTarget;

  @IsBoolean()
  @IsOptional()
  allowComments?: boolean;

  @IsString()
  @IsOptional()
  clubId?: string;
}
```

If the frontend sends `POST /announcements` without a `title`, or with `targetType: "INVALID"`, NestJS returns:
```json
{
  "statusCode": 400,
  "message": ["title should not be empty", "targetType must be a valid enum value"],
  "error": "Bad Request"
}
```

---

## Validation Decorators

These come from the `class-validator` library:

| Decorator | What it checks |
|-----------|---------------|
| `@IsString()` | Value is a string |
| `@IsNotEmpty()` | String is not empty / null |
| `@IsOptional()` | Field can be missing entirely |
| `@IsBoolean()` | Value is `true` or `false` |
| `@IsNumber()` | Value is a number |
| `@IsEnum(EnumType)` | Value is one of the enum's values |
| `@IsUUID()` | Value is a valid UUID |
| `@IsEmail()` | Value is a valid email |
| `@IsDateString()` | Value is a valid ISO date string |
| `@IsArray()` | Value is an array |
| `@MinLength(n)` | String has at least n characters |
| `@Max(n)` | Number is at most n |

---

## How It Works

The global `ValidationPipe` (set up in `main.ts`) intercepts every request:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,             // removes any fields not in the DTO
  transform: true,             // converts "true" → true, "1" → 1
  forbidNonWhitelisted: true,  // rejects requests with unknown fields
}));
```

`whitelist: true` is a security feature — even if someone sends extra fields like `{ "isAdmin": true }`, they're stripped before reaching your service.

---

## Common DTOs in This App

### Login
```typescript
export class LoginDto {
  @IsString() @IsNotEmpty()
  uniqueId: string;

  @IsString() @IsNotEmpty()
  password: string;
}
```

### Create Club
```typescript
export class CreateClubDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsOptional()
  description?: string;
}
```

### Add Comment
```typescript
export class AddCommentDto {
  @IsString() @IsNotEmpty()
  body: string;
}
```

### Invite Member
```typescript
export class InviteDto {
  @IsString() @IsNotEmpty()
  recipientId: string;  // the uniqueId of the user to invite
}
```

### Create Event
```typescript
export class CreateEventDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsString()
  description: string;

  @IsEnum(EventType)
  type: EventType;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsString() @IsOptional()
  location?: string;

  @IsString() @IsOptional()
  clubId?: string;
}
```

---

## Transform

The `transform: true` option in `ValidationPipe` auto-converts types. For example, query string parameters are always strings:

```
GET /users?page=2&active=true
```

Both `page` and `active` arrive as strings. With `transform: true` and proper DTO types, they're automatically converted:

```typescript
export class GetUsersDto {
  @IsNumber()
  @Type(() => Number)
  page: number;  // "2" → 2

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  active: boolean;  // "true" → true
}
```

---

## Related

- [[controllers]] — Where DTOs are used (`@Body() dto: CreateClubDto`)
- [[backend-overview]] — The ValidationPipe setup in main.ts
- [[services]] — Where the validated data is processed
