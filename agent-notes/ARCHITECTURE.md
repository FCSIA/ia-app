# Architecture Guide

## Core Abstraction: Discrete Schemas
Avoid premature abstraction. The database uses explicit, discrete schemas for each domain object to keep relationships clean and strongly typed.

### Domain Models
*   **Users**: Global representation with roles (`STUDENT`, `TEACHER`, `SPONSOR`, etc.).
*   **Clubs**: Discrete model.
    *   Relationships: Sponsors (Teachers), Leaders (Students), Members.
    *   Communication: Club text channels and announcements.
*   **Flex Fridays**: Discrete model for school-wide or targeted Friday configurations.
    *   Relationships: Contains `FlexSessions`.
    *   `FlexSession` fields include Datetime, Resource links, and Attendance tracking.
*   **Student Schedules**: Discrete tracking for classes and GT Block.
*   **Channels**:
    *   Used for Announcements (All-admin, Pathway, Leadership channels).
    *   Used for Text Channels (Club-specific or global with strict audit logging).
*   **Calendar / Events**:
    *   IA display calendar tracks unified events.
    *   Custom events map directly to Clubs and Flex Fridays.

## Tech Stack
*   **Backend**: NestJS (TypeScript), Prisma ORM, PostgreSQL (Database Service).
*   **Web**: Next.js (App Router, Tailwind CSS, TanStack Query).
*   **Mobile**: Expo (React Native, Expo Router).
*   **Infrastructure**: Docker Compose (Local PostgreSQL + Redis).

## Monorepo Map
*   `/apps/api`: NestJS Backend
*   `/apps/web`: Next.js Web App
*   `/apps/mobile`: Expo Mobile App

## Key Constraints
*   **Free Constraints**: No paid tools/add-ons. Use local Auth, Postgres.
*   **Security**: No 1:1 DMs between students. Parent accounts are unsupported.
*   **Persistence**: PostgreSQL must store everything. Every text channel and action requires Audit Logging.
