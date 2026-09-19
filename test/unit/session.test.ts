import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, type SessionPayload } from "@/lib/session";

const payload: SessionPayload = {
  id: "USR-001",
  name: "Test User",
  userId: "tester",
  year: "TY",
  isAdmin: true,
};

describe("JWT round-trip", () => {
  it("signs and verifies a session payload", async () => {
    const token = await encryptToken(payload);
    const decoded = await decryptToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it("produces a three-part compact JWS", async () => {
    const token = await encryptToken(payload);
    expect(token.split(".")).toHaveLength(3);
  });

  it("preserves the isAdmin boolean rather than stringifying it", async () => {
    const decoded = await decryptToken(await encryptToken(payload));
    expect(decoded?.isAdmin).toBe(true);
    expect(typeof decoded?.isAdmin).toBe("boolean");
  });
});

describe("decryptToken rejects anything it should not trust", () => {
  it("returns null for undefined and empty input", async () => {
    expect(await decryptToken(undefined)).toBeNull();
    expect(await decryptToken("")).toBeNull();
  });

  it("returns null for a malformed token instead of throwing", async () => {
    expect(await decryptToken("not-a-jwt")).toBeNull();
    expect(await decryptToken("a.b.c")).toBeNull();
    expect(await decryptToken("...")).toBeNull();
  });

  it("returns null when the payload was tampered with", async () => {
    const token = await encryptToken({ ...payload, isAdmin: false });
    const [header, body, sig] = token.split(".");
    // Flip isAdmin to true in the payload and keep the original signature.
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.isAdmin = true;
    const tamperedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(await decryptToken(`${header}.${tamperedBody}.${sig}`)).toBeNull();
  });

  it("returns null when signed with a different secret", async () => {
    const original = process.env.SESSION_SECRET;
    const token = await encryptToken(payload);
    process.env.SESSION_SECRET = "a-completely-different-secret-value-xyz";
    try {
      expect(await decryptToken(token)).toBeNull();
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });

  it("returns null rather than throwing when SESSION_SECRET is missing", async () => {
    const original = process.env.SESSION_SECRET;
    const token = await encryptToken(payload);
    delete process.env.SESSION_SECRET;
    try {
      // getKey() throws inside the try block, so this must surface as null.
      await expect(decryptToken(token)).resolves.toBeNull();
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });
});

describe("token claims", () => {
  it("sets an expiry 7 days out", async () => {
    const token = await encryptToken(payload);
    const body = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const sevenDays = 7 * 24 * 60 * 60;
    expect(body.exp - body.iat).toBe(sevenDays);
  });

  it("uses HS256", async () => {
    const token = await encryptToken(payload);
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(header.alg).toBe("HS256");
  });

  it("rejects an expired token", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);
    const expired = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect(await decryptToken(expired)).toBeNull();
  });
});
