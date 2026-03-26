---
phase: 27
plan: 01
name: delete-email-tool
subsystem: imap-tools
tags: [delete, imap, tool, tdd]
dependency_graph:
  requires: []
  provides: [delete_email-tool]
  affects: [src/protocol/imap.ts, src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [TDD-red-green, cache-invalidation-on-mutate, write-tool-gating]
key_files:
  created:
    - src/protocol/imap.delete.test.ts
    - src/services/mail.delete.test.ts
    - .planning/phases/27-delete-email-tool/27-CONTEXT.md
    - .planning/phases/27-delete-email-tool/27-01-PLAN.md
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/index.test.ts
decisions:
  - "deleteMessage added to ImapClient as a named single-message method; delegates to messageDelete directly (not batchDeleteMessages) to keep single-message surface clean and independently testable"
  - "body cache invalidated after deletion via invalidateBodyCache — consistent with move_email pattern"
  - "delete_email added to WRITE_TOOLS set and blocked in read-only mode — consistent with all destructive tools"
  - "tool count assertions in index.test.ts updated to 29/14 (reflecting cumulative tool additions from phases 25-27)"
metrics:
  duration_minutes: 7
  completed_date: "2026-03-26"
  tasks_completed: 4
  files_changed: 6
---

# Phase 27 Plan 01: Delete Email Tool Summary

## One-Liner

Permanent single-message delete tool via IMAP with body-cache invalidation, TDD-driven, read-only mode gated.

## What Was Built

Added a `delete_email` MCP tool that permanently deletes a single email by UID from a specified IMAP folder:

1. **`ImapClient.deleteMessage(uid, folder)`** — direct IMAP delete using `messageDelete` with uid mode; distinct named method rather than wrapping `batchDeleteMessages`.

2. **`MailService.deleteEmail(uid, folder='INBOX')`** — service-layer method that calls the IMAP delete and then invalidates the in-memory body cache for that message (same pattern as `move_email`).

3. **`delete_email` MCP tool** — registered in `getTools()` and handled in both `dispatchTool()` and the `CallToolRequestSchema` handler. Annotated `readOnlyHint: false, destructiveHint: true`. Added to `WRITE_TOOLS` so it is blocked in read-only mode.

## Decisions Made

- `deleteMessage` implemented directly using `messageDelete` (not delegating to `batchDeleteMessages`) — cleaner single-message path without constructing a sequence string
- Cache invalidation after delete: consistent with the Phase 18 pattern used in `move_email`
- Tool description warns about irreversibility and suggests `move_email` to Trash for recovery

## Tests

| File | Tests | Status |
|------|-------|--------|
| `src/protocol/imap.delete.test.ts` | 3 | GREEN |
| `src/services/mail.delete.test.ts` | 3 | GREEN |
| Full suite (`npm test`) | 350/350 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tool count assertions in index.test.ts were stale**

- **Found during:** Task 3 (wiring delete_email in index.ts)
- **Issue:** Tests asserting `getTools(false)` count of 20/24/25 and `getTools(true)` count of 12/16 were stale relative to actual tool count (Phases 25 and 26 added Sieve filter and mark/star tools between Task 1 and Task 3 execution)
- **Fix:** Updated all count assertions in `ROM-05`, `ROM-06`, and `MARK-01` test groups to reflect actual counts (29 total tools, 14 read-only visible)
- **Files modified:** `src/index.test.ts`
- **Commit:** absorbed into `8358b3b`

## Known Stubs

None.

## Self-Check: PASSED
