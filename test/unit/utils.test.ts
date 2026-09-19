import { describe, expect, it } from "vitest";
import { cn, lc } from "@/lib/utils";
import { COERCION_TRAPS, upstashDeserialize } from "../helpers/upstash";

describe("lc()", () => {
  it("lowercases plain strings", () => {
    expect(lc("Cabinet 3")).toBe("cabinet 3");
    expect(lc("HC-SR04")).toBe("hc-sr04");
  });

  it("returns empty string for null and undefined", () => {
    expect(lc(null)).toBe("");
    expect(lc(undefined)).toBe("");
  });

  // The exact bug: Upstash hands back a number, `?? ""` does not catch it,
  // and `.toLowerCase()` throws.
  it("survives values Upstash coerced out of strings", () => {
    expect(lc(COERCION_TRAPS.numericStringResult)).toBe("101");
    expect(lc(COERCION_TRAPS.booleanStringResult)).toBe("true");
    expect(lc(COERCION_TRAPS.floatStringResult)).toBe("2.5");
  });

  it("does not throw on any type a Redis hash read can produce", () => {
    const values: unknown[] = [0, 1, -1, 2.5, true, false, null, undefined, "", "x", [], {}];
    for (const v of values) {
      expect(() => lc(v)).not.toThrow();
      expect(typeof lc(v)).toBe("string");
    }
  });

  it("empty string stays empty so `!q` short-circuits still work", () => {
    expect(lc("")).toBe("");
  });
});

describe("the coercion the helper exists to defend against", () => {
  it("documents that Upstash turns numeric strings into numbers", () => {
    expect(upstashDeserialize(COERCION_TRAPS.numericString)).toBe(101);
    expect(typeof upstashDeserialize(COERCION_TRAPS.numericString)).toBe("number");
  });

  it("documents that Upstash turns 'true' into a boolean", () => {
    expect(upstashDeserialize(COERCION_TRAPS.booleanString)).toBe(true);
    expect(typeof upstashDeserialize(COERCION_TRAPS.booleanString)).toBe("boolean");
  });

  it("documents that ordinary text survives as a string", () => {
    expect(upstashDeserialize(COERCION_TRAPS.safeString)).toBe(COERCION_TRAPS.safeString);
  });

  it("proves the OLD pattern throws on a coerced value", () => {
    const location = upstashDeserialize("101") as string;
    // This is verbatim what ComponentsClient.tsx shipped and what broke prod.
    expect(() => (location ?? "").toLowerCase()).toThrow(TypeError);
  });
});

describe("cn()", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});
