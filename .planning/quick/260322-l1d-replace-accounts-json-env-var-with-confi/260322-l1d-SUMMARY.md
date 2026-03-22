---
phase: quick-260322-l1d
plan: "01"
subsystem: config
tags: [config, accounts, env-var-removal, file-based-config]
dependency_graph:
  requires: []
  provides: [accounts-config-file]
  affects: [src/config.ts, README.md]
tech_stack:
  added: []
  patterns: [file-based-config, node:fs-existsSync-readFileSync]
key_files:
  created:
    - src/config.test.ts
  modified:
    - src/config.ts
    - README.md
decisions:
  - "Use node:fs existsSync + readFileSync (not promises) for synchronous startup-time config read"
  - "Return [] with stderr warning (not throw) when file absent or JSON invalid — fail-open for graceful degradation"
  - "Remove dotenv entirely — SERVICE_NAME and LOG_LEVEL have schema defaults, only ACCOUNTS_JSON was user-facing"
metrics:
  duration: "85s"
  completed_date: "2026-03-22"
  tasks_completed: 3
  files_changed: 3
---

# Phase quick-260322-l1d Plan 01: Replace ACCOUNTS_JSON with accounts.json config file

**One-liner:** File-based account config via `~/.config/mail-mcp/accounts.json` replaces the ACCOUNTS_JSON env var that was awkward in JSON-in-JSON MCP client configs.

## What Was Built

`getAccounts()` in `src/config.ts` now reads from `~/.config/mail-mcp/accounts.json` using built-in Node.js modules (`node:fs`, `node:path`, `node:os`). The function signature and return type are unchanged — all callers continue to work without modification. dotenv was removed since ACCOUNTS_JSON was the only user-facing env var it served.

MCP client configs in README no longer require an `env` block at all — users set up accounts once in the config file and the server reads it on startup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace getAccounts() to read from config file | b814d31 | src/config.ts |
| 2 | Add config.test.ts unit tests | f2b3aaf | src/config.test.ts |
| 3 | Update README for config file approach | d066b29 | README.md |

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npx vitest run` — 58/58 tests pass across 7 test files
- `grep -r "ACCOUNTS_JSON" README.md src/` — no matches
- `grep "dotenv" src/config.ts` — no matches

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/config.ts: file exists and reads from accounts.json path
- src/config.test.ts: file created with 3 unit tests (all passing)
- README.md: updated with config file approach, no ACCOUNTS_JSON references
- Commits b814d31, f2b3aaf, d066b29: all exist in git log
