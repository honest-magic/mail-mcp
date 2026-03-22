---
phase: 11-input-validation-safety-limits
plan: "02"
subsystem: dispatch-guards
tags: [validation, rate-limiting, attachment-guard, safety, tdd]
dependency_graph:
  requires: [11-01]
  provides: [VAL-02, SAFE-01, SAFE-03]
  affects: [src/index.ts, src/services/mail.ts, src/protocol/imap.ts]
tech_stack:
  added: []
  patterns:
    - "BODYSTRUCTURE-based size check before attachment download"
    - "Per-server AccountRateLimiter instance (not singleton)"
    - "Guard ordering: readOnly → rate-limit → email-validation → getService"
    - "try/finally lock release in all ImapClient methods"
key_files:
  created: []
  modified:
    - src/protocol/imap.ts
    - src/services/mail.ts
    - src/index.ts
    - src/protocol/imap.test.ts
    - src/services/mail.test.ts
    - src/index.test.ts
decisions:
  - "dispatchTool extended with send_email and create_draft handlers for full testability of guards"
  - "fetchOne returns false|FetchMessageObject — guard uses !msg || !(msg as any).bodyStructure to avoid TS overlap error"
  - "Rate limit test uses points:1 with send_email (fully handled in dispatchTool) instead of list_folders (stub)"
metrics:
  duration_seconds: 390
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 6
---

# Phase 11 Plan 02: Wire Dispatch Guards Summary

All three Phase 11 guards integrated into the actual request flow: rate limiting at tool dispatch, email validation before send/draft, and attachment size check before download.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Attachment size guard in ImapClient and MailService | ce97872 | src/protocol/imap.ts, src/services/mail.ts, src/protocol/imap.test.ts, src/services/mail.test.ts |
| 2 | Wire rate limiter and email validation into dispatch layer | d879c57 | src/index.ts, src/index.test.ts |

## What Was Built

**Task 1 — Attachment size guard:**
- `ImapClient.fetchAttachmentSize(uid, filename, folder)` added to `/Users/mis/dev/mail_mcp/src/protocol/imap.ts`
- Fetches BODYSTRUCTURE via `fetchOne`, walks `childNodes` tree recursively to find part matching `parameters.name` or `dispositionParameters.filename`
- Returns the byte size if found, `null` if BODYSTRUCTURE unavailable or no match
- `MailService.downloadAttachment` in `/Users/mis/dev/mail_mcp/src/services/mail.ts` checks size before content download — throws `ValidationError` for attachments > 50 MB
- `extractAttachmentText` gets the guard automatically (calls `downloadAttachment` internally)

**Task 2 — Rate limiter and email validation:**
- `AccountRateLimiter` instance added to `MailMCPServer` (per-server, not singleton)
- Rate limit guard fires BEFORE `getService` for all tools that have `accountId`
- `list_accounts` skipped (no accountId in args)
- `validateEmailAddresses` fires before SMTP/IMAP for `send_email` and `create_draft` in both `setupToolHandlers` and `dispatchTool`
- Guard ordering: readOnly → rate-limit → email-validation → getService → tool logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error in fetchAttachmentSize**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `fetchOne` return type is `false | FetchMessageObject` — accessing `.bodyStructure` on the `false` branch causes TS error TS2367
- **Fix:** Changed `!msg?.bodyStructure` to `!msg || !(msg as any).bodyStructure`, extracting `bodyStructure` via `(msg as any)` cast
- **Files modified:** src/protocol/imap.ts

**2. [Rule 2 - Adaptation] Rate limit test uses send_email instead of list_folders**
- **Found during:** Task 2 (test iteration)
- **Issue:** `dispatchTool` didn't have a `list_folders` handler — test calling it would get McpError(MethodNotFound), not a clean success on first call. Rate-limit test couldn't distinguish "first call passes" from "call fails for unrelated reason"
- **Fix:** Added `send_email` and `create_draft` handlers to `dispatchTool` (plan already required email validation there) and updated rate-limit test to use `send_email` with a valid email
- **Files modified:** src/index.ts, src/index.test.ts

## Success Criteria

- [x] `send_email` with invalid email returns `[ValidationError] Invalid email address(es): ...` without SMTP connection
- [x] `create_draft` with invalid email returns `[ValidationError]` without IMAP append
- [x] `get_attachment` for 50MB+ attachment returns `[ValidationError] Attachment "..." is X MB, which exceeds the 50 MB limit` without downloading
- [x] `get_attachment` for small attachment or null BODYSTRUCTURE proceeds normally
- [x] Tools with accountId are rate-limited; exceeding 1 req/60s returns `[QuotaError] Rate limit exceeded for account "..."`
- [x] `list_accounts` is never rate-limited
- [x] Full `npm test` suite passes (158 tests)
- [x] `npx tsc --noEmit` compiles clean

## Self-Check: PASSED

- src/protocol/imap.ts — FOUND
- src/services/mail.ts — FOUND
- src/index.ts — FOUND
- commit ce97872 — FOUND
- commit d879c57 — FOUND
