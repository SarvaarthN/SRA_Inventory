# Contributing

Developer guide for the SRA Inventory System. For what the application does and how to use it, see [README.md](README.md).

## Contents

- [Technology](#technology)
- [Local setup](#local-setup)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [A trap you need to know about](#a-trap-you-need-to-know-about)
- [Testing](#testing)
- [Pull request workflow](#pull-request-workflow)
- [Code conventions](#code-conventions)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router | Server Components fetch data on the server, so pages render without a client side data round trip |
| UI | React 19, Tailwind CSS 4, shadcn/ui | Icons from lucide-react, toasts from sonner |
| Language | TypeScript 5 | Strict mode across the full stack |
| Database | Upstash Redis | Accessed over a REST API, which suits serverless hosting where persistent TCP connections are not available |
| Authentication | JWT via `jose`, bcryptjs | Stateless sessions in an HttpOnly cookie. `jose` runs in the Edge runtime, which `jsonwebtoken` does not |
| Natural language entry | Google Gemini 2.0 Flash | Optional, free tier |
| Testing | Vitest, Testing Library | Unit, integration and component layers |
| Hosting | Vercel | Deploys from `main` |

Note that `AGENTS.md` warns this version of Next.js has breaking changes relative to older documentation. Check `node_modules/next/dist/docs/` before relying on a pattern you remember from Next.js 13 or 14.

## Local setup

### Prerequisites

- Node.js 20 or later
- An Upstash Redis database, free tier is enough
- A Google Gemini API key, only if you are working on Quick Add or Invoice Upload

### Steps

```bash
git clone <repository-url>
cd inventory_website
npm install
```

Create `.env.local` in the project root:

```
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
SESSION_SECRET=a-long-random-string-at-least-32-characters
GEMINI_API_KEY=your-gemini-key
```

| Variable | Where it comes from |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash console, your database, REST API section |
| `UPSTASH_REDIS_REST_TOKEN` | Same place |
| `SESSION_SECRET` | Generate with `openssl rand -base64 32`. Changing it signs every user out |
| `GEMINI_API_KEY` | Free from [aistudio.google.com](https://aistudio.google.com). Leave blank if you do not need Quick Add or Invoice Upload, the rest of the app is unaffected |

`.env.local` is gitignored. Never commit real credentials.

Use a separate Upstash database for development. Pointing local work at the live database will corrupt the club's real inventory.

```bash
npm run dev
```

Open http://localhost:3000. With an empty database you will be redirected to `/setup` to create the first administrator, which is created with TY access and the admin flag. After that `/setup` stays unavailable until no administrator accounts remain, which is the lockout recovery path.

## Project structure

```
app/
  page.tsx                  Dashboard
  login/, setup/            Authentication screens
  stock/                    Check In/Out
  components/               Component list, detail and creation
  boxes/                    Box list, detail and creation
  orders/                   Vendor order tracking
  categories/               Category management
  transactions/             Audit log
  admin/users/              User management, administrators only
  api/                      Route handlers for all data operations
components/
  Navbar.tsx                Desktop and mobile navigation
  QuickAdd.tsx              Natural language entry panel
  ui/                       shadcn/ui primitives, vendored
lib/
  redis.ts                  Redis client and the single registry of key names
  session.ts                JWT signing, verification and cookie handling
  auth.ts                   Authorisation predicates
  search.ts                 Free text search and filtering
  types.ts                  Shared TypeScript interfaces
  utils.ts                  Class name merging and safe string coercion
test/
  helpers/                  Fixtures and an in-memory Redis stand-in
  unit/                     Pure logic
  integration/              Route handlers
  components/               React components
middleware.ts               Route protection, runs on every request
scripts/                    Repository tooling
docs/TESTING.md             Testing guide
```

### Data model

Everything lives in Redis. There is no SQL and no ORM.

| Key | Type | Holds |
| --- | --- | --- |
| `component:{id}` | Hash | One component |
| `components:all` | Set | Every component ID |
| `components:cat:{code}` | Set | Component IDs in one category |
| `box:{id}` | Hash | One box |
| `boxes:all` | Set | Every box ID |
| `tx:{id}` | Hash | One transaction |
| `tx:all` | Sorted set | Every transaction, scored by timestamp |
| `tx:comp:{id}` | Sorted set | One component's history |
| `user:{userId}` | Hash | One user |
| `order:{id}` | Hash | One vendor order |
| `counter:*` | Integer | Atomic ID sequences |

Two conventions to respect:

Redis key names are defined only in the `keys` object in `lib/redis.ts`. Never write a key string inline. Renaming a key in one place should update every reader and writer at once.

`middleware.ts` must keep that exact filename at the project root and must use a default export. Next.js silently ignores any other name, which means no route is protected and nobody finds out until someone tries a URL directly. This has already happened once in this project.

### Reading many records

Fetching entities one at a time means one HTTP request per entity, because Upstash speaks REST rather than a socket. Use a pipeline instead:

```ts
const pipeline = redis.pipeline();
ids.forEach((id) => pipeline.hgetall(keys.component(id)));
const results = await pipeline.exec();
```

That is one request regardless of how many IDs there are. Every page that lists records already does this. Follow the pattern.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run lint` | ESLint |
| `npm test` | Run the suite once |
| `npm run test:watch` | Re-run affected tests on save |
| `npm run test:ci` | Tests with coverage, as CI runs them |
| `npm run check:tests` | The same tests-required gate CI applies |
| `npm run verify` | Typecheck, lint and test together. Run before pushing |

## A trap you need to know about

The Upstash client runs `JSON.parse` over every Redis hash value it reads back. Only values that fail to parse stay strings.

| Value written | Value read back | Type |
| --- | --- | --- |
| `"Cabinet 3"` | `"Cabinet 3"` | string |
| `"101"` | `101` | number |
| `"true"` | `true` | boolean |
| `"2.5"` | `2.5` | number |

`lib/types.ts` declares all of these fields as `string`. So `value.toLowerCase()` and `value === "true"` compile without complaint and then fail at runtime. Writing `?? ""` does not save you, because a number is neither null nor undefined.

This has caused three separate production incidents:

1. An administrator was silently demoted to a normal user after signing out and back in, because `isAdmin` was written as `"true"` and read back as the boolean `true`.
2. The box search dropdown crashed on a box whose location was numeric.
3. The components page crashed for every user the moment anyone typed a character into the search box, because a box location of `"101"` came back as the number `101`. The crash screen has no navigation on it, so users reported it as being signed out.

The third one shipped through code review. It looked correct, and nothing disagreed, because nothing executed it.

Use these rather than touching a Redis value directly:

| Situation | Use |
| --- | --- |
| Searching or filtering text | `lib/search.ts`. Do not reimplement a filter inline in a component |
| A single text comparison | `lc()` from `lib/utils.ts` |
| An authorisation check | `lib/auth.ts`. Do not re-derive `canWrite` inline |
| A number | `Number(value)` |
| A boolean flag | `String(value) === "true"` |

## Testing

```bash
npm test                               # run once, around ten seconds
npm run test:watch                     # leave running in a second terminal
npm test search                        # files matching "search"
npx vitest run test/unit/auth.test.ts  # one file
npx vitest -t "coerced"                # tests whose name matches
```

[docs/TESTING.md](docs/TESTING.md) covers the layout, the fixtures and what a good test looks like here. Read it before writing tests for this project.

The single most important rule: build fixtures with `makeComponent()`, `makeBox()` and `makeUser()` from `test/helpers/upstash.ts`, never by hand. Those helpers round-trip values through `JSON.parse` exactly as Upstash does, so your test sees the same values production sees. A hand-written fixture full of clean strings will pass while production throws.

```ts
// Wrong. Production never looks like this, location stays a string
const box = { id: "BOX-001", location: "101" };

// Right. location comes back as the number 101, as it really does
const box = makeBox({ location: "101" });
```

A useful test fails without your change and passes with it. If it passes either way it is documentation, not a test. When fixing a bug, write the failing test first and watch it fail with the real error before you fix anything.

Cover the failure cases, not only the happy path: empty input, whitespace-only input, missing fields, a value that coerced to a number or boolean, a query that matches nothing, and an unauthorised caller.

## Pull request workflow

1. Branch from `main`, named descriptively. `feat/low-stock-alerts` or `fix/box-delete-guard`.
2. Make the change and add tests alongside it.
3. Run `npm run verify` locally.
4. Open a pull request against `main` and fill in the template.
5. Wait for checks to pass, then request a review.

### Checks that run automatically

| Check | What it does |
| --- | --- |
| Typecheck | `tsc --noEmit` |
| Lint | ESLint. Errors block the merge |
| Tests | Full suite with coverage thresholds |
| Production build | Confirms the application actually builds |
| New code ships with tests | Fails if logic changed without a test change |

### Tests are required

A pull request that changes `lib/`, `app/api/`, `middleware.ts` or any `*Client.tsx` file without adding or updating a test is rejected automatically.

This rule exists because of incident three above. Review is valuable, but it is not an executable check, and it did not catch that bug.

Thin Server Component wrappers (`page.tsx`, `layout.tsx`) and the vendored `components/ui/` primitives are exempt. Run `npm run check:tests` to get the same verdict CI will give you, before you push.

If a test genuinely does not apply, explain why in the pull request description and apply the `no-tests-needed` label.

### Coverage

Thresholds are enforced in `vitest.config.ts`. `lib/` is held to a high bar because every page and route depends on it. There is a lower global floor set just under the current real number, held down by older API routes that have no tests yet.

Both are ratchets. Raise them as coverage grows. Never lower one to make a build pass, which is the same mistake as not writing the test.

### Before requesting review

- `npm run verify` passes
- New behaviour has a test that fails without the change
- Redis backed values go through `lib/search.ts`, `lc()` or `String()`
- You opened the affected pages and actually used them. For anything touching search, type a single character and then a query matching nothing, because that is precisely how the last outage was triggered

## Code conventions

Match the style of the file you are editing. There is no formatter configured, so keep diffs tight and do not reformat lines you did not otherwise need to touch.

Prefer Server Components. Add `"use client"` only where interactivity genuinely requires it. The usual pattern here is a Server Component page that fetches data and passes it to a Client Component that handles interaction.

Put shared logic in `lib/` where it can be tested, rather than inline in a component where it cannot. The search bug existed because filter logic was copy-pasted into four components and none of it was reachable by a test.

Keep route handlers thin: validate the input, call into `lib/`, return a response.

Every mutating API route must check authorisation on the server with `canWrite()`. Hiding a button in the interface is not access control, and a duplicated permission check that drifts out of sync is a privilege escalation bug.

Every route handler needs `export const dynamic = "force-dynamic"`. Without it Next.js may cache a response, and stale inventory data is worse than slow inventory data.

## Deployment

The application deploys to Vercel from `main`.

Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SESSION_SECRET` and `GEMINI_API_KEY` under Settings, Environment Variables in the Vercel project. A missing variable will not fail the build. It fails at runtime, the first time something reads it.

Branch protection is configured separately on GitHub under Settings, Branches. Enable "Require status checks to pass before merging" and select all five checks. Without this CI reports a failure and the merge button still works, which defeats the point. Check names only appear in that list after they have run at least once, so push first and configure afterwards.

## Known limitations

Documented deliberately rather than left to be discovered.

1. The mutating API routes do not enforce the SY restriction on the server. `/api/components`, `/api/components/[id]`, `/api/boxes` and `/api/boxes/[id]` accept write requests from any authenticated session. The interface hides the controls from SY members but the endpoints are reachable directly. `/api/chat` is currently the only guarded route. `lib/auth.ts` exists and is tested, so applying `canWrite()` to the rest is straightforward and is the highest value thing to pick up.
2. Stock updates read the current quantity then write a new one, which is not atomic. Two simultaneous operations on the same component can lose an update. A Redis `WATCH`, `MULTI` and `EXEC` sequence would fix it.
3. Search loads every component into memory and filters there. Fine at a few hundred items, not fine at tens of thousands.
4. There is no rate limiting on login or on the Gemini endpoint.
5. Sessions cannot be revoked before their seven day expiry. Deleting an account does not invalidate a token already issued to it.
6. There is no end to end test. Playwright covering sign in, adding a component and checking it out would close the largest remaining gap.
7. `react-hooks/set-state-in-effect` is downgraded to a warning in `eslint.config.mjs`. Several debounced search effects trip it. They need restructuring, after which the rule should go back to being an error.
