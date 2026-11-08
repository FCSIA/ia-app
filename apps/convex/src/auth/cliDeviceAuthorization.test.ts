import { describe, expect, test } from "vitest";
import {
  CLI_CLIENT_ID,
  cliDeviceVerificationUri,
  isCliClient,
  requestsPreboundUser,
} from "./cliDeviceAuthorization";

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
