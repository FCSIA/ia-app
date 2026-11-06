import { afterEach, describe, expect, it, vi } from "vitest";
import { readRouteList, SAVED_ROUTES_KEY } from "./saved-routes";

afterEach(() => vi.unstubAllGlobals());

describe("stored route recovery", () => {
  it("keeps valid routes while discarding rooms missing from the current plans", () => {
    const valid = { fromFloor: 1, fromKey: "116", toFloor: 3, toKey: "301" };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify([
          valid,
          { ...valid, fromKey: "999" },
          { ...valid, toFloor: 1 },
          { ...valid, fromFloor: 4 },
          null,
        ]),
      },
    });
    expect(readRouteList(SAVED_ROUTES_KEY)).toEqual([valid]);
  });

  it("recovers when browser storage is blocked or malformed", () => {
    const getItem = vi.fn(() => "invalid json");
    vi.stubGlobal("window", { localStorage: { getItem } });
    expect(readRouteList(SAVED_ROUTES_KEY)).toEqual([]);
    getItem.mockImplementation(() => { throw new Error("Storage blocked"); });
    expect(readRouteList(SAVED_ROUTES_KEY)).toEqual([]);
  });
});
