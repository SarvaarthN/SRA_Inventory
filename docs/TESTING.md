# Testing

## Why this exists

On 19 Sep 2026 a reviewed and approved PR shipped a crash to production. Typing
a single character into the search box on `/components` broke the page for
everyone; users read the crash screen as being logged out.

The change looked correct in review. Nothing disagreed with it, because nothing
executed it. **Review is not a substitute for an executable check.** This suite
is that check.

## Commands

```bash
npm test              # run everything once
npm run test:watch    # re-run on save while developing
npm run test:ci       # with coverage, as CI runs it
npm run typecheck     # tsc --noEmit
npm run verify        # typecheck + lint + test — run before pushing
npm run check:tests   # the same gate CI applies to your PR
```

## Layout

```
test/
├── setup.ts                 dummy env vars; no test may touch a real service
├── helpers/
│   ├── upstash.ts           fixtures that reproduce Upstash's coercion
│   └── redis-mock.ts        in-memory Redis that coerces on read
├── unit/                    pure logic — fast, most tests live here
├── integration/             route handlers against the Redis mock
└── components/              React components (jsdom)
```

A component test opts into a browser environment with a docblock on line 1:

```ts
// @vitest-environment jsdom
```

## The rule that matters most

> **Never construct a test fixture by hand when a helper exists.**

Use `makeComponent()`, `makeBox()`, `makeUser()` from `test/helpers/upstash.ts`.

They round-trip values through `JSON.parse` exactly as Upstash does, so your
test sees the same lying values production does. A hand-written fixture with
clean strings will pass while production throws:

```ts
// Wrong — production never looks like this
const box = { id: "BOX-001", location: "101" };   // location stays a string

// Right — location comes back as the NUMBER 101, like it really does
const box = makeBox({ location: "101" });
```

## The bug class this suite exists to stop

`@upstash/redis` runs `JSON.parse` over every hash value it reads back. Only
values that fail to parse stay strings:

| Written  | Read back | Type      |
| -------- | --------- | --------- |
| `"Cabinet 3"` | `"Cabinet 3"` | string |
| `"101"`  | `101`     | **number**  |
| `"true"` | `true`    | **boolean** |
| `"2.5"`  | `2.5`     | **number**  |

`lib/types.ts` types all of these as `string`, so `value.toLowerCase()` compiles
cleanly and throws at runtime. `?? ""` does not help — a number is neither null
nor undefined.

This has caused three production bugs: admin login silently demoting an admin,
the box-search dropdown crashing, and the components-page crash above.

**Defences, in order of preference:**

1. Searching or comparing text → `lib/search.ts`. Never re-implement a filter
   inline in a component; that is how the last one shipped untested.
2. A one-off comparison → `lc()` from `lib/utils.ts`.
3. An authorisation check → `lib/auth.ts`. Never re-derive `canWrite` inline.
4. A number → `Number(x)`. A boolean-ish flag → `String(x) === "true"`.

## What a good test looks like

It fails without your change and passes with it. If it passes either way, it is
documentation, not a test.

Before fixing a bug, **write the failing test first** and watch it fail with the
real error. `test/unit/search.test.ts` is the worked example — reintroduce the
old `(v ?? "").toLowerCase()` and four tests fail with the exact production
`TypeError`.

Cover these, not just the happy path:

- empty input, whitespace-only input, missing fields
- a value that coerced to a number or boolean
- a query that matches nothing
- the unauthorised caller (an SY member must not be able to write)

## Coverage

Thresholds are enforced in `vitest.config.ts` over `lib/` and `app/api/`:
80% lines / functions / statements, 75% branches. **Ratchet these up as
coverage grows; never down.** Lowering a threshold to make CI pass is the same
mistake as not having the test.

## Adding a feature

CI fails a PR that changes logic in `lib/`, `app/api/`, `middleware.ts` or any
`*Client.tsx` without touching a test file. Thin RSC wrappers
(`page.tsx`, `layout.tsx`) and vendored `components/ui/` primitives are exempt.

Run `npm run check:tests` locally to see the same verdict before you push.

If a test genuinely does not apply, explain why in the PR description and add
the `no-tests-needed` label.

## Known gaps

Worth fixing, in rough priority order:

1. **No server-side write guard on the mutating API routes.** `/api/components`,
   `/api/components/[id]` (PATCH, DELETE), `/api/boxes` and `/api/boxes/[id]`
   (DELETE) do not call `canWrite()`. The UI hides the buttons from SY members,
   but the API accepts the request. `/api/chat` is currently the only guarded
   route. `lib/auth.ts` and its tests are already in place for this.
2. No test for `middleware.ts` route protection.
3. No end-to-end test; Playwright would cover login → add → check out.
4. Read-modify-write on stock quantity is not atomic — concurrent stock
   operations can lose an update. Needs `WATCH`/`MULTI`/`EXEC`.
