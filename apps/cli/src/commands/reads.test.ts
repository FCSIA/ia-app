import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend, HOST } from "../fakeBackend";
import { run } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-reads-"));
});

afterEach(() => rmSync(config, { recursive: true, force: true }));

async function setup() {
  const backend = fakeBackend();
  const secrets = new Map<string, string>();
  const invoke = (argv: string[]) =>
    run(argv, { fetch: backend.handle, secrets, env: { FCSIA_CONFIG_DIR: config } });
  const login = await invoke(["login"]);
  expect(login.code).toBe(0);
  return { backend, invoke };
}

describe("today and schedule", () => {
  test("shows the day's blocks, with lunch left unlabelled", async () => {
    const { invoke } = await setup();
    const result = await invoke(["today", "--json"]);
    expect(result.code).toBe(0);
    const document = JSON.parse(result.stdout);
    expect(document.day.hasPersonalSchedule).toBe(true);
    expect(document.blocks).toEqual([
      expect.objectContaining({ kind: "PERIOD", period: 1, class: "Algebra II", start: "08:30", end: "09:20" }),
      expect.objectContaining({ kind: "LUNCH", class: "", start: "12:10" }),
    ]);
  });

  test("rejects a date that isn't a calendar day", async () => {
    const { invoke } = await setup();
    const result = await invoke(["schedule", "inspect", "11/12/2026", "--json"]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr)).toMatchObject({ reason: "invalid_date" });
  });
});

describe("announcements", () => {
  test("filters unread, shows one with its comments, and reports a missing one", async () => {
    const { invoke } = await setup();
    const unread = JSON.parse((await invoke(["announcements", "list", "--unread", "--json"])).stdout);
    expect(unread.announcements.map((item: { id: string }) => item.id)).toEqual(["ann1"]);
    expect(unread.announcements[0]).toMatchObject({ audience: "Everyone", comments: 2, isRead: false });

    const one = JSON.parse((await invoke(["announcements", "inspect", "ann1", "--json"])).stdout);
    expect(one.announcement.title).toBe("Picture day is Thursday");
    expect(one.comments.map((comment: { author: string }) => comment.author)).toEqual([
      "Ada Byron",
      "David Jones",
    ]);

    const missing = await invoke(["announcements", "inspect", "nope", "--json"]);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stderr)).toMatchObject({ reason: "announcement_not_found" });
  });
});

describe("events", () => {
  test("defaults to upcoming events, adds past ones with --all, and inspects by ID", async () => {
    const { invoke } = await setup();
    const upcoming = JSON.parse((await invoke(["events", "list", "--json"])).stdout);
    expect(upcoming.events.map((event: { id: string }) => event.id)).toEqual(["event1"]);

    const all = JSON.parse((await invoke(["events", "list", "--all", "--json"])).stdout);
    expect(all.events.map((event: { id: string }) => event.id)).toEqual(["event1", "event2"]);

    const one = JSON.parse((await invoke(["events", "inspect", "event2", "--json"])).stdout);
    expect(one.event).toMatchObject({
      id: "event2",
      title: "Robotics scrimmage",
      club: "Robotics Club",
      location: "Gym",
    });

    const missing = await invoke(["events", "inspect", "nope", "--json"]);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stderr)).toMatchObject({ reason: "event_not_found" });
  });
});

describe("flex", () => {
  test("lists Flex Fridays with their type and pathway labels", async () => {
    const { invoke } = await setup();
    const { fridays } = JSON.parse((await invoke(["flex", "sessions", "list", "--json"])).stdout);
    expect(fridays).toEqual([
      expect.objectContaining({ id: "flex1", typeLabel: "All students", sessions: 3, pathway: null }),
      expect.objectContaining({ id: "flex0", typeLabel: "Pathway specific", pathway: "Engineering", sessions: 2 }),
    ]);
  });
});

describe("notifications", () => {
  test("filters unread, resolves a web link, and reports a missing one", async () => {
    const { invoke } = await setup();
    const unread = JSON.parse((await invoke(["notifications", "list", "--unread", "--json"])).stdout);
    expect(unread.notifications.map((notification: { id: string }) => notification.id)).toEqual(["notif1"]);

    const read = JSON.parse((await invoke(["notifications", "read", "notif2", "--json"])).stdout);
    expect(read.notification).toMatchObject({
      id: "notif2",
      title: "Ada mentioned you in #builds",
      link: `${HOST}/clubs/club1/channels/chan1`,
    });

    const missing = await invoke(["notifications", "read", "nope", "--json"]);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stderr)).toMatchObject({ reason: "notification_not_found" });
  });
});

describe("search", () => {
  test("finds people and channels, and says when nothing matches", async () => {
    const { invoke } = await setup();
    const people = JSON.parse((await invoke(["search", "ada", "--json"])).stdout);
    expect(people.people).toEqual([expect.objectContaining({ id: "user2", name: "Ada Byron" })]);
    expect(people.channels).toEqual([]);

    const channels = JSON.parse((await invoke(["search", "build", "--json"])).stdout);
    expect(channels.channels).toEqual([
      expect.objectContaining({ id: "chan1", name: "builds", where: "Robotics Club" }),
    ]);

    const none = await invoke(["search", "zzz"]);
    expect(none.stderr).toBe('Nothing matches "zzz".\n');
  });
});
