import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend } from "../fakeBackend";
import { run, type FakeRuntimeOptions } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-staff-"));
});

afterEach(() => rmSync(config, { recursive: true, force: true }));

async function setup() {
  const backend = fakeBackend();
  const secrets = new Map<string, string>();
  const invoke = (argv: string[], options: FakeRuntimeOptions = {}) =>
    run(argv, { fetch: backend.handle, secrets, env: { FCSIA_CONFIG_DIR: config }, ...options });
  const login = await invoke(["login"]);
  expect(login.code).toBe(0);
  return { backend, invoke };
}

describe("users", () => {
  test("finds a person by student ID and filters groups", async () => {
    const { invoke } = await setup();
    const person = JSON.parse((await invoke(["users", "inspect", "STU011", "--json"])).stdout);
    expect(person.user).toMatchObject({
      id: "user2",
      uniqueId: "STU011",
      name: "Ada Byron",
      major: "Information Technology",
    });

    const students = JSON.parse((await invoke(["users", "list", "--group", "students", "--json"])).stdout);
    expect(students.users.map((user: { uniqueId: string }) => user.uniqueId)).toEqual([
      "STU050",
      "STU011",
      "STU002",
    ]);
  });

  test("asks before deactivating and accepts --yes for scripts", async () => {
    const { invoke } = await setup();
    const refused = await invoke(["users", "deactivate", "STU002", "--json"]);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stderr)).toMatchObject({ reason: "confirmation_required" });

    const confirmed = await invoke(["users", "deactivate", "STU002"], {
      stdinTTY: true,
      stderrTTY: true,
      confirm: () => false,
    });
    expect(confirmed.code).toBe(130);
    expect(confirmed.asked).toHaveLength(1);
    expect(confirmed.stderr).toContain("Left it unchanged.");

    const deactivated = JSON.parse(
      (await invoke(["users", "deactivate", "STU002", "--yes", "--json"])).stdout,
    );
    expect(deactivated).toMatchObject({ outcome: "deactivated", user: { isActive: false } });
  });

  test("imports a roster from standard input and prints temporary passwords", async () => {
    const { invoke } = await setup();
    const csv = [
      "student_id,first_name,last_name,email,grade_level,major,minor",
      "STU100,New,Student,new@example.com,9,engineering,",
      "STU011,Ada,Byron,ada@example.com,12,it,",
    ].join("\n");
    const result = JSON.parse(
      (await invoke(["users", "import", "-", "--yes", "--json"], { stdin: csv })).stdout,
    );
    expect(result).toMatchObject({ outcome: "imported", created: 1, skipped: 1 });
    expect(result.generatedCredentials[0]).toMatchObject({ uniqueId: "STU100" });
    expect(result.generatedCredentials[0].temporaryPassword).toBeTruthy();

    const bad = await invoke(["users", "import", "-", "--dry-run", "--json"], {
      stdin: "student_id,first_name,last_name\nSTU200,Onlyfirst,",
    });
    expect(bad.code).toBe(2);
    expect(JSON.parse(bad.stderr)).toMatchObject({ reason: "invalid_csv" });
  });
});

describe("announcements", () => {
  test("maps grade and pathway options to an intersection audience", async () => {
    const { backend, invoke } = await setup();
    const created = JSON.parse(
      (
        await invoke([
          "announcements",
          "create",
          "--title",
          "Picture day",
          "--body",
          "Photos are Thursday.",
          "--grade",
          "10",
          "--major",
          "engineering",
          "--json",
        ])
      ).stdout,
    );
    expect(created).toMatchObject({ outcome: "created", announcement: { targetType: "INTERSECTION" } });

    const call = backend.invocations.find((entry) => entry.path === "announcements/feed:create");
    expect(call?.args[0]).toMatchObject({
      targetType: "INTERSECTION",
      targetGrades: [10],
      targetMajorPathways: ["ENGINEERING"],
    });
  });
});

describe("audit", () => {
  test("filters the log by action and day", async () => {
    const { invoke } = await setup();
    const events = JSON.parse((await invoke(["audit", "list", "--action", "user.deactivated", "--json"])).stdout);
    expect(events.events.map((event: { id: string }) => event.id)).toEqual(["audit1"]);

    const recent = JSON.parse((await invoke(["audit", "list", "--since", "2026-11-10", "--json"])).stdout);
    expect(recent.events.map((event: { id: string }) => event.id)).toEqual(["audit1"]);
  });
});

describe("feedback and reports", () => {
  test("replies to feedback", async () => {
    const { invoke } = await setup();
    const replied = JSON.parse(
      (await invoke(["feedback", "respond", "fb1", "Thanks,", "we", "are", "on", "it.", "--json"])).stdout,
    );
    expect(replied).toMatchObject({ outcome: "responded", response: { feedback: "fb1" } });

    const inspected = JSON.parse((await invoke(["feedback", "inspect", "fb1", "--json"])).stdout);
    expect(inspected.feedback.responses[0]).toMatchObject({ body: "Thanks, we are on it." });
  });

  test("resolves a report with the status the reviewer saw", async () => {
    const { backend, invoke } = await setup();
    const updated = JSON.parse(
      (await invoke(["reports", "update", "report1", "--status", "RESOLVED", "--note", "Handled", "--json"])).stdout,
    );
    expect(updated).toMatchObject({ outcome: "updated", report: { id: "report1", status: "RESOLVED" } });

    const call = backend.invocations.find((entry) => entry.path === "moderation/reports:update");
    expect(call?.args[0]).toMatchObject({ expectedStatus: "PENDING", reviewNote: "Handled" });

    const listed = JSON.parse((await invoke(["reports", "list", "--status", "PENDING", "--json"])).stdout);
    expect(listed.reports).toEqual([]);
  });
});
