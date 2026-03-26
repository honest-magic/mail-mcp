---
phase: 29
plan: "01"
title: "Confirmation Mode — Two-step write safety gate"
subsystem: server
tags: [confirmation, safety, write-tools, cli-flag]
dependency_graph:
  requires: []
  provides: [confirmation-gate, confirmation-store]
  affects: [index.ts, all-write-tools]
tech_stack:
  added: [ConfirmationStore]
  patterns: [two-step-confirmation, in-memory-ttl-store, cli-flag]
key_files:
  created:
    - src/utils/confirmation-store.ts
    - src/utils/confirmation-store.test.ts
    - src/index.confirm.test.ts
    - .planning/phases/29-confirmation-mode/CONTEXT.md
    - .planning/phases/29-confirmation-mode/29-01-PLAN.md
  modified:
    - src/index.ts
decisions:
  - "confirmMode as 4th constructor param (after readOnly, allowedTools, auditLogger) to preserve backward compat"
  - "ConfirmationStore uses confirmMode_ field naming in class (avoids collision with pre-applied stash)"
  - "PendingConfirmation stored with { toolName, args, createdAt, ttlMs } — args is a copy (not reference)"
  - "buildConfirmationDescription() is module-level function for testability"
  - "confirmationId stripped from args before replay on second call"
  - "All 15 WRITE_TOOLS have optional confirmationId in inputSchema; read tools do not"
metrics:
  duration: "18 minutes"
  completed_date: "2026-03-26"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 29 Plan 01: Confirmation Mode Summary

Optional `--confirm` mode: write tools return a `confirmationRequired` response on first call. The AI presents the confirmation prompt to the user, who approves. The AI re-calls with `confirmationId` to execute. Pending confirmations expire after 5 minutes.

## What Was Built

### ConfirmationStore (`src/utils/confirmation-store.ts`)
- `CONFIRMATION_TTL_MS = 5 * 60 * 1000` (5 minutes)
- `create(toolName, args): string` — stores confirmation, returns `crypto.randomUUID()`
- `consume(id): PendingConfirmation | undefined` — single-use, validates TTL
- Lazy eviction on `consume()` — consistent with `MessageBodyCache` pattern
- Constructor-injectable TTL for predictable tests

### Confirmation Gate in MailMCPServer (`src/index.ts`)
- `confirmMode: boolean` field + 4th constructor parameter (default `false`)
- `confirmStore: ConfirmationStore` instance
- Gate applied in BOTH `dispatchTool()` and `setupToolHandlers()` (CallToolRequestSchema)
- First call (no `confirmationId`): stores pending confirmation, returns JSON:
  ```json
  {
    "confirmationRequired": true,
    "action": "send_email",
    "description": "Send email to alice@example.com with subject 'Hi'",
    "confirmationId": "uuid-v4",
    "expiresIn": "5 minutes"
  }
  ```
- Second call (with valid `confirmationId`): consumes token, strips it from args, executes
- Invalid/expired token: returns `{ isError: true, text: "Confirmation token invalid or expired..." }`

### Tool Schema Updates
All 15 write tools gained optional `confirmationId` property in `inputSchema.properties`.
Read tools are unaffected.

### CLI Integration
- `--confirm` flag added to `parseArgs` in `main()`
- Help text updated to document the flag
- Server instructions mention confirmation mode when active

## Tests
- **`src/utils/confirmation-store.test.ts`**: 15 tests — create/consume round-trip, TTL expiry, size semantics, PendingConfirmation interface
- **`src/index.confirm.test.ts`**: 19 tests — constructor, instructions, schema validation, first/second call flows, invalid token rejection, read tool passthrough, description format

## Deviations from Plan

**[Rule 3 - Blocking] Pre-applied phase 28/30 stash in index.ts**

The `aa0eb08` commit that preceded this phase already contained the `confirmMode` fields and gate logic in `index.ts` (applied from a stash alongside phase 28 audit logging and phase 30 allowlist). Field naming was already `confirmMode` (not `confirmMode_`). Tests were written against the actual field names. All code was verified working — no rework needed.

**[Rule 2 - Missing] Audit logging in dispatchTool**

Phase 28 audit logging `finally` block in `dispatchTool` was uncommitted. Committed alongside this phase as `feat(28-01)` to keep the tree clean.

## Self-Check: PASSED

- src/utils/confirmation-store.ts: FOUND
- src/utils/confirmation-store.test.ts: FOUND
- src/index.confirm.test.ts: FOUND
- commit 21ed456 (ConfirmationStore): FOUND
- commit 8a96076 (confirm gate + tests): FOUND
- npm test: 441 passed, 0 failed
