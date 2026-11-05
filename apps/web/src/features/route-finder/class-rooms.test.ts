import { describe, expect, test } from "vitest";
import { classRouteHref, parseRouteLink, passingPeriod, roomForLocation } from "./class-rooms";

const search = (href: string) => href.slice(href.indexOf("?"));
const room331 = { room: "331", floor: 3 } as const;

describe("roomForLocation", () => {
  test("finds a room named exactly, however it is written", () => {
    for (const location of ["331", "Room 331", "rm. 331", " 331 "]) {
      expect(roomForLocation(location), location).toEqual(room331);
    }
  });

  test("a place that isn't exactly one room, or is on two floors, finds nothing", () => {
    for (const location of [undefined, "", "Off campus", "33", "audotorium", "Xchange/Library"]) {
      expect(roomForLocation(location), String(location)).toBeUndefined();
    }
  });
});

describe("class route links", () => {
  test("a link with no places opens Route Finder empty", () => {
    expect(classRouteHref(undefined, undefined)).toBe("/route-finder");
  });

  test("classes come back with the rooms already picked for them", () => {
    const href = classRouteHref({ title: "Algebra & Stats" }, { title: "Biology" });
    const link = parseRouteLink(search(href), { "Algebra & Stats": room331 });
    expect(link.from).toEqual({ room: room331, className: "Algebra & Stats" });
    expect(link.to).toEqual({ room: null, className: "Biology" });
  });

  test("a workshop in a known room needs no picking", () => {
    const href = classRouteHref({ title: "Biology" }, { title: "Robots", location: "Room 331" });
    const link = parseRouteLink(search(href), {});
    expect(link.to).toEqual({ room: room331, className: null });
    expect(link.from).toEqual({ room: null, className: "Biology" });
  });

  test("a made-up room in the address is ignored", () => {
    const link = parseRouteLink("?to=999&toFloor=3&from=331&fromFloor=9", {});
    expect(link.to.room).toBeNull();
    expect(link.from.room).toBeNull();
  });

  test("a class name can't reach object built-ins", () => {
    expect(parseRouteLink("?toClass=constructor", {}).to.room).toBeNull();
  });
});

describe("passingPeriod", () => {
  const algebra = { start: 540, end: 590 };
  const biology = { start: 595, end: 645 };
  const day = [algebra, biology];

  test("starts the minute a class ends and stops the minute the next begins", () => {
    expect(passingPeriod(day, 589)).toBeNull();
    expect(passingPeriod(day, 590)).toEqual({ from: algebra, to: biology });
    expect(passingPeriod(day, 594)).toEqual({ from: algebra, to: biology });
    expect(passingPeriod(day, 595)).toBeNull();
  });

  test("there is none before the first class or after the last", () => {
    expect(passingPeriod(day, 500)).toBeNull();
    expect(passingPeriod(day, 700)).toBeNull();
    expect(passingPeriod([], 590)).toBeNull();
  });

  test("back-to-back classes have no passing period", () => {
    expect(passingPeriod([algebra, { start: 590, end: 640 }], 590)).toBeNull();
  });
});
