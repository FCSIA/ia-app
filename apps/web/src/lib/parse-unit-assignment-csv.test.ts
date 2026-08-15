import { describe, expect, it } from "vitest";
import { parseUnitAssignmentCsv } from "./parse-unit-assignment-csv";

describe("parseUnitAssignmentCsv", () => {
  it("reads quoted names and unit values", () => {
    expect(
      parseUnitAssignmentCsv(
        'name,unit\n"Janavarthanan, Harshita",Token Invalid 4\nEniola Famakinwa,IT\n',
      ),
    ).toEqual([
      {
        line: 2,
        name: "Janavarthanan, Harshita",
        unit: "Token Invalid 4",
      },
      { line: 3, name: "Eniola Famakinwa", unit: "IT" },
    ]);
  });

  it("requires name and unit headers", () => {
    expect(() => parseUnitAssignmentCsv("student,house\nA,B")).toThrow(
      "CSV needs `name` and `unit` columns",
    );
  });
});
