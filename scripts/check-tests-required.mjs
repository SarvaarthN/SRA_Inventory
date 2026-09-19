#!/usr/bin/env node
/**
 * Fails a pull request that changes application logic without touching tests.
 *
 * Written after a reviewed-and-approved PR shipped a crash to production: the
 * change looked correct in review and there was no test that would have
 * disagreed. Review is not a substitute for an executable check.
 *
 * Run locally before pushing:  npm run check:tests
 */
import { execSync } from "node:child_process";

const BASE = process.env.BASE_REF || "origin/main";

/** Changes to these paths require a matching test change. */
const NEEDS_TESTS = [
  /^app\/api\/.+\.ts$/,      // route handlers
  /^lib\/.+\.ts$/,           // shared logic
  /^app\/.+Client\.tsx$/,    // interactive client components
  /^middleware\.ts$/,        // auth gate
];

/** Never require tests for these. */
const EXEMPT = [
  /^app\/.+\/(page|layout|loading|error|not-found)\.tsx$/, // thin RSC wrappers
  /^components\/ui\//,                                     // vendored shadcn primitives
  /\.d\.ts$/,
  /^lib\/redis\.ts$/,                                      // thin client construction
];

const COUNTS_AS_TEST = [/^test\//, /\.test\.(ts|tsx)$/];

function changedFiles() {
  try {
    execSync(`git rev-parse --verify ${BASE}`, { stdio: "ignore" });
  } catch {
    console.log(`⚠  Base ref ${BASE} not found — skipping check.`);
    process.exit(0);
  }
  const mergeBase = execSync(`git merge-base HEAD ${BASE}`).toString().trim();
  const committed = execSync(
    `git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD`
  ).toString();

  // Locally, also count work in progress — otherwise the check says "all clear"
  // right up until you commit, which is exactly when you stop looking at it.
  // CI checks out a detached commit, so there is nothing uncommitted there.
  const uncommitted = process.env.CI
    ? ""
    : execSync("git status --porcelain --untracked-files=all").toString()
        .split("\n")
        .map((l) => l.slice(3).trim())
        .join("\n");

  return [...new Set(`${committed}\n${uncommitted}`.split("\n").map((f) => f.trim()))].filter(
    Boolean
  );
}

const files = changedFiles();
const sourceChanges = files.filter(
  (f) => NEEDS_TESTS.some((r) => r.test(f)) && !EXEMPT.some((r) => r.test(f))
);
const testChanges = files.filter((f) => COUNTS_AS_TEST.some((r) => r.test(f)));

console.log(`Comparing against ${BASE}`);
console.log(`  ${files.length} file(s) changed`);
console.log(`  ${sourceChanges.length} require test coverage`);
console.log(`  ${testChanges.length} test file(s) changed\n`);

if (sourceChanges.length === 0) {
  console.log("✓ No logic changes that require tests.");
  process.exit(0);
}

console.log("Logic changed in:");
sourceChanges.forEach((f) => console.log(`  • ${f}`));

if (testChanges.length > 0) {
  console.log("\nTests changed in:");
  testChanges.forEach((f) => console.log(`  • ${f}`));
  console.log("\n✓ Logic changes ship with tests.");
  process.exit(0);
}

console.error(`
✗ This PR changes application logic but adds or updates no tests.

Every one of the files above can break the app at runtime. Add a test that
fails without your change, then passes with it.

  • lib/ or app/api/ logic   -> test/unit/  or test/integration/
  • *Client.tsx components   -> test/components/
  • Anything reading Redis   -> use test/helpers/upstash.ts fixtures, which
                                reproduce Upstash's JSON.parse coercion

If a test genuinely does not apply, say why in the PR description and add the
\`no-tests-needed\` label to bypass this check.

See docs/TESTING.md.
`);
process.exit(1);
