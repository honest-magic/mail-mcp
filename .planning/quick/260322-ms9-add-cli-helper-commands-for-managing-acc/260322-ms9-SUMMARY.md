---
phase: quick-260322-ms9
plan: 01
subsystem: cli
tags: [cli, accounts, keychain, config]
dependency_graph:
  requires: [src/config.ts, src/security/keychain.ts, src/types/index.ts]
  provides: [src/cli/accounts.ts]
  affects: [src/index.ts]
tech_stack:
  added: [node:readline/promises]
  patterns: [CLI subcommand dispatch, interactive prompts, keychain integration]
key_files:
  created:
    - src/cli/accounts.ts
    - src/cli/accounts.test.ts
  modified:
    - src/config.ts
    - src/index.ts
decisions:
  - "handleAccountsCommand returns boolean so entry point can decide to exit or continue to MCP server"
  - "ACCOUNTS_PATH exported from config.ts so CLI can display the config path in help output"
  - "process.exit called within CLI handlers (not returned to caller) for error cases"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-22"
  tasks_completed: 3
  files_changed: 4
---

# Phase quick-260322-ms9 Plan 01: Add CLI Helper Commands for Managing Accounts Summary

## One-liner

Interactive CLI subcommands (`accounts add|list|remove`) wiring readline prompts to accounts.json and macOS Keychain via a new `src/cli/accounts.ts` module.

## What Was Built

Added `mail-mcp accounts <add|list|remove>` CLI subcommands to the entry point:

- **`accounts list`** — prints a formatted table of configured accounts (id, name, host, user) or "No accounts configured." with the config file path
- **`accounts add`** — interactive readline prompt collects all `EmailAccount` fields, writes to `~/.config/mail-mcp/accounts.json`, stores password in macOS Keychain
- **`accounts remove <id>`** — removes account from JSON file and deletes keychain entry (warns if keychain entry missing but does not fail)
- **Entry point** — wrapped in `async main()`, checks for `accounts` subcommand before starting MCP server; `--read-only` still works as before

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create accounts CLI module + saveAccounts/ACCOUNTS_PATH in config | 9bd8100 |
| 2 | Wire CLI subcommand detection into src/index.ts entry point | a1dc28f |
| 3 | Add 13 unit tests for routing, list, and remove logic | 26f07bc |

## Verification Results

1. `npx tsc --noEmit` — passes (0 errors)
2. `node dist/index.js accounts list` — prints "No accounts configured." + config path
3. `node dist/index.js accounts` — prints usage + exits with code 1
4. All 71 tests pass (13 new + 58 pre-existing)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired to real config file and keychain.

## Self-Check: PASSED

- `/Users/mis/dev/mail_mcp/src/cli/accounts.ts` — FOUND
- `/Users/mis/dev/mail_mcp/src/cli/accounts.test.ts` — FOUND
- Commit 9bd8100 — FOUND
- Commit a1dc28f — FOUND
- Commit 26f07bc — FOUND
