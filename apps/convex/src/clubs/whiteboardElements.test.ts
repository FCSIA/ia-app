import { describe, expect, test } from "vitest";
import {
  MAX_WHITEBOARD_AUDIT_CHANGES,
  MAX_WHITEBOARD_ELEMENTS_PER_SAVE,
  assertWhiteboardSaveBounds,
  assertWhiteboardThumbnail,
  classifyWhiteboardChange,
  liveElementDelta,
  normalizeWhiteboardTitle,
  planWhiteboardRestore,
  sanitizeWhiteboardElement,
  shouldAcceptWhiteboardWrite,
  shouldCoalesceWhiteboardRevision,
  whiteboardEditAuditMeta,
} from "./whiteboardElements";

const element = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "abc_123",
    type: "rectangle",
    version: 2,
    versionNonce: 99,
    isDeleted: false,
    x: 10,
    y: 20,
    ...overrides,
  });

describe("whiteboard element sanitization", () => {
  test("accepts drawing primitives and keeps their data", () => {
    const sanitized = sanitizeWhiteboardElement(element());
    expect(sanitized).toMatchObject({
      elementId: "abc_123",
      type: "rectangle",
      version: 2,
      versionNonce: 99,
      isDeleted: false,
      text: null,
    });
    expect(JSON.parse(sanitized.data)).toMatchObject({ x: 10, y: 20 });
  });

  test("captures text so edits can be audited", () => {
    expect(
      sanitizeWhiteboardElement(element({ type: "text", text: "hello" })).text,
    ).toBe("hello");
  });

  test.each(["image", "embeddable", "iframe", "selection", "magicframe"])(
    "rejects %s elements",
    (type) => {
      expect(() => sanitizeWhiteboardElement(element({ type }))).toThrow(
        /not supported/,
      );
    },
  );

  test("rejects malformed identity and versions", () => {
    expect(() => sanitizeWhiteboardElement("not json")).toThrow();
    expect(() => sanitizeWhiteboardElement("[]")).toThrow();
    expect(() => sanitizeWhiteboardElement(element({ id: "../x" }))).toThrow();
    expect(() => sanitizeWhiteboardElement(element({ version: 0 }))).toThrow();
    expect(() => sanitizeWhiteboardElement(element({ version: 1.5 }))).toThrow();
    expect(() => sanitizeWhiteboardElement(element({ isDeleted: "no" }))).toThrow();
  });

  test("drops unsafe links and editor extension payloads", () => {
    const unsafe = JSON.parse(
      sanitizeWhiteboardElement(
        element({ link: "javascript:alert(1)", customData: { a: 1 } }),
      ).data,
    );
    expect(unsafe.link).toBeNull();
    expect(unsafe).not.toHaveProperty("customData");
    const safe = JSON.parse(
      sanitizeWhiteboardElement(element({ link: " https://example.com " })).data,
    );
    expect(safe.link).toBe("https://example.com");
  });

  test("bounds element and batch size", () => {
    expect(() =>
      sanitizeWhiteboardElement(element({ points: "x".repeat(300_000) })),
    ).toThrow(/too large/);
    expect(() => assertWhiteboardSaveBounds([])).toThrow();
    expect(() =>
      assertWhiteboardSaveBounds(
        Array.from({ length: MAX_WHITEBOARD_ELEMENTS_PER_SAVE + 1 }, () => element()),
      ),
    ).toThrow(/Too many/);
  });
});

describe("whiteboard reconciliation", () => {
  test("higher versions win and ties go to the lower nonce", () => {
    expect(shouldAcceptWhiteboardWrite(null, { version: 1, versionNonce: 5 })).toBe(true);
    const existing = { version: 3, versionNonce: 50 };
    expect(shouldAcceptWhiteboardWrite(existing, { version: 4, versionNonce: 99 })).toBe(true);
    expect(shouldAcceptWhiteboardWrite(existing, { version: 2, versionNonce: 1 })).toBe(false);
    expect(shouldAcceptWhiteboardWrite(existing, { version: 3, versionNonce: 49 })).toBe(true);
    expect(shouldAcceptWhiteboardWrite(existing, { version: 3, versionNonce: 50 })).toBe(false);
    expect(shouldAcceptWhiteboardWrite(existing, { version: 3, versionNonce: 51 })).toBe(false);
  });

  test("classifies changes and tracks live counts", () => {
    const live = { isDeleted: false };
    const gone = { isDeleted: true };
    expect(classifyWhiteboardChange(null, live)).toBe("created");
    expect(classifyWhiteboardChange(live, live)).toBe("updated");
    expect(classifyWhiteboardChange(live, gone)).toBe("deleted");
    expect(classifyWhiteboardChange(gone, live)).toBe("restored");
    expect(liveElementDelta(null, live)).toBe(1);
    expect(liveElementDelta(live, gone)).toBe(-1);
    expect(liveElementDelta(gone, live)).toBe(1);
    expect(liveElementDelta(live, live)).toBe(0);
  });
});

describe("whiteboard audit metadata", () => {
  test("counts every change but itemizes a bounded, previewed set", () => {
    const changes = Array.from({ length: MAX_WHITEBOARD_AUDIT_CHANGES + 5 }, (_, i) => ({
      elementId: `e${i}`,
      type: "text" as const,
      change: i === 0 ? ("deleted" as const) : ("created" as const),
      textPreview: "y".repeat(500),
    }));
    const meta = whiteboardEditAuditMeta({
      clubId: "club",
      channelId: "channel",
      boardId: "board",
      fromSeq: 1,
      toSeq: changes.length,
      changes,
    });
    expect(meta.changeCount).toBe(changes.length);
    expect(meta.created).toBe(changes.length - 1);
    expect(meta.deleted).toBe(1);
    expect(meta.changes).toHaveLength(MAX_WHITEBOARD_AUDIT_CHANGES);
    expect(meta.omittedChangeCount).toBe(5);
    expect(meta.changes[0]!.textPreview).toHaveLength(240);
  });
});

describe("whiteboard titles, previews, and revisions", () => {
  test("normalizes titles", () => {
    expect(normalizeWhiteboardTitle("  Plan \n  A ")).toBe("Plan A");
    expect(normalizeWhiteboardTitle("   ")).toBe("Untitled whiteboard");
    expect(normalizeWhiteboardTitle(undefined)).toBe("Untitled whiteboard");
    expect(Array.from(normalizeWhiteboardTitle("é".repeat(200)))).toHaveLength(80);
  });

  test("accepts only small base64 PNG or WebP previews", () => {
    expect(() => assertWhiteboardThumbnail("data:image/webp;base64,AAAA")).not.toThrow();
    expect(() => assertWhiteboardThumbnail("data:image/png;base64,AAA=")).not.toThrow();
    expect(() => assertWhiteboardThumbnail("data:image/svg+xml;base64,AAAA")).toThrow();
    expect(() => assertWhiteboardThumbnail("data:image/png;base64,<script>")).toThrow();
    expect(() =>
      assertWhiteboardThumbnail(`data:image/png;base64,${"A".repeat(70_000)}`),
    ).toThrow();
  });

  test("coalesces only consecutive edits by the same person", () => {
    const last = { kind: "EDIT" as const, actorId: "u1", updatedAt: 1_000, deleted: 0 };
    const next = { kind: "EDIT" as const, actorId: "u1", now: 2_000, deleted: 0 };
    expect(shouldCoalesceWhiteboardRevision(last, next)).toBe(true);
    // Removals always get their own restore point, and vice versa.
    expect(shouldCoalesceWhiteboardRevision(last, { ...next, deleted: 1 })).toBe(false);
    expect(shouldCoalesceWhiteboardRevision({ ...last, deleted: 2 }, next)).toBe(false);
    expect(
      shouldCoalesceWhiteboardRevision({ ...last, deleted: 2 }, { ...next, deleted: 1 }),
    ).toBe(true);
    expect(shouldCoalesceWhiteboardRevision(last, { ...next, actorId: "u2" })).toBe(false);
    expect(shouldCoalesceWhiteboardRevision(last, { ...next, kind: "RESTORE" })).toBe(false);
    expect(shouldCoalesceWhiteboardRevision({ ...last, kind: "RESTORE" }, next)).toBe(false);
    expect(shouldCoalesceWhiteboardRevision(last, { ...next, now: 1_000 + 6 * 60_000 })).toBe(false);
    expect(shouldCoalesceWhiteboardRevision(null, next)).toBe(false);
  });

  test("plans restore writes as newer versions", () => {
    const state = (id: string, version: number, isDeleted = false, x = 0) => ({
      elementId: id,
      version,
      isDeleted,
      data: JSON.stringify({ id, type: "rectangle", version, versionNonce: 1, isDeleted, x }),
    });
    const current = [
      state("same", 2),
      state("moved", 3, false, 50),
      state("added", 1),
      state("removed", 2, true),
      state("stillGone", 2, true),
    ];
    const target = new Map([
      ["same", { isDeleted: false, data: current[0]!.data }],
      ["moved", { isDeleted: false, data: state("moved", 2, false, 10).data }],
      ["removed", { isDeleted: false, data: state("removed", 1).data }],
    ]);
    const writes = planWhiteboardRestore(current, target, () => 7).map((raw) => JSON.parse(raw));
    expect(writes).toEqual([
      { id: "moved", type: "rectangle", version: 4, versionNonce: 7, isDeleted: false, x: 10 },
      { id: "added", type: "rectangle", version: 2, versionNonce: 7, isDeleted: true, x: 0 },
      { id: "removed", type: "rectangle", version: 3, versionNonce: 7, isDeleted: false, x: 0 },
    ]);
  });
});
