import { describe, expect, test } from "vitest";
import {
  CLI_CLIENT_ID,
  cliDeviceVerificationUri,
  isCliClient,
  requestsPreboundUser,
} from "./cliDeviceAuthorization";
import { describeCliClient } from "../users/cliSessions";

describe("CLI device authorization", () => {
  test("accepts only the command-line client", () => {
    expect(isCliClient(CLI_CLIENT_ID)).toBe(true);
    expect(isCliClient("")).toBe(false);
    expect(isCliClient("fcsia-cli ")).toBe(false);
    expect(isCliClient("some-other-app")).toBe(false);
  });

  test("sends people to the web approval page on the site origin", () => {
    expect(cliDeviceVerificationUri("https://app.fcsia.com")).toBe(
      "https://app.fcsia.com/device",
    );
    expect(cliDeviceVerificationUri("http://localhost:3000/ignored/path")).toBe(
      "http://localhost:3000/device",
    );
  });

  test("refuses device codes pre-bound to a user", () => {
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID, user_id: "user_1" })).toBe(true);
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID, user_id: "" })).toBe(true);
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID })).toBe(false);
    expect(requestsPreboundUser(null)).toBe(false);
    expect(requestsPreboundUser("user_id")).toBe(false);
  });
});

describe("CLI session descriptions", () => {
  test("names the version and platform the CLI reports", () => {
    expect(describeCliClient("fcsia/0.1.0 (darwin; arm64)")).toEqual({
      version: "0.1.0",
      platform: "macOS arm64",
      label: "Command-line client 0.1.0 on macOS",
    });
    expect(describeCliClient("fcsia/1.2.0-beta.1 (linux; x64) bun/1.3").platform).toBe("Linux x64");
  });

  test("never echoes an unrecognized user agent", () => {
    for (const agent of [undefined, null, "", "curl/8.0", "fcsia/<script> (darwin; arm64)"]) {
      expect(describeCliClient(agent)).toEqual({
        version: null,
        platform: null,
        label: "Command-line client",
      });
    }
  });
});

