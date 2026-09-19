import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedis } from "../helpers/redis-mock";
import type { SessionPayload } from "@/lib/session";

let currentSession: SessionPayload | null = null;
let geminiReply = "[]";
let geminiShouldThrow = false;
// Set to make generateContent throw a GoogleGenerativeAIFetchError with this
// status the first N times before succeeding; null means "always throw".
let geminiErrorStatus: number | undefined;
let geminiFailuresRemaining = 0;

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

vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAIFetchError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    GoogleGenerativeAIFetchError,
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: async () => {
            if (geminiFailuresRemaining > 0) {
              geminiFailuresRemaining -= 1;
              throw new GoogleGenerativeAIFetchError("gemini transient error", geminiErrorStatus);
            }
            if (geminiShouldThrow) throw new Error("gemini unavailable");
            return { response: { text: () => geminiReply } };
          },
        };
      }
    },
  };
});

const { POST } = await import("@/app/api/invoices/parse/route");

const session = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  id: "USR-001", name: "Rohan", userId: "rohan", year: "TY", isAdmin: false, ...over,
});

function makeFile(opts: { type?: string; sizeBytes?: number } = {}): File {
  const type = opts.type ?? "image/jpeg";
  const size = opts.sizeBytes ?? 1024;
  return new File([new Uint8Array(size)], "invoice.jpg", { type });
}

function postWithFile(file: File | null) {
  const form = new FormData();
  if (file) form.append("file", file);
  return POST(
    new Request("http://localhost/api/invoices/parse", {
      method: "POST",
      body: form,
    }) as unknown as Parameters<typeof POST>[0]
  );
}

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

beforeEach(() => {
  mockRedis.reset();
  currentSession = session();
  geminiReply = "[]";
  geminiShouldThrow = false;
  geminiErrorStatus = undefined;
  geminiFailuresRemaining = 0;
  process.env.GEMINI_API_KEY = ORIGINAL_KEY ?? "test-key";
});

describe("POST /api/invoices/parse — authorisation", () => {
  it("rejects an unauthenticated request with 401", async () => {
    currentSession = null;
    const res = await postWithFile(makeFile());
    expect(res.status).toBe(401);
  });

  it("rejects a read-only SY member with 403", async () => {
    currentSession = session({ year: "SY" });
    const res = await postWithFile(makeFile());
    expect(res.status).toBe(403);
  });

  it("rejects when GEMINI_API_KEY is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await postWithFile(makeFile());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/invoices/parse — input validation", () => {
  it("rejects a request with no file", async () => {
    const res = await postWithFile(null);
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported mime type", async () => {
    const res = await postWithFile(makeFile({ type: "application/zip" }));
    expect(res.status).toBe(400);
  });

  it("rejects a file over the size limit", async () => {
    const res = await postWithFile(makeFile({ sizeBytes: 9 * 1024 * 1024 }));
    expect(res.status).toBe(400);
  });

  it("accepts a PDF invoice", async () => {
    geminiReply = '[{"name":"DHT11","category":"SENS","quantity":2,"description":""}]';
    const res = await postWithFile(makeFile({ type: "application/pdf" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/invoices/parse — never touches Redis", () => {
  it("writes nothing to Redis on success", async () => {
    geminiReply = '[{"name":"DHT11","category":"SENS","quantity":2,"description":""}]';
    await postWithFile(makeFile());
    expect(mockRedis.calls).toHaveLength(0);
  });

  it("writes nothing to Redis on failure", async () => {
    geminiShouldThrow = true;
    await postWithFile(makeFile());
    expect(mockRedis.calls).toHaveLength(0);
  });
});

describe("POST /api/invoices/parse — Gemini response handling", () => {
  it("returns a friendly in-band error, not a 500, when Gemini throws", async () => {
    geminiShouldThrow = true;
    const res = await postWithFile(makeFile());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.error).toMatch(/couldn't read/i);
  });

  it("handles Gemini returning prose instead of JSON", async () => {
    geminiReply = "Sure, here is the invoice summary...";
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items).toEqual([]);
    expect(body.error).toBeTruthy();
  });

  it("handles Gemini returning a JSON object instead of an array", async () => {
    geminiReply = '{"name":"DHT11"}';
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items).toEqual([]);
  });

  it("strips markdown code fences", async () => {
    geminiReply = '```json\n[{"name":"Servo","category":"MOTR","quantity":3,"description":""}]\n```';
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Servo");
  });

  it("reports no items when Gemini returns an empty array", async () => {
    geminiReply = "[]";
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items).toEqual([]);
    expect(body.error).toMatch(/no items/i);
  });

  it("coerces a missing quantity to 1", async () => {
    geminiReply = '[{"name":"Resistor 10k","category":"MISC","description":""}]';
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items[0].quantity).toBe(1);
  });

  it("coerces a zero or negative quantity to a positive integer", async () => {
    geminiReply = '[{"name":"Resistor","category":"MISC","quantity":-5,"description":""}]';
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items[0].quantity).toBe(1);
  });

  it("drops items with an empty name", async () => {
    geminiReply = JSON.stringify([
      { name: "", category: "MISC", quantity: 1, description: "" },
      { name: "Valid Item", category: "MISC", quantity: 1, description: "" },
    ]);
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Valid Item");
  });

  it("uppercases a lowercase category code", async () => {
    geminiReply = '[{"name":"Wire","category":"cabl","quantity":1,"description":""}]';
    const body = await (await postWithFile(makeFile())).json();
    expect(body.items[0].category).toBe("CABL");
  });
});

describe("POST /api/invoices/parse — retries transient Gemini failures", () => {
  it("retries a 429 and succeeds once the rate limit clears", async () => {
    geminiErrorStatus = 429;
    geminiFailuresRemaining = 1; // fails once, then succeeds
    geminiReply = '[{"name":"HC-SR04","category":"SENS","quantity":1,"description":""}]';

    vi.useFakeTimers();
    const promise = postWithFile(makeFile());
    await vi.runAllTimersAsync();
    const body = await (await promise).json();
    vi.useRealTimers();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("HC-SR04");
  });

  it("retries a 503 and succeeds on the final attempt", async () => {
    geminiErrorStatus = 503;
    geminiFailuresRemaining = 2; // fails twice — exactly at MAX_ATTEMPTS - 1
    geminiReply = '[{"name":"Servo","category":"MOTR","quantity":1,"description":""}]';

    vi.useFakeTimers();
    const promise = postWithFile(makeFile());
    await vi.runAllTimersAsync();
    const body = await (await promise).json();
    vi.useRealTimers();

    expect(body.items).toHaveLength(1);
  });

  it("gives up after exhausting retries on a persistent 429/503 with a distinct message", async () => {
    geminiErrorStatus = 503;
    geminiFailuresRemaining = 99; // never recovers

    vi.useFakeTimers();
    const promise = postWithFile(makeFile());
    await vi.runAllTimersAsync();
    const body = await (await promise).json();
    vi.useRealTimers();

    expect(body.items).toEqual([]);
    expect(body.error).toMatch(/busy/i);
  });

  it("does not retry a non-retryable status like 400", async () => {
    geminiErrorStatus = 400;
    geminiFailuresRemaining = 99;

    const body = await (await postWithFile(makeFile())).json();

    expect(body.items).toEqual([]);
    expect(body.error).toMatch(/couldn't read/i);
    // Only the single initial attempt should have been made — confirmed by
    // the failure counter still being almost untouched.
    expect(geminiFailuresRemaining).toBe(98);
  });
});
