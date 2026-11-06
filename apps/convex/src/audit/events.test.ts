/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { describe, expect, test, vi } from 'vitest';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import { logAuditEvent } from './_lib';
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { listFilteredPage } from './events';
import {
  auditActionLabel,
  auditMetaFields,
  auditPersonName,
  auditLabel,
  isFlexAudit,
  matchesAuditSearch,
  parseAuditSearch,
} from '../../../shared/audit';

vi.mock('../../lib/currentUser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/currentUser')>()),
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<'users'>) : null;
  },
}));
const modules = import.meta.glob('/src/**/*.*s');
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (uniqueId: string, roles: ('ADMIN' | 'STUDENT')[]) =>
      ctx.db.insert('users', {
        uniqueId,
        firstName: uniqueId === 'ADMIN' ? 'Eniola' : 'Ada',
        lastName: 'Famakinwa',
        roles,
        isStudent: roles.includes('STUDENT'),
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: '',
        createdAt: 0,
        updatedAt: 0,
      });
    const admin = await user('ADMIN', ['ADMIN']);
    const student = await user('STUDENT', ['STUDENT']);
    const club = await ctx.db.insert('clubs', {
      name: 'Robotics',
      joinPolicy: 'OPEN',
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    });
    const oldest = await ctx.db.insert('auditEvents', {
      actorId: admin,
      action: 'CLUB_CHANNEL_MESSAGE_POSTED',
      entityType: 'ClubChannelMessage',
      entityId: 'removed-message',
      createdAt: 1,
      meta: {
        clubId: club,
        studentId: student,
        bodyPreview: 'Updated room assignments!',
        original: { important: true },
      },
    });
    for (let i = 2; i <= 7; i++)
      await ctx.db.insert('auditEvents', {
        action: 'FLEX_WORKSHOP_CREATED',
        entityType: i % 2 ? 'FlexWorkshop' : 'FLEX_WORKSHOP',
        createdAt: i,
      });
    return { admin, student, club, oldest };
  });
  return {
    t,
    ...ids,
    adminClient: t.withIdentity({ subject: ids.admin }),
    studentClient: t.withIdentity({ subject: ids.student }),
  };
}

describe('audit search grammar', () => {
  test('opens an exact user target safely and only for staff', async () => {
    const { adminClient, studentClient, t, admin, student } = await fixture();
    const paginationOpts = { numItems: 20, cursor: null };
    const exact = await adminClient.query(api.users.admin.list, { userId: admin, roleGroup: 'students', search: 'does not match', paginationOpts });
    expect(exact.page.map((person) => person._id)).toEqual([admin]);
    expect(exact.isDone).toBe(true);
    expect((await adminClient.query(api.users.admin.list, { userId: 'invalid-id', paginationOpts })).page).toEqual([]);
    expect((await studentClient.query(api.users.admin.list, { userId: student, paginationOpts })).page).toEqual([]);
    expect((await t.query(api.users.admin.list, { userId: admin, paginationOpts })).page).toEqual([]);
  });
  test.each([
    ['ANNOUNCEMENT_COMMENT_DELETED', 'Deleted announcement comment'],
    ['CLUB_CHANNEL_MESSAGE_POSTED', 'Posted a message'],
    ['CLUB_CHANNEL_MESSAGE_REACTION_REMOVED', 'Removed a reaction'],
    ['CLUB_MEMBER_ROLE_SET', 'Set a club member role'],
    ['schedule.updated', 'Updated a schedule'],
    ['schoolDayBlock.created', 'Created school day block'],
    ['FLEX_WORKSHOP_CREATED', 'Created a workshop'],
    ['FLEX_WORKSHOP_REGISTERED', 'Registered for a workshop'],
    ['FUTURE_ACTION', 'Future action'],
  ])('labels %s consistently in rows, filters, and Details', (action, expected) => {
    expect(auditActionLabel(action)).toBe(expected);
  });
  test('keeps snapshots and changes human while retaining technical data separately', () => {
    const event = { id: 'message', action: 'CLUB_CHANNEL_MESSAGE_UPDATED', entityType: 'ClubChannelMessage', createdAt: new Date().toISOString(), meta: { previousBodyPreview: 'Old text', bodyPreview: 'New text', bodyLength: 8, attachmentCount: 0, clubId: 'opaque' } };
    expect(auditMetaFields(event)).toEqual([
      { key: 'previousBodyPreview', label: 'Before', value: 'Old text' },
      { key: 'bodyPreview', label: 'After', value: 'New text' },
    ]);
    expect(auditMetaFields({ ...event, action: 'CLUB_CHANNEL_MESSAGE_DELETED' })).toEqual([]);
  });
  test.each(['person:"unfinished', '-person:"unfinished', String.raw`text:"say \"hello`])(
    'identifies the missing closing quote in %s',
    (input) => expect(parseAuditSearch(input).error).toBe('Close each quoted value with a double quote.'),
  );
  test('distinguishes a missing separator from an unfinished phrase', () => {
    expect(parseAuditSearch('person:"Alex"action:read').error).toBe('Separate filters with a space.');
  });
  test('supports phrases, exclusions, case, and readable labels', () => {
    const query = parseAuditSearch(
      'person:"Eniola Famakinwa" action:"message posted" -text:rejected after:2026-10-01 before:2026-10-02',
    );
    expect(query.error).toBeNull();
    expect(
      matchesAuditSearch(
        {
          id: 'row',
          actorId: 'person',
          actor: {
            id: 'person',
            firstName: 'Eniola',
            lastName: 'Famakinwa',
            uniqueId: 'x',
          },
          action: 'CLUB_CHANNEL_MESSAGE_POSTED',
          entityType: 'ClubChannelMessage',
          createdAt: '2026-10-02T23:59:59.999Z',
        },
        query.terms,
      ),
    ).toBe(true);
    expect(auditActionLabel('CLUB_CHANNEL_MESSAGE_REACTION_ADDED')).toBe(
      'Added a reaction',
    );
    expect(auditLabel('schoolDayBlock.created')).toBe(
      'School day block created',
    );
    expect(isFlexAudit('FLEX_ATTENDANCE')).toBe(true);
    expect(isFlexAudit('Event')).toBe(true);
    expect(isFlexAudit('EVENT')).toBe(true);
  });
  test.each([
    'person:"unfinished',
    'person:',
    'unknown:value',
    'source:admin',
    'after:2026-02-30',
    'before:yesterday',
    'text:""',
    'text:"a"b',
  ])('rejects malformed query %s', (input) =>
    expect(parseAuditSearch(input).error).not.toBeNull(),
  );
  test('supports escaped quotes, literal colons in quotes, and plain words', () => {
    expect(
      parseAuditSearch(String.raw`text:"say \"hello\""`).terms[0]?.value,
    ).toBe('say "hello"');
    expect(parseAuditSearch('text:"room: 12" assignments').terms).toEqual([
      { field: 'text', value: 'room: 12', exclude: false },
      { field: 'text', value: 'assignments', exclude: false },
    ]);
  });
  test('bounds parser work', () => {
    expect(parseAuditSearch('x'.repeat(2001)).error).not.toBeNull();
    expect(parseAuditSearch('word '.repeat(31)).error).not.toBeNull();
    expect(parseAuditSearch('   ').terms).toEqual([]);
  });
});

describe('audit history and context', () => {
  test('fills matching pages across nonmatching rows and restarts when filters change', async () => {
    const f = await fixture();
    const expected = await f.t.run(async (ctx) => {
      const ids: Id<'auditEvents'>[] = [];
      for (let i = 8; i <= 19; i++) {
        const id = await ctx.db.insert('auditEvents', {
          action: i % 3 === 0 ? 'MATCH' : 'OTHER',
          entityType: 'Example',
          createdAt: i,
        });
        if (i % 3 === 0) ids.unshift(id);
      }
      return ids;
    });
    const first = await f.adminClient.query(api.audit.events.listFilteredPage, {
      action: 'MATCH', paginationOpts: { cursor: null, numItems: 2 },
    });
    const second = await f.adminClient.query(api.audit.events.listFilteredPage, {
      action: 'MATCH', paginationOpts: { cursor: first.continueCursor, numItems: 2 },
    });
    expect([...first.page, ...second.page].map((row) => row.id)).toEqual(expected);
    const changed = await f.adminClient.query(api.audit.events.listFilteredPage, {
      action: 'OTHER', paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(changed.page).toHaveLength(2);
    expect(changed.page.every((row) => row.action === 'OTHER')).toBe(true);
    expect(Date.parse(changed.page[0]!.createdAt)).toBe(19);
  });
  test('keeps split ranges contiguous even with equal timestamps and sparse matches', async () => {
    const f = await fixture();
    const expected = await f.t.run(async (ctx) => {
      const ids: Id<'auditEvents'>[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await ctx.db.insert('auditEvents', {
          action: 'OTHER', entityType: 'Example', entityId: i % 2 ? `match-${i}` : `other-${i}`, createdAt: 100,
        });
        if (i % 2) ids.push(id);
      }
      return ids;
    });
    // A substring filter has no index, so it scans by time and must split.
    const filter = { entityId: 'match' };
    const whole = await f.adminClient.query(api.audit.events.listFilteredPage, {
      ...filter, paginationOpts: { cursor: null, numItems: 20, maximumRowsRead: 10 },
    });
    expect(whole.pageStatus).toBe('SplitRequired');
    expect(whole.splitCursor).toBeTruthy();
    const left = await f.adminClient.query(api.audit.events.listFilteredPage, {
      ...filter, paginationOpts: { cursor: null, endCursor: whole.splitCursor, numItems: 20 },
    });
    const right = await f.adminClient.query(api.audit.events.listFilteredPage, {
      ...filter, paginationOpts: { cursor: whole.splitCursor!, endCursor: whole.continueCursor, numItems: 20 },
    });
    const combined = [...left.page, ...right.page].map((row) => row.id);
    expect(combined).toEqual(whole.page.map((row) => row.id));
    expect(new Set(combined)).toEqual(new Set(expected));
  });
  test('bounds sparse exact-filter scans and avoids unnecessary related reads', async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 120; i++) {
        await ctx.db.insert('auditEvents', {
          action: 'OTHER', entityType: 'Example', actorId: f.admin, createdAt: 100 + i,
        });
      }
    });
    const { page, getCalls } = await f.adminClient.run(async (ctx) => {
      let getCalls = 0;
      const db = new Proxy(ctx.db, {
        get(target, prop) {
          const value = Reflect.get(target, prop, target);
          if (prop === 'get') return (...args: Parameters<typeof ctx.db.get>) => {
            getCalls++;
            return (value as typeof ctx.db.get)(...args);
          };
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const handler = (listFilteredPage as unknown as { _handler: (
        context: QueryCtx,
        args: FunctionArgs<typeof api.audit.events.listFilteredPage>,
      ) => Promise<FunctionReturnType<typeof api.audit.events.listFilteredPage>> })._handler;
      const page = await handler({ ...ctx, db }, {
        entityId: 'never', paginationOpts: { cursor: null, numItems: 10 },
      });
      return { page, getCalls };
    });
    const firstHundred = await f.adminClient.query(api.audit.events.listFilteredPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    expect(page.page).toEqual([]);
    expect(page.isDone).toBe(false);
    expect(page.continueCursor).toBe(firstHundred.continueCursor);
    expect(firstHundred.page).toHaveLength(100);
    expect(getCalls).toBe(1); // Viewer only; rejected rows need no hydration.
    const oversized = await f.adminClient.query(api.audit.events.listFilteredPage, {
      paginationOpts: { cursor: null, numItems: 10000, maximumRowsRead: 10000 },
    });
    expect(oversized.page).toHaveLength(100);
    expect(oversized.isDone).toBe(false);
  });
  test('prefiltering stored fields preserves hydrated search results and cursor boundaries', async () => {
    const f = await fixture();
    const { toAuditEvents } = await import('./_lib');
    const { auditMatcher } = await import('./_filters');
    const all = await f.t.run(async (ctx) => toAuditEvents(ctx,
      await ctx.db.query('auditEvents').withIndex('by_createdAt').order('desc').collect(),
    ));
    const filters = [
      { action: 'FLEX_WORKSHOP_CREATED' },
      { action: 'missing-action' },
      { entityType: 'FLEX_WORKSHOP' },
      { category: 'general' as const },
      { category: 'flex' as const },
      { actorScope: 'USER' as const },
      { actorScope: 'SYSTEM' as const },
      { entityId: 'OVED-MESS' },
      { startDate: '1970-01-01', endDate: '1970-01-01' },
      { action: 'CLUB_CHANNEL_MESSAGE_POSTED', actor: 'Eniola' },
      { category: 'general' as const, advancedQuery: 'record:Robotics text:"room assignments"' },
    ];
    for (const filter of filters) {
      const expected = all.filter(auditMatcher(filter)).map((event) => event.id);
      expect((await f.adminClient.query(api.audit.events.list, filter)).map((event) => event.id))
        .toEqual(expected);
      expect((await f.adminClient.query(api.audit.events.listFilteredPage, {
        ...filter, paginationOpts: { cursor: null, numItems: 20 },
      })).page.map((event) => event.id)).toEqual(expected);
      let cursor: string | null = null;
      const actual: string[] = [];
      for (let page = 0; page < 4; page++) {
        const result: FunctionReturnType<typeof api.audit.events.listPage> =
          await f.adminClient.query(api.audit.events.listPage, {
            ...filter, paginationOpts: { cursor, numItems: 2 },
          });
        actual.push(...result.page.map((event) => event.id));
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
      expect(actual).toEqual(expected);
    }
  });
  test('displays preferred names while retaining regular-name and structured person searches', async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.admin, { preferredName: 'Eni' });
      await ctx.db.patch(f.student, { preferredName: 'Countess Ada' });
    });
    for (const name of ['Eniola Famakinwa', 'Eni', 'ADMIN']) {
      for (const filter of [
        { actor: name },
        { query: name },
        { advancedQuery: `person:"${name}"` },
      ]) {
        const listed = await f.adminClient.query(api.audit.events.list, filter);
        const paged = await f.adminClient.query(api.audit.events.listFilteredPage, {
          ...filter,
          paginationOpts: { cursor: null, numItems: 10 },
        });
        expect(listed.map((row) => row.id)).toEqual([f.oldest]);
        expect(paged.page.map((row) => row.id)).toEqual([f.oldest]);
        expect(auditPersonName(paged.page[0]!)).toBe('Eni');
      }
    }
    const detail = await f.adminClient.query(api.audit.events.get, {
      auditEventId: f.oldest,
    });
    expect(detail!.context.references).toContainEqual({
      id: f.student,
      label: 'Student',
      name: 'Countess Ada',
    });
  });
  test('finds older matches after empty batches, preserving cursor and original data', async () => {
    const f = await fixture();
    let cursor: string | null = null;
    const matches: FunctionReturnType<
      typeof api.audit.events.listFilteredPage
    >['page'] = [];
    let emptyPages = 0;
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      const result: FunctionReturnType<typeof api.audit.events.listFilteredPage> =
        await f.adminClient.query(api.audit.events.listFilteredPage, {
          paginationOpts: { cursor, numItems: 2, maximumRowsRead: 2 },
          advancedQuery: 'person:"Eniola Famakinwa" text:"room assignments"',
        });
      if (!result.page.length) emptyPages++;
      matches.push(...result.page);
      if (result.isDone) break;
      expect(result.continueCursor).not.toBe(cursor);
      cursor = result.continueCursor;
    }
    expect(emptyPages).toBeGreaterThan(0);
    expect(matches.map((row) => row.id)).toEqual([f.oldest]);
    expect(matches[0]!.context.references).toEqual(
      expect.arrayContaining([
        { id: f.club, label: 'Club', name: 'Robotics' },
        { id: f.student, label: 'Student', name: 'Ada Famakinwa' },
      ]),
    );
    const detail = await f.adminClient.query(api.audit.events.get, {
      auditEventId: f.oldest,
    });
    expect(detail!.meta.original).toEqual({ important: true });
    expect(detail!.entityId).toBe('removed-message');
  });
  test('returns every record once and groups legacy and uppercase Flex entries', async () => {
    const f = await fixture();
    const all = await f.adminClient.query(api.audit.events.listFilteredPage, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(all.page).toHaveLength(7);
    expect(new Set(all.page.map((row) => row.id)).size).toBe(7);
    const flex = await f.adminClient.query(api.audit.events.listFilteredPage, {
      category: 'flex',
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(flex.page).toHaveLength(6);
    const general = await f.adminClient.query(api.audit.events.listFilteredPage, {
      category: 'general',
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(general.page.map((row) => row.id)).toEqual([f.oldest]);
  });
  test('reaches all history beyond the initial page and filter-option window', async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 8; i <= 620; i++)
        await ctx.db.insert('auditEvents', {
          action: 'FLEX_WORKSHOP_CREATED',
          entityType: 'FlexWorkshop',
          createdAt: i,
        });
    });
    const options = await f.adminClient.query(
      api.audit.events.listFilterOptions,
      {},
    );
    expect(options.actions).toContain('CLUB_CHANNEL_MESSAGE_POSTED');
    let cursor: string | null = null;
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result: FunctionReturnType<typeof api.audit.events.listFilteredPage> =
        await f.adminClient.query(api.audit.events.listFilteredPage, {
          paginationOpts: { cursor, numItems: 250 },
        });
      ids.push(...result.page.map((row) => row.id));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(ids).toHaveLength(620);
    expect(new Set(ids).size).toBe(620);
    expect(ids.at(-1)).toBe(f.oldest);
    const older = await f.adminClient.query(api.audit.events.listFilteredPage, {
      action: 'CLUB_CHANNEL_MESSAGE_POSTED',
      entityType: 'ClubChannelMessage',
      paginationOpts: { cursor: null, numItems: 250 },
    });
    expect(older.page.map((row) => row.id)).toEqual([f.oldest]);
  });
  test('keeps deleted people separate from system activity and retains their ID', async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.delete(f.admin));
    const deletedActor = await f.t.run(async (ctx) => {
      const { toAuditEvents } = await import('./_lib');
      return toAuditEvents(ctx, [(await ctx.db.get(f.oldest))!]);
    });
    expect(deletedActor[0]!.actor).toBeNull();
    expect(deletedActor[0]!.actorId).toBe(f.admin);
    expect(
      matchesAuditSearch(
        deletedActor[0]!,
        parseAuditSearch('source:system').terms,
      ),
    ).toBe(false);
    expect(
      matchesAuditSearch(
        deletedActor[0]!,
        parseAuditSearch('source:person').terms,
      ),
    ).toBe(true);
  });
  test('uses inclusive timestamp boundaries and rejects bad server-side syntax', async () => {
    const f = await fixture();
    const result: FunctionReturnType<typeof api.audit.events.listFilteredPage> =
      await f.adminClient.query(api.audit.events.listFilteredPage, {
        startAt: 2,
        endAt: 4,
        paginationOpts: { cursor: null, numItems: 10 },
      });
    expect(result.page.map((row) => Date.parse(row.createdAt))).toEqual([
      4, 3, 2,
    ]);
    await expect(
      f.adminClient.query(api.audit.events.listFilteredPage, {
        advancedQuery: 'bad:query',
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow('Unknown field');
  });
  test('denies anonymous and student access to rows, names, options, and details', async () => {
    const f = await fixture();
    for (const client of [f.t, f.studentClient]) {
      expect(
        (
          await client.query(api.audit.events.listFilteredPage, {
            paginationOpts: { cursor: null, numItems: 10 },
          })
        ).page,
      ).toEqual([]);
      expect(
        await client.query(api.audit.events.get, { auditEventId: f.oldest }),
      ).toBeNull();
      expect(
        await client.query(api.audit.events.listFilterOptions, {}),
      ).toEqual({ actions: [], entityTypes: [] });
      expect(await client.query(api.audit.events.list, {})).toEqual([]);
    }
  });
});

describe('audit index integrity', () => {
  test('backfills historical counts idempotently and keeps new logs atomic', async () => {
    const f = await fixture();
    expect((await f.adminClient.query(api.audit.events.counts, {})).total).toBeNull();
    await f.t.mutation(internal.audit.migrations.backfill, {});
    await f.t.mutation(internal.audit.migrations.backfill, {});
    expect((await f.adminClient.query(api.audit.events.counts, {})).total).toBe(7);
    await f.t.run(async (ctx) => {
      await logAuditEvent(ctx, { actorId: f.admin, action: 'CLUB_CHANNEL_CREATED', entityType: 'ClubChannel', meta: { title: 'A channel' } });
    });
    expect((await f.adminClient.query(api.audit.events.counts, {})).total).toBe(8);
    const person = await f.adminClient.query(api.audit.events.counts, { actorId: f.admin, category: 'clubs-chat' });
    expect(person).toMatchObject({ total: 2, exact: true });
    const filtered = await f.adminClient.query(api.audit.events.listFilteredPage, { actorId: f.admin, category: 'clubs-chat', paginationOpts: { cursor: null, numItems: 2 } });
    expect(filtered.page).toHaveLength(2);
    expect(filtered.page.every((event) => event.actorId === f.admin)).toBe(true);
    expect((await f.studentClient.query(api.audit.events.counts, {})).total).toBeNull();
  });
  test('counts a history written only by the logger exactly, without a backfill', async () => {
    const t = convexTest(schema, modules);
    const admin = await t.run((ctx) => ctx.db.insert('users', {
      uniqueId: 'ADMIN', firstName: 'Eniola', lastName: 'Famakinwa', roles: ['ADMIN'], isStudent: false, isTeacherStaff: false,
      isStudentAdmin: false, isOtherRole: false, isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: '', createdAt: 0, updatedAt: 0,
    }));
    const adminClient = t.withIdentity({ subject: admin });
    expect(await adminClient.query(api.audit.events.counts, {})).toMatchObject({ total: 0, exact: true });
    await t.run(async (ctx) => {
      await logAuditEvent(ctx, { actorId: admin, action: 'CLUB_CHANNEL_CREATED', entityType: 'ClubChannel', meta: { title: 'A channel' } });
      await logAuditEvent(ctx, { actorId: 'system', action: 'KEYWORD_ADDED', entityType: 'KeywordRule', meta: { keyword: 'example' } });
    });
    expect(await adminClient.query(api.audit.events.counts, {})).toMatchObject({ total: 2, exact: true });
    expect(await adminClient.query(api.audit.events.counts, { actorId: admin })).toMatchObject({ total: 1, exact: true });
  });
  test('keeps totals unavailable while a backfill is part-way through history', async () => {
    vi.useFakeTimers();
    try {
      const f = await fixture();
      await f.t.run(async (ctx) => {
        for (let i = 0; i < 100; i++) await ctx.db.insert('auditEvents', { action: 'FLEX_WORKSHOP_CREATED', entityType: 'FlexWorkshop', createdAt: 100 + i });
      });
      // The first batch backfills the oldest 100 rows and schedules the rest.
      await f.t.mutation(internal.audit.migrations.backfill, {});
      expect((await f.adminClient.query(api.audit.events.counts, {})).total).toBeNull();
      await f.t.finishAllScheduledFunctions(vi.runAllTimers);
      expect((await f.adminClient.query(api.audit.events.counts, {})).total).toBe(107);
    } finally {
      vi.useRealTimers();
    }
  });
  test('server context exposes live record routes without linking deleted records', async () => {
    const f = await fixture();
    const detail = await f.adminClient.query(api.audit.events.get, { auditEventId: f.oldest });
    expect(detail?.context.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: f.club, href: `/clubs/${f.club}` }),
      expect.objectContaining({ id: 'removed-message', href: null }),
    ]));
  });
  test('names a reaction by its message and marks removed records deleted, not bulk rows', async () => {
    const f = await fixture();
    const ids = await f.t.run(async (ctx) => {
      const channel = await ctx.db.insert('clubChannels', { clubId: f.club, name: 'general', visibility: 'PUBLIC', createdById: f.admin, createdAt: 0, updatedAt: 0 });
      const message = await ctx.db.insert('clubChannelMessages', { channelId: channel, authorId: f.student, body: '  Bring safety goggles on Friday  ', isPinned: false, createdAt: 0, updatedAt: 0 });
      const removed = await ctx.db.insert('clubChannelMessages', { channelId: channel, authorId: f.student, body: 'Removed text', isPinned: false, deletedAt: 5, createdAt: 0, updatedAt: 5 });
      const react = (entityId: string) => logAuditEvent(ctx, { actorId: f.student, action: 'CLUB_CHANNEL_MESSAGE_REACTION_ADDED', entityType: 'ClubChannelMessage', entityId, meta: { clubId: f.club, channelId: channel, emoji: 'LIKE' } });
      return {
        channel, message,
        live: await react(message),
        removed: await react(removed),
        bulk: await logAuditEvent(ctx, { actorId: f.admin, action: 'USER_CSV_BULK_UPDATED', entityType: 'User', entityId: 'bulk', meta: { updated: 2 } }),
      };
    });
    const live = await f.adminClient.query(api.audit.events.get, { auditEventId: ids.live });
    expect(live?.context).toMatchObject({ title: 'Bring safety goggles on Friday', deleted: false });
    expect(live?.context.links[0]).toMatchObject({ label: 'Record', href: `/clubs/${f.club}/channels/${ids.channel}?message=${ids.message}` });
    const removed = await f.adminClient.query(api.audit.events.get, { auditEventId: ids.removed });
    expect(removed?.context).toMatchObject({ title: 'Message', deleted: true });
    expect(removed?.context.links[0]?.href).toBeNull();
    expect((await f.adminClient.query(api.audit.events.get, { auditEventId: ids.bulk }))?.context.deleted).toBe(false);
  });
  test('application writers cannot bypass audit provenance and counts', () => {
    const sources = import.meta.glob('../**/*.ts', { eager: true, query: '?raw', import: 'default' });
    const bypasses = Object.entries(sources).filter(([path, source]) => !path.endsWith('.test.ts') && path !== './_lib.ts' && /\.insert\(\s*['"]auditEvents['"]/.test(String(source))).map(([path]) => path);
    expect(bypasses).toEqual([]);
  });
  test('distinguishes missing historical actors from explicit automation and tolerates malformed URL person IDs', async () => {
    const f = await fixture();
    const unknown = { id: 'historical', action: 'CLUB_CREATED', entityType: 'Club', createdAt: new Date().toISOString() };
    expect(auditPersonName(unknown)).toBe('Unknown (not recorded)');
    expect(matchesAuditSearch(unknown, parseAuditSearch('source:system').terms)).toBe(false);
    expect(auditPersonName({ ...unknown, meta: { auditSource: 'system' } })).toBe('System');
    const result = await f.adminClient.query(api.audit.events.listPage, { actorId: 'invalid-id', paginationOpts: { numItems: 10, cursor: null } });
    expect(result).toMatchObject({ page: [], isDone: true });
  });
  test('merges legacy record spellings through indexed pagination without changing history', async () => {
    const f = await fixture();
    const ids = await f.t.run(async (ctx) => {
      const first = await ctx.db.insert('auditEvents', { actorId: f.admin, action: 'FLEX_FRIDAY_CREATED', entityType: 'FLEX_FRIDAY', entityId: 'friday', createdAt: 8 });
      const second = await ctx.db.insert('auditEvents', { actorId: f.admin, action: 'FLEX_FRIDAY_CREATED', entityType: 'FlexFriday', entityId: 'friday', createdAt: 9 });
      return [second, first];
    });
    const first = await f.adminClient.query(api.audit.events.listPage, { entityType: 'FlexFriday', recordId: 'friday', paginationOpts: { numItems: 1, cursor: null } });
    const second = await f.adminClient.query(api.audit.events.listPage, { entityType: 'FlexFriday', recordId: 'friday', paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect([...first.page, ...second.page].map((row) => row.id)).toEqual(ids);
    expect(second.page[0]?.entityType).toBe('FLEX_FRIDAY');
  });
  test('combines categories and actions with OR within each dimension before pagination', async () => {
    const f = await fixture();
    await f.t.mutation(internal.audit.migrations.backfill, {});
    const args = { categories: ['clubs-chat', 'flex-events'] as ('clubs-chat' | 'flex-events')[], actions: ['CLUB_CHANNEL_MESSAGE_POSTED', 'FLEX_WORKSHOP_CREATED'] };
    const all: FunctionReturnType<typeof api.audit.events.listPage>['page'] = [];
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const result: FunctionReturnType<typeof api.audit.events.listPage> = await f.adminClient.query(api.audit.events.listPage, { ...args, paginationOpts: { numItems: 2, cursor } });
      all.push(...result.page);
      cursor = result.continueCursor;
      done = result.isDone;
    }
    expect(all).toHaveLength(7);
    expect(new Set(all.map((row) => row.id)).size).toBe(7);
    expect(all.map((row) => Date.parse(row.createdAt))).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(await f.adminClient.query(api.audit.events.counts, { categories: ['clubs-chat', 'flex-events'] })).toMatchObject({ total: 7, exact: true });
    const narrowed = await f.adminClient.query(api.audit.events.listPage, { ...args, categories: ['clubs-chat'], paginationOpts: { numItems: 10, cursor: null } });
    expect(narrowed.page).toHaveLength(1);
    expect(narrowed.page[0]?.id).toBe(f.oldest);
    expect(await f.adminClient.query(api.audit.events.counts, args)).toMatchObject({ total: 7, exact: false });
  });

});
