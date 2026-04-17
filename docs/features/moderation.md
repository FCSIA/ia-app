---
tags: [feature, moderation, safety]
---

# Moderation

← [[index|Home]]

---

## Overview

The moderation system has two parts: automated keyword filtering that scans content as it's created, and a user report system for flagging problematic content for admin review.

**Files:**
- Backend: `apps/api/src/moderation/`
- Web: `apps/web/src/app/admin/` (Moderation tab)
- Database: [[schema#KeywordRule]], [[schema#Report]]

---

## Keyword Filter

### How It Works

1. Admin adds keywords to `KeywordRule` via the Admin Panel
2. When an announcement or event is created, the backend scans the content
3. If a keyword is found, a `KeywordMatch` record is created
4. Content may be flagged for admin review

```typescript
// In announcements.service.ts, after creating:
await this.moderationService.checkContent(announcement.body, announcement.id, 'ANNOUNCEMENT');
```

```typescript
// In moderation.service.ts:
async checkContent(text: string, contentId: string, contentType: ContentType) {
  const keywords = await this.prisma.keywordRule.findMany({ where: { isActive: true } });
  for (const rule of keywords) {
    if (text.toLowerCase().includes(rule.keyword.toLowerCase())) {
      await this.prisma.keywordMatch.create({ data: { contentId, contentType, keywordId: rule.id } });
    }
  }
}
```

---

## User Reports

Any user can report an announcement, comment, or event using the flag button:

```
User clicks report → fills in reason → submits
         ↓
Report created (status: PENDING)
         ↓
Admin sees it in Admin Panel → Moderation tab
         ↓
Admin reviews and: Resolves or Dismisses
```

### Report Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Not yet reviewed |
| `REVIEWED` | Seen but no action yet |
| `RESOLVED` | Action taken (content removed, user warned, etc.) |
| `DISMISSED` | No action needed |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/moderation/keywords` | All keyword rules |
| POST | `/moderation/keywords` | Add a keyword |
| DELETE | `/moderation/keywords/:id` | Remove a keyword |
| GET | `/moderation/reports` | All reports |
| POST | `/moderation/reports` | Submit a report |
| PATCH | `/moderation/reports/:id` | Update report status |

---

## Permissions

| Action | Who can |
|--------|---------|
| Submit reports | All authenticated |
| View reports | ADMIN, SUPER_ADMIN, SUPPORT_STAFF |
| Manage keywords | ADMIN, SUPER_ADMIN |
| Resolve/Dismiss | ADMIN, SUPER_ADMIN, SUPPORT_STAFF |

---

## Related

- [[announcements]] — Content that gets scanned and can be reported
- [[audit-log]] — Moderation actions are logged
- [[roles-and-permissions]] — Who can manage moderation
