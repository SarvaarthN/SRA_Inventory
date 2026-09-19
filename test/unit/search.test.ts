import { beforeEach, describe, expect, it } from "vitest";
import {
  ALL_CATEGORIES,
  boxHaystack,
  boxMatches,
  componentHaystack,
  componentMatches,
  filterBoxes,
  filterComponents,
  matchesCategory,
} from "@/lib/search";
import { makeBox, makeComponent, resetFixtureCounters } from "../helpers/upstash";

beforeEach(resetFixtureCounters);

/**
 * REGRESSION — 2026-09-19.
 *
 * The /components page crashed the instant anyone typed in the search box.
 * A box location stored as "101" came back from Redis as the number 101, and
 * `(boxLocations[c.boxId] ?? "").toLowerCase()` threw a TypeError. It only
 * fired on a non-empty query because the `||` chain short-circuits.
 *
 * Users read the crash screen as "I got logged out".
 */
describe("regression: coerced box location must not crash search", () => {
  const boxLocations = {
    "BOX-001": 101 as unknown as string, // Upstash returns a number
    "BOX-002": true as unknown as string, // and a boolean for "true"
    "BOX-003": 2.5 as unknown as string,
    "BOX-004": "Cabinet 3, Shelf 2",
  };

  const components = [
    makeComponent({ name: "HC-SR04", boxId: "BOX-001" }),
    makeComponent({ name: "SG90 Servo", boxId: "BOX-002" }),
    makeComponent({ name: "Arduino Uno", boxId: "BOX-003" }),
    makeComponent({ name: "Soldering Iron", boxId: "BOX-004" }),
  ];

  it("does not throw for any single-character query", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
      expect(() => filterComponents(components, ch, boxLocations)).not.toThrow();
    }
  });

  it("does not throw on a query that matches nothing", () => {
    expect(() =>
      filterComponents(components, "zzzzz-no-such-thing", boxLocations)
    ).not.toThrow();
    expect(filterComponents(components, "zzzzz-no-such-thing", boxLocations)).toEqual([]);
  });

  it("does not throw when the location is missing entirely", () => {
    const orphan = makeComponent({ name: "Orphan", boxId: "BOX-999" });
    expect(() => filterComponents([orphan], "s", boxLocations)).not.toThrow();
  });

  it("does not throw when boxId itself was coerced to a number", () => {
    const weird = makeComponent({ name: "Weird", boxId: 7 as unknown as string });
    expect(() => filterComponents([weird], "s", boxLocations)).not.toThrow();
  });

  it("finds a box whose location coerced to a number (was impossible before)", () => {
    const found = filterComponents(components, "101", boxLocations);
    expect(found.map((c) => c.name)).toEqual(["HC-SR04"]);
  });

  it("still matches a normal text location", () => {
    const found = filterComponents(components, "cabinet 3", boxLocations);
    expect(found.map((c) => c.name)).toEqual(["Soldering Iron"]);
  });
});

describe("componentMatches", () => {
  const boxLocations = { "BOX-001": "Cabinet 3" };

  it("matches on name, case-insensitively", () => {
    const c = makeComponent({ name: "HC-SR04 Ultrasonic Sensor" });
    expect(componentMatches(c, "ultrasonic")).toBe(true);
    expect(componentMatches(c, "ULTRASONIC")).toBe(true);
    expect(componentMatches(c, "UlTrAsOnIc")).toBe(true);
  });

  it("matches on part number", () => {
    const c = makeComponent({ id: "SENS/2026/007" });
    expect(componentMatches(c, "sens/2026/007")).toBe(true);
    expect(componentMatches(c, "2026/007")).toBe(true);
  });

  it("matches on description, box name, category code and category label", () => {
    const c = makeComponent({
      name: "Thing",
      description: "measures distance",
      boxName: "Workbench",
      category: "SENS",
      categoryLabel: "Sensors",
    });
    expect(componentMatches(c, "distance")).toBe(true);
    expect(componentMatches(c, "workbench")).toBe(true);
    expect(componentMatches(c, "sens")).toBe(true);
    expect(componentMatches(c, "sensors")).toBe(true);
  });

  it("matches on box location looked up via boxId", () => {
    const c = makeComponent({ boxId: "BOX-001" });
    expect(componentMatches(c, "cabinet 3", boxLocations)).toBe(true);
  });

  it("returns true for an empty or whitespace query", () => {
    const c = makeComponent();
    expect(componentMatches(c, "")).toBe(true);
    expect(componentMatches(c, "   ")).toBe(true);
  });

  it("trims the query", () => {
    const c = makeComponent({ name: "Servo" });
    expect(componentMatches(c, "  servo  ")).toBe(true);
  });

  it("does not let a match straddle two fields", () => {
    // name ends "AB", id starts "CD" — "ABCD" must not match.
    const c = makeComponent({ name: "widget AB", id: "CD/2026/001" });
    expect(componentMatches(c, "abcd")).toBe(false);
  });

  it("handles a component with empty optional fields", () => {
    const c = makeComponent({ description: "", boxName: "", boxId: "" });
    expect(() => componentMatches(c, "anything")).not.toThrow();
    expect(componentMatches(c, "anything")).toBe(false);
  });
});

describe("boxMatches", () => {
  it("matches on name, id and location", () => {
    const b = makeBox({ id: "BOX-007", name: "Workbench", location: "Room 101" });
    expect(boxMatches(b, "workbench")).toBe(true);
    expect(boxMatches(b, "box-007")).toBe(true);
    expect(boxMatches(b, "room 101")).toBe(true);
  });

  it("does not throw when the location coerced to a number", () => {
    const b = makeBox({ location: "101" });
    expect(b.location).toBe(101); // fixture proves the coercion happened
    expect(() => boxMatches(b, "x")).not.toThrow();
    expect(boxMatches(b, "101")).toBe(true);
  });

  it("does not throw when the name coerced to a number", () => {
    // A box literally named "2020" (2020 extrusion) — very plausible here.
    const b = makeBox({ name: "2020" });
    expect(b.name).toBe(2020);
    expect(() => boxMatches(b, "20")).not.toThrow();
    expect(boxMatches(b, "2020")).toBe(true);
  });

  it("returns true for an empty query", () => {
    expect(boxMatches(makeBox(), "")).toBe(true);
  });
});

describe("filterComponents / filterBoxes", () => {
  it("returns the original list unfiltered for an empty query", () => {
    const components = [makeComponent(), makeComponent()];
    expect(filterComponents(components, "")).toHaveLength(2);
    const boxes = [makeBox(), makeBox()];
    expect(filterBoxes(boxes, "   ")).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterComponents([makeComponent()], "nope")).toEqual([]);
    expect(filterBoxes([makeBox()], "nope")).toEqual([]);
  });

  it("preserves input order", () => {
    const a = makeComponent({ name: "alpha sensor" });
    const b = makeComponent({ name: "beta sensor" });
    const c = makeComponent({ name: "gamma sensor" });
    expect(filterComponents([c, a, b], "sensor").map((x) => x.name)).toEqual([
      "gamma sensor",
      "alpha sensor",
      "beta sensor",
    ]);
  });

  it("handles an empty input list", () => {
    expect(filterComponents([], "anything")).toEqual([]);
    expect(filterBoxes([], "anything")).toEqual([]);
  });
});

describe("matchesCategory", () => {
  it("ALL matches every component", () => {
    expect(matchesCategory(makeComponent({ category: "SENS" }), ALL_CATEGORIES)).toBe(true);
    expect(matchesCategory(makeComponent({ category: "TOOL" }), ALL_CATEGORIES)).toBe(true);
  });

  it("matches an exact category code", () => {
    const c = makeComponent({ category: "SENS" });
    expect(matchesCategory(c, "SENS")).toBe(true);
    expect(matchesCategory(c, "TOOL")).toBe(false);
  });

  it("does not throw if a category code coerced to a number", () => {
    const c = makeComponent({ category: "2020" });
    expect(() => matchesCategory(c, "2020")).not.toThrow();
    expect(matchesCategory(c, "2020")).toBe(true);
  });
});

describe("haystacks", () => {
  it("are always strings even when every field is coerced", () => {
    const c = makeComponent({
      name: "101",
      id: "2026",
      description: "true",
      boxName: "2.5",
      category: "404",
    });
    expect(typeof componentHaystack(c, { "BOX-001": 7 as unknown as string })).toBe("string");
    expect(typeof boxHaystack(makeBox({ name: "1", location: "2" }))).toBe("string");
  });
});
