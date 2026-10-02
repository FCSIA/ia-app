import { describe, expect, it } from "vitest";
import { filterBySearchQuery } from "./search";
import { peopleSearchValues } from "./club-directory-search";

const person = {
  firstName: "Rohit",
  lastName: "Senthilkumar",
  uniqueId: "STU123",
  kind: "MEMBER",
  clubRole: "LEADER",
  customRoleName: "House Lead",
  roleName: "House Lead",
  unitNames: ["Curie", "DT4/Curie-4"],
} as Parameters<typeof peopleSearchValues>[0];

describe("peopleSearchValues", () => {
  it("includes unit names and role types in People search", () => {
    expect(filterBySearchQuery([person], "curie", peopleSearchValues)).toEqual([
      person,
    ]);
    expect(
      filterBySearchQuery([person], "house lead", peopleSearchValues),
    ).toEqual([person]);
    expect(filterBySearchQuery([person], "leader", peopleSearchValues)).toEqual([
      person,
    ]);
  });
});
