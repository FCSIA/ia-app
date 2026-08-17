import { describe, expect, it } from "vitest";
import { parseClubStructureCsv } from "./parse-club-structure-csv";

describe("parseClubStructureCsv", () => {
  it("reads parent and kind columns", () => {
    expect(parseClubStructureCsv("name,parent,kind\nCraftsman,,House\nCraftsman 1,Craftsman,Room"))
      .toEqual([
        { line: 2, name: "Craftsman", parent: "", kind: "House" },
        { line: 3, name: "Craftsman 1", parent: "Craftsman", kind: "Room" },
      ]);
  });

  it("requires name and parent headers", () => {
    expect(() => parseClubStructureCsv("unit,type\nA,House")).toThrow(
      "CSV needs `name` and `parent` columns",
    );
  });
});
