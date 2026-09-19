import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedis } from "../helpers/redis-mock";
import { keys } from "@/lib/redis";
import type { SessionPayload } from "@/lib/session";

let currentSession: SessionPayload | null = null;

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("../helpers/redis-mock");
  return {
    redis: mockRedis,
    keys: (await vi.importActual<typeof import("@/lib/redis")>("@/lib/redis")).keys,
  };
});

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return { ...actual, getSession: async () => currentSession };
});

const { POST } = await import("@/app/api/invoices/commit/route");

const session = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  id: "USR-001", name: "Rohan", userId: "rohan", year: "TY", isAdmin: false, ...over,
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/invoices/commit", {
      method: "POST",
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof POST>[0]
  );

const today = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  mockRedis.reset();
  currentSession = session();
  mockRedis.seedSet("categories:all", []);
});

describe("POST /api/invoices/commit — authorisation", () => {
  it("rejects an unauthenticated request with 401", async () => {
    currentSession = null;
    const res = await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it("rejects a read-only SY member with 403", async () => {
    currentSession = session({ year: "SY" });
    const res = await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it("writes nothing to Redis when authorisation fails", async () => {
    currentSession = session({ year: "SY" });
    await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    expect(mockRedis.calls).toHaveLength(0);
  });

  it("allows TY and LY", async () => {
    for (const year of ["TY", "LY"] as const) {
      mockRedis.reset();
      mockRedis.seedSet("categories:all", []);
      currentSession = session({ year });
      const res = await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
      expect(res.status).toBe(200);
    }
  });
});

describe("POST /api/invoices/commit — input validation", () => {
  it("rejects a missing company name", async () => {
    const res = await post({ items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only company name", async () => {
    const res = await post({ companyName: "   ", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("rejects an empty items list", async () => {
    const res = await post({ companyName: "Robu", items: [] });
    expect(res.status).toBe(400);
  });

  it("rejects items that are all blank names", async () => {
    const res = await post({ companyName: "Robu", items: [{ name: "  ", category: "SENS", quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON without crashing", async () => {
    const res = await POST(
      new Request("http://localhost/api/invoices/commit", { method: "POST", body: "not json" }) as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/invoices/commit — creating the box", () => {
  it("names the box '{company}_{today}'", async () => {
    const body = await (await post({
      companyName: "Robu.in",
      items: [{ name: "Sensor", category: "SENS", quantity: 1 }],
    })).json();
    expect(body.boxName).toBe(`Robu.in_${today()}`);
  });

  it("defaults box location to Unknown when not supplied", async () => {
    await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    const boxWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("box:"));
    expect((boxWrite?.args[1] as { location: string }).location).toBe("Unknown");
  });

  it("uses a supplied location", async () => {
    await post({
      companyName: "Robu",
      location: "Cabinet 3",
      items: [{ name: "Sensor", category: "SENS", quantity: 1 }],
    });
    const boxWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("box:"));
    expect((boxWrite?.args[1] as { location: string }).location).toBe("Cabinet 3");
  });

  it("attributes the box to the logged-in user, not client input", async () => {
    currentSession = session({ name: "Priya" });
    await post({ companyName: "Robu", items: [{ name: "Sensor", category: "SENS", quantity: 1 }] });
    const boxWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("box:"));
    expect((boxWrite?.args[1] as { createdBy: string }).createdBy).toBe("Priya");
  });

  it("creates exactly one box even with many items", async () => {
    await post({
      companyName: "Robu",
      items: [
        { name: "Sensor A", category: "SENS", quantity: 1 },
        { name: "Sensor B", category: "SENS", quantity: 2 },
        { name: "Motor", category: "MOTR", quantity: 1 },
      ],
    });
    const boxWrites = mockRedis.calls.filter((c) => c.cmd === "hset" && String(c.args[0]).startsWith("box:"));
    expect(boxWrites).toHaveLength(1);
  });
});

describe("POST /api/invoices/commit — creating components", () => {
  it("creates one component per item, each logged as a CREATED transaction", async () => {
    const body = await (await post({
      companyName: "Robu",
      items: [
        { name: "HC-SR04", category: "SENS", quantity: 5 },
        { name: "SG90 Servo", category: "MOTR", quantity: 2 },
      ],
    })).json();

    expect(body.results.filter((r: { type: string }) => r.type === "component_new")).toHaveLength(2);

    const txWrites = mockRedis.calls.filter((c) => c.cmd === "hset" && String(c.args[0]).startsWith("tx:"));
    expect(txWrites).toHaveLength(2);
    txWrites.forEach((w) => {
      expect((w.args[1] as { type: string }).type).toBe("CREATED");
    });
  });

  it("puts every created component in the new box", async () => {
    await post({
      companyName: "Robu",
      items: [{ name: "HC-SR04", category: "SENS", quantity: 5 }],
    });
    const compWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("component:"));
    const component = compWrite?.args[1] as { boxId: string; boxName: string };
    const boxWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("box:"));
    expect(component.boxId).toBe((boxWrite?.args[1] as { id: string }).id);
    expect(component.boxName).toBe(`Robu_${today()}`);
  });

  it("falls back to MISC for an unrecognized category code", async () => {
    const body = await (await post({
      companyName: "Robu",
      items: [{ name: "Mystery Part", category: "NOPE", quantity: 1 }],
    })).json();
    expect(body.results[1].sub).toMatch(/MISC/);
  });

  it("matches an existing custom category by code", async () => {
    mockRedis.seedSet("categories:all", ["BATT"]);
    mockRedis.seedHash("category:BATT", {
      code: "BATT", label: "Batteries", color: "bg-red-100 text-red-800 border-red-200",
      isDefault: "false", createdAt: "2026-01-01",
    });
    const body = await (await post({
      companyName: "Robu",
      items: [{ name: "18650 Cell", category: "BATT", quantity: 10 }],
    })).json();
    expect(body.results[1].id).toMatch(/^BATT\//);
  });

  it("coerces a non-integer quantity to a positive integer", async () => {
    await post({
      companyName: "Robu",
      items: [{ name: "Wire", category: "CABL", quantity: 2.7 }],
    });
    const compWrite = mockRedis.calls.find((c) => c.cmd === "hset" && String(c.args[0]).startsWith("component:"));
    expect((compWrite?.args[1] as { quantity: number }).quantity).toBe(3);
  });

  it("reports a partial failure without discarding successful items", async () => {
    const originalIncr = mockRedis.incr.bind(mockRedis);
    let txCounterCalls = 0;
    vi.spyOn(mockRedis, "incr").mockImplementation(async (key: string) => {
      if (key === keys.txCounter()) {
        txCounterCalls += 1;
        if (txCounterCalls === 1) throw new Error("boom");
      }
      return originalIncr(key);
    });

    const body = await (await post({
      companyName: "Robu",
      items: [
        { name: "Broken Item", category: "SENS", quantity: 1 },
        { name: "Good Item", category: "SENS", quantity: 1 },
      ],
    })).json();

    expect(body.results[1].type).toBe("error");
    expect(body.results[2].type).toBe("component_new");
    vi.restoreAllMocks();
  });
});
