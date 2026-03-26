---
phase: 22
plan: 01
subsystem: imap-tools
tags: [mailbox-stats, imap, status, read-only]
dependency_graph:
  requires: [imap-client, mail-service]
  provides: [mailbox_stats-tool]
  affects: [src/protocol/imap.ts, src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [IMAP-STATUS-command, parallel-Promise.all, per-folder-error-isolation]
key_files:
  created:
    - .planning/phases/22-mailbox-stats/22-CONTEXT.md
    - .planning/phases/22-mailbox-stats/22-01-PLAN.md
    - .planning/phases/22-mailbox-stats/22-01-SUMMARY.md
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/protocol/imap.test.ts
    - src/services/mail.test.ts
    - src/index.test.ts
decisions:
  - MailboxStatus interface lives in imap.ts alongside other IMAP primitives
  - STATUS queries parallelized with Promise.all for performance
  - Per-folder error isolation — one bad folder doesn't fail the whole response
  - getMailboxStats() auto-discovers all folders via listFolders() when none specified
  - Formatted table output (padded columns) for human-readable LLM display
metrics:
  duration_seconds: 380
  completed_date: "2026-03-26"
  tasks_completed: 5
  files_modified: 6
---

# Phase 22 Plan 01: Mailbox Stats Tool Summary

**One-liner:** IMAP STATUS-based mailbox_stats tool returning total/unread/recent per folder with per-folder error isolation and auto-discovery of all folders.

## What Was Built

Added a `mailbox_stats` read-only MCP tool that uses the IMAP `STATUS` command to return message counts for one or more folders without listing individual emails.

### Components

**`ImapClient.getMailboxStatus(folders: string[]): Promise<MailboxStatus[]>`** (`src/protocol/imap.ts`)
- New `MailboxStatus` interface: `{ name, total, unread, recent, error? }`
- Parallelized with `Promise.all()` — queries all folders simultaneously
- Per-folder try/catch: failures return `{ total: null, unread: null, recent: null, error: "..." }` without breaking other folders

**`MailService.getMailboxStats(folders?: string[]): Promise<MailboxStatus[]>`** (`src/services/mail.ts`)
- When `folders` is undefined or empty, calls `listFolders()` first and runs stats on all folders
- Delegates to `imapClient.getMailboxStatus(targetFolders)`

**`mailbox_stats` tool** (`src/index.ts`)
- Registered with `readOnlyHint: true, destructiveHint: false`
- Input: `accountId` (required), `folders` (optional array)
- Output: formatted ASCII table with `Folder | Total | Unread | Recent` columns
- Handlers added to both `dispatchTool()` and `setupToolHandlers()`

### Tool Output Example

```
Folder            | Total | Unread | Recent
------------------|-------|--------|-------
INBOX             |  1024 |      5 |      2
Sent              |   312 |      0 |      0
Drafts            |     3 |      3 |      0
```

## Test Coverage

- 4 `ImapClient.getMailboxStatus` tests in `src/protocol/imap.test.ts`
- 4 `MailService.getMailboxStats` tests in `src/services/mail.test.ts`
- 5 `mailbox_stats` dispatch tests in `src/index.test.ts`
- Total: 281 passing tests (up from 265 before this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check

### Files Exist

- [x] `src/protocol/imap.ts` — MailboxStatus interface + getMailboxStatus method present
- [x] `src/services/mail.ts` — getMailboxStats method present
- [x] `src/index.ts` — mailbox_stats tool registered and dispatched

### Commits Exist

- `4633d04` — test(22-01): add failing tests for mailbox_stats tool (TDD RED)
- `e7e8370` — feat(22-01): implement mailbox_stats tool with IMAP STATUS command

## Self-Check: PASSED
