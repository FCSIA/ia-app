import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend } from "../fakeBackend";
import { run } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-clubs-"));
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

describe("clubs", () => {
  test("lists your clubs with your role and unread channels", async () => {
    const { invoke } = await setup();
    const { clubs } = JSON.parse((await invoke(["clubs", "list", "--json"])).stdout);
    expect(clubs).toEqual([
      expect.objectContaining({
        id: "club1",
        name: "Robotics Club",
        role: "President",
        members: 12,
        channels: 2,
        unreadChannels: 1,
      }),
    ]);
  });

  test("names a club's leaders and sponsors from their user records", async () => {
    const { invoke } = await setup();
    const { club } = JSON.parse((await invoke(["clubs", "inspect", "club1", "--json"])).stdout);
    expect(club).toMatchObject({
      id: "club1",
      leaders: ["Ada Byron"],
      sponsors: ["Grace Hopper"],
      tags: ["robotics"],
      viewer: { isMember: true },
    });

    const missing = await invoke(["clubs", "inspect", "nope", "--json"]);
    expect(JSON.parse(missing.stderr)).toMatchObject({ reason: "club_not_found" });
  });

  test("lists a club's channels", async () => {
    const { invoke } = await setup();
    const { channels } = JSON.parse((await invoke(["clubs", "channels", "list", "club1", "--json"])).stdout);
    expect(channels).toEqual([
      expect.objectContaining({ id: "chan1", name: "builds", visibility: "PUBLIC" }),
      expect.objectContaining({ id: "chan2", name: "leaders", visibility: "RESTRICTED" }),
    ]);
  });

  test("reads a channel's messages and refuses one you can't read", async () => {
    const { invoke } = await setup();
    const page = JSON.parse((await invoke(["clubs", "messages", "list", "chan1", "--json"])).stdout);
    expect(page.channel).toEqual({
      id: "chan1",
      name: "builds",
      club: { id: "club1", name: "Robotics Club" },
    });
    expect(page.messages[0]).toMatchObject({
      id: "msg1",
      author: "Ada Byron",
      body: "Drivetrain is mounted.",
      replies: 1,
      reactions: 2,
    });
    expect(page.isDone).toBe(true);

    const restricted = await invoke(["clubs", "messages", "list", "chan2", "--json"]);
    expect(restricted.code).toBe(1);
    expect(JSON.parse(restricted.stderr)).toMatchObject({ reason: "channel_not_found" });
  });
});
