---
phase: 12-pagination-health-check-reconnect
plan: "01"
subsystem: imap-pagination
tags: [pagination, imap, offset, tools]
dependency_graph:
  requires: []
  provides: [offset-pagination-list-emails, offset-pagination-search-emails]
  affects: [src/protocol/imap.ts, src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [cursor-pagination-via-offset, imapflow-sequence-range, uid-array-slicing]
key_files:
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/protocol/imap.test.ts
    - src/index.test.ts
decisions:
  - "Pagination uses offset (skip-newest) pattern: end=total-offset, start=max(1,end-count+1) for sequence ranges; end=len-offset, start=max(0,end-count) for UID slicing"
  - "Added list_emails/search_emails branches to dispatchTool to allow direct offset pass-through in unit tests"
metrics:
  duration_seconds: 160
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 5
requirements_covered:
  - QUAL-01
---

# Phase 12 Plan 01: Pagination (offset parameter) Summary

**One-liner:** Offset-based pagination for list_emails and search_emails via imapflow sequence range math and UID array slicing.

## What Was Built

Added an optional `offset` parameter (default: 0) to the `list_emails` and `search_emails` MCP tools, enabling cursor-style pagination through large mailboxes without re-fetching earlier messages.

### Implementation

**`src/protocol/imap.ts` — `listMessages(folder, count, offset=0)`:**
- Computes `end = total - offset`
- Guards: `if (end < 1) return []` (offset past end of mailbox)
- Computes `start = Math.max(1, end - count + 1)`
- Fetches range `${start}:${end}` (fixed endpoint instead of `*`)

**`src/protocol/imap.ts` — `searchMessages(criteria, folder, count, offset=0)`:**
- Sorts UIDs ascending before slicing
- Guards: `if (offset >= uidsArray.length) return []`
- Computes `end = uidsArray.length - offset`, `start = Math.max(0, end - count)`
- Fetches `uidsArray.slice(start, end).join(',')` instead of `slice(-count)`

**`src/services/mail.ts`:**
- `listEmails(folder, count, offset=0)` passes offset through to `listMessages`
- `searchEmails(query, folder, count, offset=0)` passes offset through to `searchMessages`

**`src/index.ts`:**
- Added `offset` property to `list_emails` and `search_emails` tool inputSchemas
- Updated type casts in `setupToolHandlers` dispatch blocks to include `offset?: number`
- Added `list_emails` and `search_emails` branches to `dispatchTool` (previously missing) to pass offset through

## Tests Added

**`src/protocol/imap.test.ts` — `describe('pagination')`:** 7 new tests
- listMessages offset=0 backward compat (range '46:50')
- listMessages offset=10, count=5, total=50 → range '36:40'
- listMessages offset >= total → []
- listMessages near-end offset clamps start to 1 → range '1:2'
- searchMessages offset=0 backward compat → UIDs '6,7'
- searchMessages offset=3, count=2, uids=[1..7] → UIDs '3,4'
- searchMessages offset >= uids.length → []

**`src/index.test.ts` — `describe('QUAL-01: pagination offset parameter')`:** 4 new tests
- list_emails tool schema has offset property
- search_emails tool schema has offset property
- dispatchTool list_emails passes offset to service.listEmails
- dispatchTool search_emails passes offset to service.searchEmails

**Full suite: 169 tests passing (was 158).**

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing Feature] Added list_emails/search_emails branches to dispatchTool**
- **Found during:** Task 2 — the pagination tests call `dispatchTool` directly to verify offset pass-through, but `dispatchTool` had no `list_emails` or `search_emails` handling (those only existed in `setupToolHandlers`)
- **Fix:** Added both branches to `dispatchTool` with offset support, making the method consistent with the request handler and enabling direct testing
- **Files modified:** `src/index.ts`
- **Commit:** e374fce

## Known Stubs

None — all offset parameters are wired through all layers.

## Self-Check: PASSED
