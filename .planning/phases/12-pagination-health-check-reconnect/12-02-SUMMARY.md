---
phase: 12-pagination-health-check-reconnect
plan: "02"
subsystem: connection-lifecycle
tags:
  - reconnect
  - health-check
  - imap
  - smtp
  - cli
dependency_graph:
  requires:
    - 12-01
  provides:
    - CONN-02
    - CONN-03
  affects:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
tech_stack:
  added: []
  patterns:
    - "close-event callback pattern for IMAP connection drop detection"
    - "one-retry with 1s backoff for transient connection failures"
    - "shuttingDown guard to prevent spurious reconnect during graceful shutdown"
    - "exported runValidateAccounts for testable health check CLI"
key_files:
  created: []
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/index.test.ts
    - src/protocol/imap.test.ts
decisions:
  - "Tested reconnect logic via vi.spyOn on _createAndCacheService rather than vi.mockImplementationOnce on MailService constructor (vitest 4 arrow factory not-a-constructor limitation)"
  - "Merged two reconnect error tests into one to avoid unhandled promise rejection from fake timers + mockRejectedValue interaction"
  - "Added once: vi.fn() to all 18 ImapFlow mock objects in imap.test.ts via Python script after adding close event registration in connect()"
metrics:
  duration_seconds: 513
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 5
---

# Phase 12 Plan 02: IMAP Reconnect + --validate-accounts Summary

IMAP auto-reconnect via ImapFlow close-event wiring and one-retry backoff in getService, plus a `--validate-accounts` CLI health check that probes IMAP/SMTP per account and exits.

## What Was Built

### Task 1: IMAP Reconnect via close-event + getService retry (CONN-02)

- `ImapClient.onClose`: Public nullable callback property. Registered as `once('close', ...)` listener on the inner ImapFlow after connect succeeds.
- `MailService.imap` getter: Exposes the private `imapClient` for close-listener wiring by `MailMCPServer`.
- `_createAndCacheService()`: New private method extracted from `getService()`. Creates, connects, and caches a `MailService`. Wires the close listener with a `shuttingDown` guard that prevents deletion during graceful shutdown.
- `getService()`: Retries once with 1s backoff if the first `_createAndCacheService` attempt fails. Throws `NetworkError` with message containing `"after reconnect attempt"` on double failure.

### Task 2: --validate-accounts health check CLI (CONN-03)

- `runValidateAccounts()`: Exported async function. Iterates all configured accounts, probes IMAP via `ImapClient.connect()/disconnect()`, and probes SMTP via `SmtpClient.connect()` (which internally calls `transporter.verify()` — the EHLO probe). Prints `[PASS]`, `[FAIL]`, or `[SKIP]` per account per protocol.
- `--validate-accounts` flag: Added to `parseArgs` in `main()`. When set, calls `runValidateAccounts()` and exits. Never starts the MCP server.
- No changes to `SmtpClient` — its existing `connect()` already performs the EHLO probe via `transporter.verify()`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a4e670a | feat(12-02): IMAP reconnect via close-event + getService retry |
| 2 | a2cc105 | feat(12-02): --validate-accounts health check CLI command |

## Test Results

- 177 tests passing (up from 169 in plan 12-01)
- 8 new tests added: 5 reconnect tests (CONN-02), 4 validate-accounts tests (CONN-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] imap.test.ts missing `once` method in ImapFlow mocks**
- **Found during:** Task 1 GREEN phase — 28 imap.test.ts tests failed after adding `this.client.once('close', ...)` in `connect()`
- **Issue:** All 18 `mockImplementationOnce` blocks in imap.test.ts returned mock ImapFlow objects without an `once()` method
- **Fix:** Added `once: vi.fn()` to the base module-level mock (already added) and to all 18 inline mock objects via Python script processing `imap.test.ts` lines
- **Files modified:** `src/protocol/imap.test.ts`
- **Commit:** a4e670a

**2. [Rule 1 - Bug] Test approach for close-event tests incompatible with vitest 4 mock behavior**
- **Found during:** Task 1 GREEN phase — `vi.mocked(MailService).mockImplementationOnce(() => ({...}))` threw "not a constructor" because vitest 4's mock system requires the implementation to be constructable with `new`
- **Fix:** Changed tests to inject fake services directly into `server.services` Map and use `vi.spyOn(server, '_createAndCacheService')` for retry/NetworkError tests — avoids the constructor mock limitation entirely
- **Files modified:** `src/index.test.ts`
- **Commit:** a4e670a

**3. [Rule 1 - Bug] consoleSpy.mockRestore() called before reading mock.calls**
- **Found during:** Task 2 GREEN phase — all validate-accounts tests showed empty output (consoleSpy.mock.calls was empty)
- **Fix:** Moved `consoleSpy.mockRestore()` after capturing `const output = consoleSpy.mock.calls.map(c => c[0])`
- **Files modified:** `src/index.test.ts`
- **Commit:** a2cc105

**4. [Rule 1 - Bug] Fake timer + mockRejectedValue interaction caused unhandled promise rejection**
- **Found during:** Task 1 — two separate NetworkError tests each caused an unhandled rejection because each test created a new promise that was rejected but partially unhandled after fake timer advance
- **Fix:** Merged the two tests into one, using `.catch()` to capture the error before `runAllTimersAsync()` drains the timer
- **Files modified:** `src/index.test.ts`
- **Commit:** a4e670a

## Known Stubs

None — all probe outputs are real function calls with real error messages. No placeholder data flows to any output.

## Self-Check: PASSED
