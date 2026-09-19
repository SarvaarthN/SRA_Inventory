import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Env vars that modules read at import time. Values are dummies — no test is
// allowed to reach a real Upstash, Gemini or any other network service.
process.env.SESSION_SECRET ??= "test-secret-not-used-in-production-abcdefghij";
process.env.UPSTASH_REDIS_REST_URL ??= "https://example.invalid";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";
process.env.GEMINI_API_KEY ??= "test-gemini-key";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
