---
phase: 10-connection-lifecycle-error-infrastructure
plan: "03"
subsystem: connection-lifecycle
tags: [shutdown, graceful-shutdown, signal-handlers, imap, lifecycle]
dependency_graph:
  requires: [10-01]
  provides: [graceful-shutdown, imap-liveness-check, in-flight-drain]
  affects: [src/index.ts, src/protocol/imap.ts]
tech_stack:
  added: []
  patterns: [liveness-check-before-logout, in-flight-counter, drain-then-disconnect, timer-unref-safety]
key_files:
  created: []
  modified:
    - src/index.ts
    - src/index.test.ts
    - src/protocol/imap.ts
    - src/protocol/imap.test.ts
key_decisions:
  - "ImapClient.disconnect() checks client.usable before calling logout() to handle already-dead connections safely during shutdown"
  - "In-flight request counter uses try/finally to guarantee decrement even on error — prevents shutdown from hanging"
  - "Signal handlers registered once in main() (not constructor or run()) to avoid doubling in tests (pitfall H-06)"
  - "timer.unref() prevents forced-exit timer from keeping the process alive if shutdown completes before 10s"
  - "shutdown() uses Promise.allSettled() so one failing disconnect does not block others"
metrics:
  duration_seconds: 480
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 0
  files_modified: 4
requirements:
  - CONN-01
---

# Phase 10 Plan 03: Graceful Shutdown Summary

Graceful shutdown handling for the MCP server: SIGTERM/SIGINT signal handlers, in-flight request draining with a 10-second forced-exit fallback, and safe IMAP disconnect with `client.usable` liveness check.

## What Was Built

**Task 1: ImapClient.disconnect() liveness check** (`src/protocol/imap.ts`)

Added `if (this.client.usable)` guard before calling `logout()`. Without this guard, calling `logout()` on an already-dead imapflow connection throws. The `client` reference is always nulled out afterward regardless — no dangling pointers.

**Task 2: MailMCPServer shutdown infrastructure** (`src/index.ts`)

- Two new private fields: `shuttingDown = false`, `inFlightCount = 0`
- `async shutdown()` method: sets flag, drains in-flight count (polling every 50ms up to 10s), disconnects all cached `MailService` instances via `Promise.allSettled()`, clears the Map
- `CallToolRequestSchema` handler wrapped with: early-return on `shuttingDown`, `inFlightCount++` before dispatch, `inFlightCount--` in `finally` block
- Signal handlers in `main()`: `process.on('SIGTERM', shutdown)` and `process.on('SIGINT', shutdown)` with `timer.unref()` for forced-exit safety

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 7e08a91 | feat(10-03): add liveness check to ImapClient.disconnect() |
| Task 2 | 2c2471a | feat(10-03): add shutdown method and signal handlers to MailMCPServer |

## Tests Added

**imap.test.ts** (5 new tests in "disconnect() liveness check" suite):
- calls logout() when usable=true
- does NOT call logout() when usable=false
- sets this.client to null after successful logout
- sets this.client to null even when usable=false
- does nothing when client is null (no throw)

**index.test.ts** (5 new tests in "CONN-01: graceful shutdown" suite):
- shutdown() calls disconnect() on all services in Map
- shutdown() clears services Map after disconnecting
- shutdown() resolves even if disconnect() rejects
- shuttingDown flag is settable
- inFlightCount starts at 0

**Total tests after plan: 122 passing (up from 111)**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Verification

- `npx vitest run --reporter=verbose`: 122/122 tests pass
- `npx tsc --noEmit`: no type errors
- `src/index.ts` contains `private shuttingDown = false`, `private inFlightCount = 0`, `async shutdown(): Promise<void>`, `process.on('SIGTERM'`, `process.on('SIGINT'`, `timer.unref()`, `Server is shutting down`
- `src/protocol/imap.ts` contains `if (this.client.usable)` inside disconnect()

## Self-Check: PASSED

- src/protocol/imap.ts: FOUND (contains `if (this.client.usable)`)
- src/index.ts: FOUND (contains `async shutdown(): Promise<void>`, `shuttingDown`, `inFlightCount`, `SIGTERM`, `SIGINT`, `timer.unref()`)
- Commits 7e08a91 and 2c2471a: FOUND in git log
