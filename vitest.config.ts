import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Node by default for pure logic and route handlers. Component tests opt
    // into jsdom with a `// @vitest-environment jsdom` docblock at the top.
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/redis.ts", "**/*.d.ts"],
      /**
       * Two bars, both ratchets. Raise them as coverage grows; never lower one
       * to make CI pass — that is the same mistake as not writing the test.
       *
       * `lib/**` is shared logic every page and route depends on, so it is held
       * to a high bar. The global floor is set just under today's real number
       * so total coverage can only go up: the untested legacy routes
       * (boxes, users, orders, export) are what hold it down, and each one that
       * gains tests should push this floor up with it.
       */
      thresholds: {
        lines: 25,
        functions: 50,
        branches: 75,
        statements: 25,
        "lib/**/*.ts": {
          lines: 78,
          functions: 78,
          branches: 88,
          statements: 78,
        },
      },
    },
  },
});
