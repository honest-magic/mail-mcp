---
phase: 11-input-validation-safety-limits
plan: 01
subsystem: utils
tags: [validation, rate-limiting, tdd, security]
dependency_graph:
  requires: [src/errors.ts, rate-limiter-flexible]
  provides: [src/utils/validation.ts, src/utils/rate-limiter.ts]
  affects: []
tech_stack:
  added: [rate-limiter-flexible ^10.0.1]
  patterns: [TDD red-green, per-account Map pattern, ReDoS-safe regex]
key_files:
  created:
    - src/utils/validation.ts
    - src/utils/validation.test.ts
    - src/utils/rate-limiter.ts
    - src/utils/rate-limiter.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Email validation uses /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ — ReDoS-safe (no nested quantifiers), no external npm dependency"
  - "AccountRateLimiter uses Map<accountId, RateLimiterMemory> for true per-account isolation, not a shared limiter with key namespacing"
  - "AccountRateLimiter is an instantiable class, not a module-level singleton — instantiated per MailMCPServer"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 6
---

# Phase 11 Plan 01: Email Validation Utility and Per-Account Rate Limiter Summary

Two tested utility modules providing input validation and rate limiting foundation for Phase 11's safety guards — `validateEmailAddresses` using a ReDoS-safe regex and `AccountRateLimiter` with per-account `Map<string, RateLimiterMemory>` isolation.

## Objective

Create `src/utils/validation.ts` and `src/utils/rate-limiter.ts` with full unit test coverage as isolated, composable utilities ready for wiring in 11-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Email validation utility with tests | 734053b | src/utils/validation.ts, src/utils/validation.test.ts |
| 2 | Per-account rate limiter with tests | 6c70548 | src/utils/rate-limiter.ts, src/utils/rate-limiter.test.ts, package.json, package-lock.json |

## What Was Built

### Task 1: Email Validation Utility

`src/utils/validation.ts` exports `validateEmailAddresses(...addrFields: Array<string | undefined>): void`:

- ReDoS-safe regex `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Handles angle-bracket format (`Name <user@example.com>`) via `ANGLE_BRACKET_RE`
- Accepts comma-separated address lists, undefined fields (optional to/cc/bcc), and empty strings
- Collects all invalid addresses and throws a single `ValidationError` listing them

10 unit tests covering all specified behaviors pass.

### Task 2: Per-Account Rate Limiter

`src/utils/rate-limiter.ts` exports:

- `DEFAULT_RATE_LIMIT_POINTS = 100`
- `DEFAULT_RATE_LIMIT_DURATION = 60`
- `class AccountRateLimiter` with constructor accepting optional `{ points, duration }`, private `Map<string, RateLimiterMemory>` for per-account isolation, and `async consume(accountId: string): Promise<void>`

When `consume()` is rejected by `rate-limiter-flexible` (limit exceeded), the `RateLimiterRes.msBeforeNext` is used to compute a human-readable `Retry after N second(s)` message in the thrown `QuotaError`.

8 unit tests covering isolation, error content, and custom limit configuration pass.

## Verification

```
npx vitest run src/utils/validation.test.ts src/utils/rate-limiter.test.ts
Test Files  2 passed (2)
Tests       18 passed (18)

npm test
Test Files  11 passed (11)
Tests       140 passed (140)

npx tsc --noEmit
(clean — no output)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both utilities are complete. They are standalone modules that will be wired into the dispatch layer in 11-02.

## Self-Check: PASSED

- src/utils/validation.ts exists: FOUND
- src/utils/validation.test.ts exists: FOUND
- src/utils/rate-limiter.ts exists: FOUND
- src/utils/rate-limiter.test.ts exists: FOUND
- Commit 734053b: FOUND
- Commit 6c70548: FOUND
