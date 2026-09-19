## What this changes

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The problem being solved. Link the issue if there is one. -->

## Tests

<!-- Required for changes to lib/, app/api/, middleware.ts or *Client.tsx. -->

- [ ] I added or updated tests covering this change
- [ ] The new test **fails without my change** (I checked, I did not assume)
- [ ] `npm run verify` passes locally

Which test covers this change, and what does it assert?

<!-- e.g. test/unit/search.test.ts — filtering with a coerced numeric location -->

<!-- No test? Explain why here and add the `no-tests-needed` label. -->

## Redis-backed data

Tick if this touches anything read from Redis:

- [ ] Values are read through `lib/search.ts`, `lc()` or `String()` — never a
      bare `.toLowerCase()` or `=== "true"` on a hash field
- [ ] Test fixtures come from `test/helpers/upstash.ts`, not hand-written objects

> Upstash JSON.parses hash values on read. A location stored as `"101"` comes
> back as the number `101`, `"true"` as the boolean `true`. This has caused
> three production bugs. See `docs/TESTING.md`.

## Checked by hand

<!-- Which pages did you actually open, and what did you do on them?
     Search boxes in particular: type a single character, and a query that
     matches nothing. -->
