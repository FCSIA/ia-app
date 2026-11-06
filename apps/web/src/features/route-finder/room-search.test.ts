import { describe, expect, test } from "vitest";
import { ALL_ROOMS, searchRooms } from "./room-search";

const top = (query: string) => {
  const [first] = searchRooms(query);
  return first ? `${first.room}@${first.floor}` : null;
};

describe("searchRooms", () => {
  test("an empty query lists every room on every floor", () => {
    expect(searchRooms("")).toHaveLength(ALL_ROOMS.length);
    expect(new Set(ALL_ROOMS.map((r) => r.floor))).toEqual(new Set([1, 2, 3]));
  });

  test("room numbers match however they are written", () => {
    for (const query of ["331", "room 331", "Room 331", "ROOM331", "rm 331", "Rm. 331", " 331 "]) {
      expect(top(query), query).toBe("331@3");
    }
  });

  test("a partial number lists the rooms it starts", () => {
    const rooms = searchRooms("33").map((r) => r.room);
    expect(rooms.slice(0, 4)).toEqual(["331", "332", "333", "334"]);
  });

  test("a number is never treated as a typo of another number", () => {
    expect(searchRooms("313")).toEqual([]);
  });

  test("either half of a shared-door pair finds the pair", () => {
    expect(top("392")).toBe("392/394@3");
    expect(top("room 394")).toBe("392/394@3");
  });

  test("names ignore case and tolerate typos", () => {
    expect(top("gym")).toBe("GYM@1");
    expect(top("GYM")).toBe("GYM@1");
    expect(top("audotorium")).toBe("Auditorium@1");
    expect(top("auditorim")).toBe("Auditorium@1");
    expect(top("recepton")).toBe("Reception@1");
    expect(top("libary")).toBe("Xchange/Library@2");
    expect(top("mision control")).toBe("Mission Control@1");
    expect(top("biotech")).toBe("BioTech Lab@2");
    expect(top("hangar est")).toBe("Hangar East@1");
  });

  test("a name being typed matches before it is finished", () => {
    expect(top("audi")).toBe("Auditorium@1");
    expect(top("clin")).toBe("Clinic@1");
  });

  test("a floor in the query narrows the list to that floor", () => {
    expect(searchRooms("floor 2").every((r) => r.floor === 2)).toBe(true);
    expect(top("library floor 3")).toBe("Xchange/Library@3");
    expect(top("3rd floor library")).toBe("Xchange/Library@3");
  });

  test("nonsense finds nothing", () => {
    expect(searchRooms("zzzz")).toEqual([]);
  });
});

describe("searchRooms nicknames and heavier typos", () => {
  test("everyday names find the room students mean", () => {
    expect(top("nurse")).toBe("Clinic@1");
    expect(top("front office")).toBe("Reception@1");
    expect(top("theater")).toBe("Auditorium@1");
    expect(top("libery")).toBe("Xchange/Library@2");
  });
});
