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
        role: "",
      },
      { line: 3, name: "Eniola Famakinwa", unit: "IT", role: "" },
    ]);
  });

  it("reads an optional role column", () => {
    expect(parseUnitAssignmentCsv("name,unit,role\nA Student,Room 1,Room Lead 1"))
      .toEqual([{ line: 2, name: "A Student", unit: "Room 1", role: "Room Lead 1" }]);
  });

  it("requires name and unit headers", () => {
    expect(() => parseUnitAssignmentCsv("student,house\nA,B")).toThrow(
      "CSV needs `name` and `unit` columns",
    );
  });
});
