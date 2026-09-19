import { describe, expect, it } from "vitest";
import { canWrite, hasAnyAdmin, isAdminSession, isAdminUser } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";
import { makeUser } from "../helpers/upstash";

const session = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  id: "USR-001",
  name: "Test",
  userId: "tester",
  year: "TY",
  isAdmin: false,
  ...over,
});

describe("canWrite", () => {
  it("allows TY and LY", () => {
    expect(canWrite(session({ year: "TY" }))).toBe(true);
    expect(canWrite(session({ year: "LY" }))).toBe(true);
  });

  it("denies SY — read-only members must not mutate inventory", () => {
    expect(canWrite(session({ year: "SY" }))).toBe(false);
  });

  it("denies a missing session", () => {
    expect(canWrite(null)).toBe(false);
    expect(canWrite(undefined)).toBe(false);
  });

  it("denies an unknown or malformed year rather than failing open", () => {
    expect(canWrite(session({ year: "XX" as SessionPayload["year"] }))).toBe(false);
    expect(canWrite(session({ year: "" as SessionPayload["year"] }))).toBe(false);
    expect(canWrite(session({ year: undefined as unknown as SessionPayload["year"] }))).toBe(false);
    expect(canWrite(session({ year: null as unknown as SessionPayload["year"] }))).toBe(false);
  });

  it("is case-sensitive — lowercase must not grant write access", () => {
    expect(canWrite(session({ year: "ty" as SessionPayload["year"] }))).toBe(false);
  });
});

/**
 * REGRESSION — admin was demoted to a normal user after logout/login because
 * Upstash returned the boolean true for a field written as the string "true".
 */
describe("isAdminUser", () => {
  it("accepts the string 'true' as written", () => {
    expect(isAdminUser({ isAdmin: "true" })).toBe(true);
  });

  it("accepts the BOOLEAN true Upstash hands back", () => {
    expect(isAdminUser({ isAdmin: true as unknown as string })).toBe(true);
  });

  it("agrees with itself however the fixture round-tripped through Redis", () => {
    const admin = makeUser({ isAdmin: "true" });
    expect(admin.isAdmin).toBe(true); // proves coercion happened
    expect(isAdminUser(admin)).toBe(true);
  });

  it("rejects false in either representation", () => {
    expect(isAdminUser({ isAdmin: "false" })).toBe(false);
    expect(isAdminUser({ isAdmin: false as unknown as string })).toBe(false);
    expect(isAdminUser(makeUser({ isAdmin: "false" }))).toBe(false);
  });

  it("rejects missing, null and empty values", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser({ isAdmin: "" })).toBe(false);
    expect(isAdminUser({ isAdmin: undefined as unknown as string })).toBe(false);
  });

  it("does not treat arbitrary truthy junk as admin", () => {
    expect(isAdminUser({ isAdmin: "yes" })).toBe(false);
    expect(isAdminUser({ isAdmin: "1" })).toBe(false);
    expect(isAdminUser({ isAdmin: 1 as unknown as string })).toBe(false);
    expect(isAdminUser({ isAdmin: "TRUE" })).toBe(false);
  });
});

describe("isAdminSession", () => {
  it("handles the boolean carried in a JWT payload", () => {
    expect(isAdminSession(session({ isAdmin: true }))).toBe(true);
    expect(isAdminSession(session({ isAdmin: false }))).toBe(false);
  });

  it("handles a stringified flag", () => {
    expect(isAdminSession(session({ isAdmin: "true" as unknown as boolean }))).toBe(true);
    expect(isAdminSession(session({ isAdmin: "false" as unknown as boolean }))).toBe(false);
  });

  it("denies a missing session", () => {
    expect(isAdminSession(null)).toBe(false);
  });
});

describe("hasAnyAdmin — drives setup-mode lockout recovery", () => {
  it("is false for an empty list so /setup reopens", () => {
    expect(hasAnyAdmin([])).toBe(false);
  });

  it("is false when every user is a non-admin", () => {
    expect(hasAnyAdmin([makeUser({ isAdmin: "false" }), makeUser({ isAdmin: "false" })])).toBe(false);
  });

  it("is true when at least one admin survives, however coerced", () => {
    expect(hasAnyAdmin([makeUser({ isAdmin: "false" }), makeUser({ isAdmin: "true" })])).toBe(true);
  });

  it("ignores nulls from failed hash reads", () => {
    expect(hasAnyAdmin([null, null])).toBe(false);
    expect(hasAnyAdmin([null, makeUser({ isAdmin: "true" })])).toBe(true);
  });
});
