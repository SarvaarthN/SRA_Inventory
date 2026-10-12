import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedis } from "../helpers/redis-mock";

vi.mock("@/lib/redis", async () => {
  const { mockRedis } = await import("../helpers/redis-mock");
  return {
    redis: mockRedis,
    keys: (await vi.importActual<typeof import("@/lib/redis")>("@/lib/redis")).keys,
  };
});

const { PATCH } = await import("@/app/api/components/[id]/route");

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request("http://localhost/api/components/x", {
      method: "PATCH",
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof PATCH>[0],
    { params: Promise.resolve({ id: encodeURIComponent(id) }) }
  );

const ID = "SENS/2026/001";

/** Read the component straight back out of the store. */
const stored = () =>
  mockRedis.hgetall<{ quantity: number; boxId: string; boxName: string }>(`component:${ID}`);

/** The transaction hashes written during this test. */
const txWrites = () =>
  mockRedis.calls.filter((c) => c.cmd === "hset" && String(c.args[0]).startsWith("tx:"));

beforeEach(() => {
  mockRedis.reset();
  mockRedis.seedHash(`component:${ID}`, {
    id: ID, name: "HC-SR04", category: "SENS", categoryLabel: "Sensors",
    categoryColor: "", year: 2026, uniqueNum: 1, quantity: 10, description: "",
    boxId: "BOX-001", boxName: "Old Workbench", addedBy: "T",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
});

/**
 * REGRESSION - 2026-10-12.
 *
 * Adding stock to an existing component through "Add to Existing" offers a
 * Storage Box picker, pre-filled with the component's CURRENT box. Choosing a
 * different box did nothing: the client never sent boxId, and STOCK_IN on the
 * server only ever wrote quantity. The component silently stayed in its old
 * box, so a freshly created box appeared to reject the component.
 */
describe("PATCH STOCK_IN moves the component when a new box is chosen", () => {
  it("reassigns the component to the box supplied with the stock-in", async () => {
    const res = await patch(ID, {
      action: "STOCK_IN", quantity: 5, performedBy: "Rohan",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    expect(res.status).toBe(200);

    const after = await stored();
    expect(after?.boxId).toBe("BOX-009");
    expect(after?.boxName).toBe("New Shelf");
  });

  it("still applies the quantity change when it also moves the box", async () => {
    await patch(ID, {
      action: "STOCK_IN", quantity: 5, performedBy: "Rohan",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    expect(Number((await stored())?.quantity)).toBe(15);
  });

  it("returns the moved component in the response body", async () => {
    const body = await (
      await patch(ID, {
        action: "STOCK_IN", quantity: 1, performedBy: "Rohan",
        boxId: "BOX-009", boxName: "New Shelf",
      })
    ).json();
    expect(body.boxId).toBe("BOX-009");
    expect(body.boxName).toBe("New Shelf");
  });

  it("records the move in the transaction so History shows it", async () => {
    await patch(ID, {
      action: "STOCK_IN", quantity: 5, performedBy: "Rohan",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    const notes = String((txWrites()[0]?.args[1] as { notes: string }).notes);
    expect(notes).toMatch(/New Shelf/);
  });

  it("keeps the user's own note alongside the move note", async () => {
    await patch(ID, {
      action: "STOCK_IN", quantity: 5, performedBy: "Rohan", notes: "Restocked from Robu",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    const notes = String((txWrites()[0]?.args[1] as { notes: string }).notes);
    expect(notes).toMatch(/Restocked from Robu/);
    expect(notes).toMatch(/New Shelf/);
  });
});

describe("PATCH STOCK_IN leaves the box alone when no move was asked for", () => {
  it("does not wipe the box when boxId is omitted entirely", async () => {
    await patch(ID, { action: "STOCK_IN", quantity: 3, performedBy: "Rohan" });
    const after = await stored();
    expect(after?.boxId).toBe("BOX-001");
    expect(after?.boxName).toBe("Old Workbench");
  });

  it("does not wipe the box when boxId is an empty string", async () => {
    // The picker leaves this empty when the typed text matched no box. That is
    // "I did not choose one", not "remove this component from its box".
    await patch(ID, {
      action: "STOCK_IN", quantity: 3, performedBy: "Rohan", boxId: "", boxName: "",
    });
    expect((await stored())?.boxId).toBe("BOX-001");
  });

  it("is a no-op for the box when the same box is resubmitted", async () => {
    await patch(ID, {
      action: "STOCK_IN", quantity: 3, performedBy: "Rohan",
      boxId: "BOX-001", boxName: "Old Workbench",
    });
    const after = await stored();
    expect(after?.boxId).toBe("BOX-001");
    expect(Number(after?.quantity)).toBe(13);
  });

  it("adds no move note when the box did not change", async () => {
    await patch(ID, {
      action: "STOCK_IN", quantity: 3, performedBy: "Rohan", notes: "plain restock",
      boxId: "BOX-001", boxName: "Old Workbench",
    });
    expect(String((txWrites()[0]?.args[1] as { notes: string }).notes)).toBe("plain restock");
  });

  it("assigns a box to a component that had none", async () => {
    mockRedis.seedHash(`component:${ID}`, {
      id: ID, name: "HC-SR04", category: "SENS", categoryLabel: "Sensors",
      categoryColor: "", year: 2026, uniqueNum: 1, quantity: 2, description: "",
      boxId: "", boxName: "", addedBy: "T",
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
    });
    await patch(ID, {
      action: "STOCK_IN", quantity: 1, performedBy: "Rohan",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    expect((await stored())?.boxId).toBe("BOX-009");
  });
});

describe("PATCH STOCK_OUT never relocates a component", () => {
  it("ignores a box sent alongside a stock-out", async () => {
    await patch(ID, {
      action: "STOCK_OUT", quantity: 2, performedBy: "Rohan",
      boxId: "BOX-009", boxName: "New Shelf",
    });
    const after = await stored();
    expect(after?.boxId).toBe("BOX-001");
    expect(Number(after?.quantity)).toBe(8);
  });
});

describe("PATCH UPDATE_BOX still works", () => {
  it("moves the component", async () => {
    await patch(ID, { action: "UPDATE_BOX", performedBy: "Rohan", boxId: "BOX-009", boxName: "New Shelf" });
    expect((await stored())?.boxId).toBe("BOX-009");
  });

  it("can clear the box assignment, unlike STOCK_IN", async () => {
    await patch(ID, { action: "UPDATE_BOX", performedBy: "Rohan", boxId: "", boxName: "" });
    const after = await stored();
    expect(after?.boxId).toBe("");
    expect(after?.boxName).toBe("");
  });

  it("does not change the quantity", async () => {
    await patch(ID, { action: "UPDATE_BOX", performedBy: "Rohan", boxId: "BOX-009", boxName: "New Shelf" });
    expect(Number((await stored())?.quantity)).toBe(10);
  });
});

describe("PATCH validation", () => {
  it("404s for a component that does not exist", async () => {
    const res = await patch("NOPE/2026/999", { action: "STOCK_IN", quantity: 1, performedBy: "R" });
    expect(res.status).toBe(404);
  });

  it("rejects a stock-out larger than the quantity on hand", async () => {
    const res = await patch(ID, { action: "STOCK_OUT", quantity: 999, performedBy: "R" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/insufficient/i);
  });

  it("leaves the component untouched when a stock-out is rejected", async () => {
    await patch(ID, { action: "STOCK_OUT", quantity: 999, performedBy: "R" });
    expect(Number((await stored())?.quantity)).toBe(10);
  });

  it("rejects a stock change with no performer", async () => {
    const res = await patch(ID, { action: "STOCK_IN", quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("decodes a URL-encoded part number containing slashes", async () => {
    // The id arrives as SENS%2F2026%2F001 because part numbers contain slashes.
    const res = await patch(ID, { action: "STOCK_IN", quantity: 1, performedBy: "R" });
    expect(res.status).toBe(200);
  });
});
