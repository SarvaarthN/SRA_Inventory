import type { Box, Component, Transaction, User } from "@/lib/types";

/**
 * Reproduces Upstash's read behaviour.
 *
 * `@upstash/redis` runs JSON.parse over every hash value it reads back; only
 * values that fail to parse stay strings. So a field written as the string
 * "101" is handed back as the NUMBER 101, and "true" as the BOOLEAN true —
 * while `lib/types.ts` still types both as `string`.
 *
 * That mismatch has caused three production bugs (admin login, box-search
 * crash, components-page crash). Fixtures below deliberately go through this
 * function so tests see the same lying values production does.
 */
export function upstashDeserialize(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Round-trip a record through Redis exactly as Upstash would. */
export function throughRedis<T extends Record<string, unknown>>(written: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(written)) {
    out[key] = typeof value === "string" ? upstashDeserialize(value) : value;
  }
  return out as T;
}

/**
 * Values that survive a JSON.parse round-trip unchanged vs. ones that don't.
 * Any field a user can type is a candidate for the second list.
 */
export const COERCION_TRAPS = {
  /** Written as a string, read back as a number. */
  numericString: "101",
  numericStringResult: 101,
  /** Written as a string, read back as a boolean. */
  booleanString: "true",
  booleanStringResult: true,
  /** Written as a string, read back as a float. */
  floatString: "2.5",
  floatStringResult: 2.5,
  /** Survives as a string. */
  safeString: "Cabinet 3, Shelf 2",
} as const;

let boxSeq = 0;
let componentSeq = 0;

/**
 * Build a Box as it comes back OUT of Redis.
 * Pass `location: "101"` to get a box whose location is the number 101.
 */
export function makeBox(overrides: Partial<Record<keyof Box, string>> = {}): Box {
  boxSeq += 1;
  return throughRedis({
    id: `BOX-${String(boxSeq).padStart(3, "0")}`,
    name: `Box ${boxSeq}`,
    location: "Cabinet 1, Shelf 1",
    createdBy: "Tester",
    createdAt: "2026-01-01T00:00:00.000Z",
    boxType: "GENERAL",
    ...overrides,
  }) as unknown as Box;
}

/** Build a Component as it comes back OUT of Redis. */
export function makeComponent(
  overrides: Partial<Record<keyof Component, string | number>> = {}
): Component {
  componentSeq += 1;
  return throughRedis({
    id: `SENS/2026/${String(componentSeq).padStart(3, "0")}`,
    name: `Component ${componentSeq}`,
    category: "SENS",
    categoryLabel: "Sensors",
    categoryColor: "bg-blue-100 text-blue-800 border-blue-200",
    year: 2026,
    uniqueNum: componentSeq,
    quantity: 5,
    description: "",
    boxId: "BOX-001",
    boxName: "Box 1",
    addedBy: "Tester",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as unknown as Component;
}

export function makeUser(
  overrides: Partial<Record<keyof User, string>> = {}
): User {
  return throughRedis({
    internalId: "USR-001",
    name: "Test User",
    userId: "tester",
    passwordHash: "$2a$10$notarealhash",
    year: "TY",
    isAdmin: "false",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as unknown as User;
}

export function makeTransaction(
  overrides: Partial<Record<keyof Transaction, string | number>> = {}
): Transaction {
  return throughRedis({
    id: "TX-1",
    componentId: "SENS/2026/001",
    componentName: "Component 1",
    type: "STOCK_IN",
    quantityChange: 1,
    quantityAfter: 6,
    performedBy: "Tester",
    notes: "",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as unknown as Transaction;
}

export function resetFixtureCounters() {
  boxSeq = 0;
  componentSeq = 0;
}
