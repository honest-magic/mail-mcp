---
phase: 32
plan: 01
subsystem: rate-limiting
tags: [rate-limiting, security, tdd, write-protection]
dependency_graph:
  requires: []
  provides: [tiered-rate-limiter]
  affects: [index.ts, rate-limiter.ts]
tech_stack:
  added: []
  patterns: [tiered-rate-limiter, per-account-quota]
key_files:
  created: []
  modified:
    - src/utils/rate-limiter.ts
    - src/utils/rate-limiter.test.ts
    - src/index.ts
    - src/index.test.ts
decisions:
  - TieredRateLimiter wraps two AccountRateLimiter instances (one read, one write) — composition over extension keeps AccountRateLimiter unchanged
  - DEFAULT_READ_RATE_LIMIT_POINTS=100, DEFAULT_WRITE_RATE_LIMIT_POINTS=20 at 60s window
  - Dispatch routing uses existing WRITE_TOOLS set — no new set needed
  - Both dispatchTool and MCP request handler updated (two code paths for tool dispatch)
metrics:
  duration: 7 minutes
  completed: "2026-03-26"
  tasks_completed: 3
  files_modified: 4
---

# Phase 32 Plan 01: Per-Tool-Type Rate Limits Summary

**One-liner:** TieredRateLimiter with read (100/60s) and write (20/60s) tiers per-account, routed via WRITE_TOOLS set in tool dispatch.

## What Was Built

Extended the rate-limiting infrastructure to support two independent quota tiers per account:

- **Read tier** — 100 requests / 60 seconds (default): list, search, read operations
- **Write tier** — 20 requests / 60 seconds (default): send, move, delete, label operations

The `TieredRateLimiter` class composes two `AccountRateLimiter` instances internally. Tool dispatch in `index.ts` routes to `consumeWrite()` when the tool name is in the existing `WRITE_TOOLS` set, otherwise `consumeRead()`.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | TDD: add failing tests for TieredRateLimiter (RED) | 8ac00e7 |
| 2 | Implement TieredRateLimiter (GREEN) | 4ea030a |
| 3 | Wire TieredRateLimiter in index.ts + update index.test.ts | 5b98902 |

## Key Decisions

- **Composition over extension:** `TieredRateLimiter` owns two `AccountRateLimiter` instances. The original `AccountRateLimiter` class is unchanged — existing tests and any external callers are unaffected.
- **WRITE_TOOLS routing:** No new toolset required — existing `WRITE_TOOLS` Set (lines 25–41 of index.ts) already enumerates all mutating tools. Dispatch logic checks `WRITE_TOOLS.has(name)` before routing.
- **Both dispatch paths updated:** `dispatchTool()` and the MCP request handler are separate code paths; both updated for consistency.
- **Configurable for tests:** Constructor accepts `readPoints`, `writePoints`, `duration` — all existing SAFE-03 tests updated to inject `TieredRateLimiter` directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing SAFE-03 tests injected AccountRateLimiter into rateLimiter field**
- **Found during:** Task 3
- **Issue:** Three existing tests in `src/index.test.ts` injected `AccountRateLimiter` into `(server as any).rateLimiter`. After switching the field type to `TieredRateLimiter`, these tests would call `consumeWrite/consumeRead` on an object that only has `consume()` — causing TypeErrors instead of QuotaErrors.
- **Fix:** Updated all three SAFE-03 tests to inject `TieredRateLimiter({ readPoints, writePoints, duration })` instead. Added two new tests: one verifying write quota blocks write tools, another verifying exhausted write quota does NOT block read tools.
- **Files modified:** `src/index.test.ts`
- **Commit:** 5b98902

## Known Stubs

None.

## Self-Check: PASSED

- `src/utils/rate-limiter.ts` — TieredRateLimiter present: FOUND
- `src/utils/rate-limiter.test.ts` — TieredRateLimiter tests present: FOUND
- `src/index.ts` — TieredRateLimiter import + tiered dispatch: FOUND
- Commits 8ac00e7, 4ea030a, 5b98902 — all exist in git log: FOUND
- `npm test` — 494/494 tests pass: PASSED
