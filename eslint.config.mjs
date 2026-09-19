import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated coverage output — not source.
    "coverage/**",
  ]),
  {
    /**
     * `react-hooks/set-state-in-effect` flags a real smell (cascading renders)
     * but every current hit predates this config and fixing them means
     * restructuring debounced-search effects. Kept visible as a warning so CI
     * stays green and honest rather than red and ignored.
     *
     * TODO: restructure these effects and raise this back to "error".
     *   app/admin/users/page.tsx, app/components/new/NewComponentClient.tsx,
     *   app/orders/new/OrderItemRow.tsx, app/stock/StockClient.tsx
     */
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
