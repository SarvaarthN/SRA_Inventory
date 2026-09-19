import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedis } from "../helpers/redis-mock";

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("../helpers/redis-mock");
  return {
    redis: mockRedis,
    keys: (await vi.importActual<typeof import("@/lib/redis")>("@/lib/redis")).keys,
  };
});

const { GET } = await import("@/app/api/search/route");

const req = (qs: string) =>
  new Request(`http://localhost/api/search${qs}`) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  mockRedis.reset();
  // A box in Room 101 — location written as "101", read back as the number 101.
  mockRedis.seedSet("boxes:all", ["BOX-001", "BOX-002"]);
  mockRedis.seedHash("box:BOX-001", {
    id: "BOX-001", name: "Workbench", location: "101",
    createdBy: "T", createdAt: "2026-01-01", boxType: "GENERAL",
  });
  mockRedis.seedHash("box:BOX-002", {
    id: "BOX-002", name: "Tools", location: "Cabinet 3",
    createdBy: "T", createdAt: "2026-01-01", boxType: "GENERAL",
  });
  mockRedis.seedSet("components:all", ["SENS/2026/001", "TOOL/2026/001"]);
  mockRedis.seedHash("component:SENS/2026/001", {
    id: "SENS/2026/001", name: "HC-SR04", category: "SENS", categoryLabel: "Sensors",
    categoryColor: "", year: 2026, uniqueNum: 1, quantity: 5, description: "",
    boxId: "BOX-001", boxName: "Workbench", addedBy: "T",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
  mockRedis.seedHash("component:TOOL/2026/001", {
    id: "TOOL/2026/001", name: "2020", category: "TOOL", categoryLabel: "Tools",
    categoryColor: "", year: 2026, uniqueNum: 1, quantity: 2, description: "",
    boxId: "BOX-002", boxName: "Tools", addedBy: "T",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
});

describe("GET /api/search — boxes", () => {
  it("does not 500 when a box location coerced to a number", async () => {
    const res = await GET(req("?q=work&type=boxes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("BOX-001");
  });

  it("does not 500 for any single-character query", async () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
      const res = await GET(req(`?q=${ch}&type=boxes`));
      expect(res.status, `query "${ch}" should not error`).toBe(200);
    }
  });

  it("finds a box by its numeric location", async () => {
    const body = await (await GET(req("?q=101&type=boxes"))).json();
    expect(body.map((b: { id: string }) => b.id)).toEqual(["BOX-001"]);
  });

  it("returns an empty array for a blank query", async () => {
    expect(await (await GET(req("?q=&type=boxes"))).json()).toEqual([]);
  });

  it("is case-insensitive", async () => {
    const body = await (await GET(req("?q=WORKBENCH&type=boxes"))).json();
    expect(body).toHaveLength(1);
  });
});

describe("GET /api/search — components", () => {
  it("does not 500 when a component NAME coerced to a number", async () => {
    // "2020" aluminium extrusion reads back as the number 2020.
    const res = await GET(req("?q=2020&type=components"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((c: { id: string }) => c.id)).toEqual(["TOOL/2026/001"]);
  });

  it("does not 500 for any single-character query", async () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
      const res = await GET(req(`?q=${ch}&type=components`));
      expect(res.status, `query "${ch}" should not error`).toBe(200);
    }
  });

  it("matches on part number", async () => {
    const body = await (await GET(req("?q=SENS/2026&type=components"))).json();
    expect(body).toHaveLength(1);
  });

  it("defaults to components when type is omitted", async () => {
    const res = await GET(req("?q=hc-sr04"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("caps results at 8", async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const id = `MISC/2026/${String(i).padStart(3, "0")}`;
      ids.push(id);
      mockRedis.seedHash(`component:${id}`, {
        id, name: `widget ${i}`, category: "MISC", categoryLabel: "Misc",
        categoryColor: "", year: 2026, uniqueNum: i, quantity: 1, description: "",
        boxId: "", boxName: "", addedBy: "T",
        createdAt: "2026-01-01", updatedAt: "2026-01-01",
      });
    }
    mockRedis.seedSet("components:all", ids);
    const body = await (await GET(req("?q=widget&type=components"))).json();
    expect(body).toHaveLength(8);
  });

  it("returns an empty array when nothing is stored", async () => {
    mockRedis.reset();
    mockRedis.seedSet("components:all", []);
    expect(await (await GET(req("?q=anything"))).json()).toEqual([]);
  });
});
