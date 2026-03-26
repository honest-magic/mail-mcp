---
phase: 23
plan: 01
name: header-only-fetch
subsystem: imap-client
tags: [performance, imap, list-emails, header-only]
dependency_graph:
  requires: []
  provides: [header-only-list-emails]
  affects: [list-emails-tool, imap-client, mail-service]
tech_stack:
  added: []
  patterns: [optional-fetch-options, tdd-unit-tests]
key_files:
  created:
    - src/protocol/imap.headerOnly.test.ts
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/index.test.ts
decisions:
  - headerOnly defaults to false for full backward compatibility
  - snippet is always empty string when headerOnly=true (no special marker)
  - ImapClient.listMessages 4th param (not new method) keeps API surface minimal
  - dispatchTool and setupToolHandlers both updated for consistency
metrics:
  duration_seconds: 156
  completed_date: "2026-03-26"
  tasks_completed: 4
  files_modified: 5
---

# Phase 23 Plan 01: Header-Only Fetch Summary

## One-liner

`headerOnly=true` flag on `list_emails` skips IMAP `bodyParts: ['TEXT']` fetch, returning envelope metadata only — eliminates body download cost for inbox triage.

## What Was Built

Added a `headerOnly` boolean parameter (default `false`) to:

1. `ImapClient.listMessages(folder, count, offset, headerOnly=false)` — conditionally omits `bodyParts: ['TEXT']` from IMAP fetch options; `snippet` is always `''` when `true`
2. `MailService.listEmails(folder, count, offset, headerOnly=false)` — forwards flag to ImapClient
3. `list_emails` MCP tool schema — new optional `headerOnly` boolean field with documentation
4. Both dispatch paths (`dispatchTool` and `setupToolHandlers`) read and forward `args.headerOnly`

## Commits

- `c347db8` — feat(23-01): add headerOnly flag to ImapClient.listMessages (TDD RED+GREEN)
- `db55b5e` — feat(23-01): wire headerOnly through MailService and list_emails MCP tool

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing index.test.ts assertion for new 4-arg listEmails signature**
- **Found during:** Task 4
- **Issue:** `src/index.test.ts` line 721 asserted `listEmails` called with 3 args; new signature passes 4
- **Fix:** Changed `toHaveBeenCalledWith('INBOX', 5, 10)` to `toHaveBeenCalledWith('INBOX', 5, 10, false)`
- **Files modified:** `src/index.test.ts`
- **Commit:** db55b5e

## Known Stubs

None — all functionality is fully wired and tested.

## Test Results

302 tests passing, 0 failing.

New tests in `src/protocol/imap.headerOnly.test.ts` (5 tests):
- `headerOnly=false (default): fetch options include bodyParts TEXT and snippet is populated`
- `headerOnly=true: fetch options do NOT include bodyParts and snippet is empty string`
- `backward compat: calling with 3 args works like headerOnly=false`
- `headerOnly=true: returns correct metadata fields (subject, from, date, uid)`
- `headerOnly=false: snippet is empty string when bodyParts returns no TEXT`

## Self-Check: PASSED
