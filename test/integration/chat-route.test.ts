import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedis } from "../helpers/redis-mock";
import type { SessionPayload } from "@/lib/session";

let currentSession: SessionPayload | null = null;
let geminiReply = "[]";
let geminiShouldThrow = false;

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

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => {
          if (geminiShouldThrow) throw new Error("gemini unavailable");
          return { response: { text: () => geminiReply } };
        },
      };
    }
  },
}));

const { POST } = await import("@/app/api/chat/route");

const post = (message: unknown) =>
  POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }) as unknown as Parameters<typeof POST>[0]
  );

const session = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  id: "USR-001", name: "Rohan", userId: "rohan", year: "TY", isAdmin: false, ...over,
});

beforeEach(() => {
  mockRedis.reset();
  currentSession = session();
  geminiReply = "[]";
  geminiShouldThrow = false;
  mockRedis.seedSet("boxes:all", ["BOX-001"]);
  mockRedis.seedHash("box:BOX-001", {
    id: "BOX-001", name: "Workbench", location: "101",
    createdBy: "T", createdAt: "2026-01-01", boxType: "GENERAL",
  });
  mockRedis.seedSet("components:all", ["SENS/2026/001"]);
  mockRedis.seedHash("component:SENS/2026/001", {
    id: "SENS/2026/001", name: "HC-SR04", category: "SENS", categoryLabel: "Sensors",
    categoryColor: "", year: 2026, uniqueNum: 1, quantity: 10, description: "",
    boxId: "BOX-001", boxName: "Workbench", addedBy: "T",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
  mockRedis.seedSet("categories:all", []);
});

describe("POST /api/chat — authorisation", () => {
  it("rejects an unauthenticated request with 401", async () => {
    currentSession = null;
    const res = await post("10 sensors");
    expect(res.status).toBe(401);
  });

  it("rejects a read-only SY member with 403", async () => {
    currentSession = session({ year: "SY" });
    const res = await post("10 sensors");
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/TY\/LY/);
  });

  it("allows TY and LY", async () => {
    for (const year of ["TY", "LY"] as const) {
      currentSession = session({ year });
      expect((await post("nothing to do")).status).toBe(200);
    }
  });

  it("writes nothing to Redis when authorisation fails", async () => {
    currentSession = session({ year: "SY" });
    await post("create a box called Hacked");
    const writes = mockRedis.calls.filter((c) => ["hset", "sadd", "incr", "zadd"].includes(c.cmd));
    expect(writes).toHaveLength(0);
  });
});

describe("POST /api/chat — input validation", () => {
  it("rejects an empty message", async () => {
    expect((await post("")).status).toBe(400);
  });

  it("rejects a whitespace-only message", async () => {
    expect((await post("   ")).status).toBe(400);
  });
});

describe("POST /api/chat — Gemini failure handling", () => {
  it("returns a friendly error, not a 500, when Gemini throws", async () => {
    geminiShouldThrow = true;
    const res = await post("10 sensors");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].type).toBe("error");
    expect(body.results[0].message).toMatch(/couldn't understand/i);
  });

  it("handles Gemini returning prose instead of JSON", async () => {
    geminiReply = "Sure! I can help you add those sensors.";
    const body = await (await post("10 sensors")).json();
    expect(body.results[0].type).toBe("error");
  });

  it("handles Gemini returning a JSON object instead of an array", async () => {
    geminiReply = '{"action":"add_stock"}';
    const body = await (await post("10 sensors")).json();
    expect(body.results[0].type).toBe("error");
  });

  it("strips markdown code fences Gemini sometimes wraps JSON in", async () => {
    geminiReply = '```json\n[{"action":"add_stock","componentId":"SENS/2026/001","quantity":5}]\n```';
    const body = await (await post("5 more HC-SR04")).json();
    expect(body.results[0].type).toBe("stock");
  });

  it("writes nothing when the response cannot be parsed", async () => {
    geminiReply = "not json at all";
    await post("10 sensors");
    const writes = mockRedis.calls.filter((c) => c.cmd === "hset");
    expect(writes).toHaveLength(0);
  });
});

describe("POST /api/chat — executing actions", () => {
  it("adds stock to an existing component", async () => {
    geminiReply = '[{"action":"add_stock","componentId":"SENS/2026/001","quantity":15}]';
    const body = await (await post("15 more HC-SR04")).json();
    expect(body.results[0].type).toBe("stock");
    const updated = await mockRedis.hgetall<{ quantity: number }>("component:SENS/2026/001");
    expect(Number(updated?.quantity)).toBe(25); // 10 + 15
  });

  it("reports an error for an unknown componentId instead of crashing", async () => {
    geminiReply = '[{"action":"add_stock","componentId":"NOPE/2026/999","quantity":5}]';
    const body = await (await post("5 widgets")).json();
    expect(body.results[0].type).toBe("error");
    expect(body.results[0].message).toMatch(/not found/i);
  });

  it("creates a new box", async () => {
    geminiReply = '[{"action":"create_box","name":"Shelf B","location":"Room 5"}]';
    const body = await (await post("new box Shelf B in Room 5")).json();
    expect(body.results[0].type).toBe("box");
    expect(body.results[0].message).toMatch(/Shelf B/);
  });

  it("creates a component and logs a CREATED transaction", async () => {
    geminiReply =
      '[{"action":"create_component","name":"DHT11","category":"SENS","quantity":4,"boxName":"Workbench"}]';
    const body = await (await post("4 DHT11 in Workbench")).json();
    expect(body.results[0].type).toBe("component_new");
    const txWrites = mockRedis.calls.filter(
      (c) => c.cmd === "hset" && String(c.args[0]).startsWith("tx:")
    );
    expect(txWrites.length).toBeGreaterThan(0);
  });

  it("links a new component to an existing box by name, case-insensitively", async () => {
    geminiReply =
      '[{"action":"create_component","name":"DHT11","category":"SENS","quantity":1,"boxName":"WORKBENCH"}]';
    const body = await (await post("1 DHT11")).json();
    expect(body.results[0].sub).toMatch(/Workbench/);
  });

  it("creates a box then puts a component in it, in order", async () => {
    geminiReply = JSON.stringify([
      { action: "create_box", name: "Shelf C", location: "Room 9" },
      { action: "create_component", name: "Relay", category: "MISC", quantity: 3, boxName: "Shelf C" },
    ]);
    const body = await (await post("3 relays in a new Shelf C box")).json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].type).toBe("box");
    expect(body.results[1].type).toBe("component_new");
    expect(body.results[1].sub).toMatch(/Shelf C/);
  });

  it("falls back to MISC for an unknown category", async () => {
    geminiReply =
      '[{"action":"create_component","name":"Mystery","category":"NOPE","quantity":1,"boxName":""}]';
    const body = await (await post("1 mystery")).json();
    expect(body.results[0].sub).toMatch(/MISC/);
  });

  it("attributes the transaction to the logged-in user, not client input", async () => {
    currentSession = session({ name: "Priya" });
    geminiReply = '[{"action":"add_stock","componentId":"SENS/2026/001","quantity":1}]';
    await post("1 more");
    const txWrite = mockRedis.calls.find(
      (c) => c.cmd === "hset" && String(c.args[0]).startsWith("tx:")
    );
    expect((txWrite?.args[1] as { performedBy: string }).performedBy).toBe("Priya");
  });

  it("reports a partial failure without discarding the successful actions", async () => {
    geminiReply = JSON.stringify([
      { action: "add_stock", componentId: "SENS/2026/001", quantity: 2 },
      { action: "add_stock", componentId: "GONE/2026/001", quantity: 2 },
    ]);
    const body = await (await post("two things")).json();
    expect(body.results[0].type).toBe("stock");
    expect(body.results[1].type).toBe("error");
  });

  it("returns a message when Gemini produces an empty action list", async () => {
    geminiReply = "[]";
    const body = await (await post("hello")).json();
    expect(body.results[0].type).toBe("error");
    expect(body.results[0].message).toMatch(/no actions/i);
  });
});
