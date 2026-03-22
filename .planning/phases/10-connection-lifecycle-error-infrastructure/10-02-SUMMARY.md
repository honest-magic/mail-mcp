---
phase: 10-connection-lifecycle-error-infrastructure
plan: "02"
subsystem: config-validation
tags: [zod, config, caching, fs-watch, async, validation]
dependency_graph:
  requires: [10-01]
  provides: [zod-account-schema, async-config-cache, fs-watch-invalidation]
  affects: [src/config.ts, src/types/index.ts, src/index.ts, src/cli/accounts.ts]
tech_stack:
  added: []
  patterns: [zod-safeParse-per-item, in-memory-cache-with-fs-watch, async-config-loading]
key_files:
  created:
    - src/config.test.ts (full rewrite for async API)
  modified:
    - src/config.ts
    - src/types/index.ts
    - src/index.ts
    - src/index.test.ts
    - src/cli/accounts.ts
key_decisions:
  - "emailAccountSchema and EmailAccount type live in src/config.ts to avoid circular imports; src/types/index.ts re-exports for backward compat"
  - "Per-item safeParse: one invalid account is logged and skipped without blocking valid accounts"
  - "resetConfigCache() exported for test isolation — internal only, not part of public API"
  - "watcherStarted flag prevents duplicate fs.watch() registrations across hot-reload scenarios"
  - "src/cli/accounts.ts call sites updated to await getAccounts() (Rule 3 auto-fix — TypeScript blocked without it)"
  - "vi.mock TDZ bug in index.test.ts auto-fixed: MailService factory made self-contained to avoid outer-scope variable references that are hoisted out of scope"
metrics:
  duration_seconds: 245
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 0
  files_modified: 5
requirements:
  - VAL-01
  - VAL-03
  - VAL-04
---

# Phase 10 Plan 02: Zod Config Validation and Async Cache Summary

**One-liner:** Zod emailAccountSchema with per-item safeParse, async getAccounts() with in-memory cache and fs.watch invalidation, all call sites updated to await.

## What Was Built

Added schema-based validation to account config loading. Every account entry is now validated individually — a malformed entry is logged with its account ID and the bad field name, then skipped, without blocking valid accounts. The config is cached in memory after first load and invalidated via `fs.watch()` when the accounts.json file changes on disk.

### Files Modified

- `/Users/mis/dev/mail_mcp/src/config.ts` — Added `emailAccountSchema` (Zod z.object), `EmailAccount` type (z.infer), in-memory `cachedAccounts` variable, `startWatcher()` using `fs.watch(ACCOUNTS_PATH)`, `loadAccountsFromDisk()` with per-item `safeParse`, and async `getAccounts()` that caches results. Added `resetConfigCache()` for test isolation.

- `/Users/mis/dev/mail_mcp/src/types/index.ts` — Replaced hand-written `EmailAccount` interface with `export type { EmailAccount } from '../config.js'` to use the Zod-inferred type. `AuthType` and `Credentials` remain unchanged.

- `/Users/mis/dev/mail_mcp/src/index.ts` — Updated three `getAccounts()` call sites to `await getAccounts()`: `getService()`, `dispatchTool()` list_accounts branch, `setupToolHandlers()` list_accounts branch.

- `/Users/mis/dev/mail_mcp/src/index.test.ts` — Updated `getAccounts` mock from `mockReturnValue([])` to `mockResolvedValue([])`. Also fixed pre-existing TDZ bug in `vi.mock('./services/mail.js')` factory.

- `/Users/mis/dev/mail_mcp/src/cli/accounts.ts` — Updated three `getAccounts()` call sites to `await getAccounts()`: `listAccounts()`, `removeAccount()`, `addAccount()`.

### Tests Rewritten

- `/Users/mis/dev/mail_mcp/src/config.test.ts` — Fully rewritten for the new async API. Mocks `node:fs/promises` for `readFile` and `node:fs` for `watch`. 10 tests covering: schema validation (valid, missing field, invalid authType, optional smtpPort), async getAccounts (empty file, per-item skipping, error messages with account ID and "(unknown)", caching, fs.watch invalidation).

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | Failing tests for emailAccountSchema, async getAccounts, cache | f8f5590 |
| 1 (GREEN) | Zod schema, async getAccounts, in-memory cache, fs.watch | 2c2a60f |
| 2 | Update all getAccounts() call sites to await | 1271d9b |

## Verification Results

- `npx vitest run src/config.test.ts` — 10/10 tests pass
- `npx vitest run --reporter=verbose` — 122/122 tests pass (0 failures)
- `npx tsc --noEmit` — no type errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated getAccounts() call sites in src/cli/accounts.ts**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** TypeScript reported errors on all 3 call sites in `src/cli/accounts.ts` — `listAccounts()`, `removeAccount()`, `addAccount()` — because they called the now-async `getAccounts()` without await
- **Fix:** Added `await` to all 3 call sites; all functions are already async so no signature changes needed
- **Files modified:** src/cli/accounts.ts
- **Commit:** 1271d9b

**2. [Rule 1 - Bug] Fixed TDZ bug in vi.mock factory for MailService in src/index.test.ts**
- **Found during:** Task 2 test run
- **Issue:** `vi.mock('./services/mail.js')` factory referenced `mockDisconnect` which is declared after the mock (vi.mock is hoisted above all variable declarations). This caused 3 CONN-01 shutdown tests to fail with "is not a constructor" and a TDZ/undefined reference.
- **Fix:** Rewrote the factory as a self-contained function with its own `vi.fn()` declarations (no outer-scope references). Removed the outer `mockDisconnect` variable reference inside the factory.
- **Files modified:** src/index.test.ts
- **Commit:** 1271d9b

## Known Stubs

None — no stub values or placeholder data in any created/modified files.

## Self-Check: PASSED

Created/modified files:
- [x] src/config.ts — emailAccountSchema, async getAccounts, cachedAccounts, fs.watch, safeParse, "skipped — invalid fields:" message
- [x] src/types/index.ts — export type { EmailAccount } from '../config.js'
- [x] src/config.test.ts — 10 tests, all passing
- [x] src/index.ts — 3x await getAccounts()
- [x] src/index.test.ts — mockResolvedValue, fixed TDZ bug
- [x] src/cli/accounts.ts — 3x await getAccounts()

Commits:
- [x] f8f5590 (RED tests — failing)
- [x] 2c2a60f (GREEN implementation)
- [x] 1271d9b (Task 2 + Rule 1/3 auto-fixes)
