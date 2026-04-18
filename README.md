# 🎓 IA School App

A full-stack school communication and management platform built for **FCS Innovation Academy**. It connects students, teachers, and administrators through a unified web experience.

---

## ✨ Features

- 🔐 **Authentication** — Secure login with JWT sessions and role-based access control
- 📢 **Announcements** — School-wide, grade-level, pathway, and club-specific announcements with keyword moderation
- 🏫 **Clubs** — Create clubs, manage members, send invites via CSV, promote leaders
- 📅 **Events** — Submit, approve/reject, and publish school events with a multi-step approval flow
- 🗓️ **Calendar** — Unified calendar view of all approved events and manual entries
- 🕐 **Flex Friday** — Schedule and register for Flex Friday sessions; teachers can assign students
- 🛡️ **Moderation** — Keyword flagging system and content reporting
- 🔔 **Notifications** — In-app notification delivery with preferences per category
- 👥 **User Management** — Bulk import students via CSV, role assignment, account activation/deactivation
- 📊 **Audit Log** — Full audit trail of admin actions

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | [NestJS](https://nestjs.com/) + TypeScript |
| **Database** | SQLite (dev) via [Prisma ORM](https://www.prisma.io/) |
| **Web Frontend** | [Next.js 15](https://nextjs.org/) + Tailwind CSS + shadcn/ui |
| **Auth** | JWT + bcrypt |
| **Monorepo** | [Turborepo](https://turbo.build/) + pnpm workspaces |
| **API Docs** | Swagger / OpenAPI |

---

## 📁 Project Structure

```
ia-app/
├── apps/
│   ├── api/          # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── clubs/
│   │   │   ├── events/
│   │   │   ├── calendar/
│   │   │   ├── flex-friday/
│   │   │   ├── announcements/
│   │   │   ├── moderation/
│   │   │   ├── notifications/
│   │   │   └── audit/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/          # Next.js web app (port 3000)
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+

### 1. Clone the repo

```bash
git clone https://github.com/virajdas/ia-app.git
cd ia-app
```

### 2. Set up environment variables

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Set up the database

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed with test data
```

### 5. Start the app

```bash
# macOS/Linux
pnpm dev

# Windows
pnpm infra:up:win  # Start PostgreSQL
pnpm dev           # Start the app
```

| Service | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| ⚙️ API | http://localhost:3001 |
| 📖 API Docs (Swagger) | http://localhost:3001/docs |

If you pull schema changes later, run `pnpm db:migrate` before `pnpm dev`.

If Prisma starts failing with missing-column errors such as `users.middle_name`, your local database is stale relative to the current migration history. Reset and reseed it with:

```bash
pnpm db:reset
```

## Local Services

## 🔑 Test Accounts

```bash
pnpm infra:up
pnpm infra:down
```

`pnpm infra:up` and `pnpm infra:down` manage PostgreSQL through Homebrew.

## Useful Commands

```bash
pnpm dev         # API + web
pnpm build
pnpm lint
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:reset
pnpm db:seed
pnpm setup:win   # Windows: Full automated setup
pnpm infra:up:win # Windows: Start database
```

## Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`

## Test Accounts

All demo accounts use their ID as the password.

| ID | Role |
|----|------|
| `SUPER001` | Super Admin |
| `ADMIN001` | Admin |
| `TCH001` | Teacher / Sponsor |
| `STU001` | Student |
| `STU002` | Student |
| `STU003` | Student |
| `STU004` | Student |
| `STU005` | Student |
| `STU006` | Student |
| `STU007` | Student |
| `STU008` | Student |
| `STU009` | Student |
| `STU010` | Student |

---

## 🔐 Role Permissions

| Role | Capabilities |
|------|-------------|
| `SUPER_ADMIN` | Full access, manage admins, system-wide settings |
| `ADMIN` | Manage users, events, moderation, announcements |
| `TEACHER` | Create sessions, approve events, view rosters |
| `STUDENT_ADMIN` | Assist with student management |
| `STUDENT_LEADER` | Lead clubs, organize events |
| `STUDENT` | View announcements, register for Flex, join clubs |

---

## 📡 API Endpoints

The full interactive API documentation is available at **http://localhost:3001/docs** (Swagger UI).

Key route groups:
- `POST /auth/login` — Sign in
- `GET /users` — List users (Admin+)
- `POST /users/import/csv` — Bulk import students
- `GET /announcements` — Fetch announcements
- `GET /events` — View events
- `POST /flex-friday` — Create Flex Friday
- `GET /calendar` — Calendar entries
- `GET /notifications` — User notifications

---

## 🧑‍💻 Development Commands

```bash
pnpm dev              # Start all apps (web + api)
pnpm build            # Build all apps
pnpm db:generate      # Regenerate Prisma client
pnpm db:migrate       # Run new migrations
pnpm db:seed          # Reseed database
```

---

## 📄 License

This project is private and intended for use by **FCS Innovation Academy**.

---

> Built with ❤️ for FCS Innovation Academy students, teachers, and staff.
