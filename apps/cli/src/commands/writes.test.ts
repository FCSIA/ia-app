import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend } from "../fakeBackend";
import { run } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-writes-"));
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

describe("flex registrations", () => {
  test("registers for a workshop, lists it, and drops it", async () => {
    const { invoke } = await setup();
    const day = JSON.parse((await invoke(["flex", "workshops", "list", "flex1", "--json"])).stdout);
    expect(day.sessions[0].workshops[0]).toMatchObject({
      id: "ws1",
      title: "Robot Drivetrain",
      registered: false,
    });

    const added = JSON.parse((await invoke(["flex", "registrations", "add", "ws1", "--json"])).stdout);
    expect(added).toEqual({ outcome: "registered", workshop: "ws1" });

    const listed = JSON.parse((await invoke(["flex", "registrations", "list", "--json"])).stdout);
    expect(listed.registrations).toEqual([
      expect.objectContaining({
        workshopId: "ws1",
        workshop: "Robot Drivetrain",
        time: "13:00–13:45",
        location: "Room 214",
      }),
    ]);

    const again = await invoke(["flex", "registrations", "add", "ws1", "--json"]);
    expect(again.code).toBe(1);
    expect(JSON.parse(again.stderr)).toMatchObject({ reason: "already_registered" });

    expect((await invoke(["flex", "registrations", "remove", "ws1", "--json"])).code).toBe(0);
    const none = await invoke(["flex", "registrations", "remove", "ws1", "--json"]);
    expect(none.code).toBe(1);
    expect(JSON.parse(none.stderr)).toMatchObject({ reason: "registration_not_found" });
  });
});

describe("clubs messages", () => {
  test("sends a message that then appears in the channel", async () => {
    const { invoke } = await setup();
    const sent = JSON.parse(
      (await invoke(["clubs", "messages", "send", "chan1", "Build", "night", "moved.", "--json"])).stdout,
    );
    expect(sent.outcome).toBe("sent");

    const list = JSON.parse((await invoke(["clubs", "messages", "list", "chan1", "--json"])).stdout);
    expect(list.messages[0]).toMatchObject({
      id: sent.message.id,
      author: "David Jones",
      body: "Build night moved.",
    });
  });
});

describe("notifications read", () => {
  test("marks an unread notification read", async () => {
    const { invoke } = await setup();
    const before = JSON.parse((await invoke(["notifications", "list", "--unread", "--json"])).stdout);
    expect(before.notifications.map((item: { id: string }) => item.id)).toEqual(["notif1"]);

    const read = JSON.parse((await invoke(["notifications", "read", "notif1", "--json"])).stdout);
    expect(read).toMatchObject({ markedRead: true, notification: { id: "notif1" } });

    const after = JSON.parse((await invoke(["notifications", "list", "--unread", "--json"])).stdout);
    expect(after.notifications).toEqual([]);
  });
});
