---
phase: 04-efficiency-scale
plan: 01
subsystem: batch-operations
tags: [batch, imap, performance, scale]
dependency_graph:
  requires: [02-02]
  provides: [batch_operations_tool]
  affects: [src/protocol/imap.ts, src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [uid-sequence-batching, operation-routing, 100-uid-limit]
key_files:
  created: []
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
decisions:
  - "Use comma-joined UID sequences for imapflow batch IMAP operations (messageMove, messageDelete, messageFlagsAdd, messageFlagsRemove)"
  - "Enforce 100-UID limit in MailService.batchOperations as decided in Phase 4 planning"
  - "Return processed count from batchOperations for confirmation feedback"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-21"
  tasks: 3
  files: 3
---

# Phase 4 Plan 1: Batch Operations Summary

**One-liner:** IMAP batch move, delete, and label operations via comma-joined UID sequences with 100-email limit enforced at service layer.

## What Was Built

Added three batch IMAP methods to `ImapClient`, a unified `batchOperations` coordinator in `MailService`, and the `batch_operations` MCP tool in `src/index.ts`. AI agents can now move, delete, or modify labels on up to 100 emails in a single tool call.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add batch methods to ImapClient | ab9cd8c | src/protocol/imap.ts |
| 2 | Add batchOperations to MailService | c8d3251 | src/services/mail.ts |
| 3 | Register batch_operations MCP tool | 7cd4403 | src/index.ts |

## Key Implementation Details

**ImapClient batch methods** (`src/protocol/imap.ts`):
- `batchMoveMessages(uids, sourceFolder, targetFolder)`: joins UIDs with commas and calls `messageMove` with `{ uid: true }`
- `batchDeleteMessages(uids, folder)`: joins UIDs and calls `messageDelete` with `{ uid: true }`
- `batchModifyLabels(uids, folder, addLabels, removeLabels)`: joins UIDs and calls `messageFlagsAdd`/`messageFlagsRemove` with `{ uid: true }`
- Each method acquires a mailbox lock and releases it in a finally block, consistent with existing single-message methods

**MailService.batchOperations** (`src/services/mail.ts`):
- Accepts `uids: string[]`, `folder: string`, and a discriminated union `operation` type
- Validates: empty UIDs array rejected; >100 UIDs rejected with descriptive error
- Routes to the appropriate ImapClient batch method based on `operation.type`

**batch_operations MCP tool** (`src/index.ts`):
- Input schema: `accountId`, `uids` (string[]), `folder`, `action` (move/delete/label), plus optional `targetFolder`, `addLabels`, `removeLabels`
- Handler validates `targetFolder` presence for move action
- Returns human-readable confirmation with processed count

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all batch operations wire directly to live IMAP commands.

## Self-Check: PASSED
