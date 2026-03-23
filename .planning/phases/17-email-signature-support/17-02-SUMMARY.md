---
phase: 17-email-signature-support
plan: 02
subsystem: api
tags: [email, smtp, imap, signature, nodemailer]

# Dependency graph
requires:
  - phase: 17-email-signature-support
    plan: 01
    provides: "emailAccountSchema.signature field and includeSignature tool schema params"
provides:
  - "applySignature() pure helper exported from src/services/mail.ts"
  - "sendEmail() and createDraft() accept and apply includeSignature parameter"
  - "Tool handlers in index.ts pass includeSignature through to MailService"
affects: [any phase touching send_email or create_draft tool handlers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RFC 3676 sig delimiter: \\n-- \\n separates body from plain-text signature"
    - "HTML signature wrapper: <p style=white-space:pre-line> preserves line breaks"
    - "Default-true via !== false pattern: args.includeSignature !== false handles undefined/true/false"

key-files:
  created: []
  modified:
    - src/services/mail.ts
    - src/index.ts
    - src/services/mail.test.ts

key-decisions:
  - "applySignature exported (not private) to enable direct unit testing of the pure function"
  - "isHtml default value false is passed through to smtpClient.send() — tests match actual call args"

patterns-established:
  - "Default boolean: use !== false rather than === true to treat missing field as opt-in"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 17 Plan 02: Email Signature Support — Append Logic Summary

**`applySignature()` helper wires RFC 3676 plain-text and HTML signature append into sendEmail/createDraft, controlled by per-call `includeSignature` boolean (default true)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T20:46:01Z
- **Completed:** 2026-03-23T20:49:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented `applySignature()` pure helper: plain text gets `\n-- \n` RFC 3676 separator; HTML gets `<br><br><p style="white-space: pre-line">` wrapper
- Updated `sendEmail()` and `createDraft()` to apply helper before SMTP send and IMAP append respectively
- Wired `args.includeSignature !== false` through tool handlers in index.ts (handles undefined = true, false = false, true = true)
- 18 unit tests all passing; full suite 191/191

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for applySignature** - `f438cf3` (test)
2. **Task 1: applySignature helper + sendEmail/createDraft updates** - `05a25f1` (feat)
3. **Task 2: Wire includeSignature through tool handlers** - `e5e5e17` (feat)

_Note: TDD task has RED commit (f438cf3) followed by GREEN implementation (05a25f1)_

## Files Created/Modified

- `src/services/mail.ts` - Added exported `applySignature()` helper; updated `sendEmail()` and `createDraft()` signatures with `includeSignature: boolean = true` param
- `src/index.ts` - Updated `send_email` and `create_draft` handlers to extract `includeSignature` and pass to MailService
- `src/services/mail.test.ts` - Added 9 new tests: 6 for `applySignature` pure function, 3 for `sendEmail` with signature, 2 for `createDraft` with signature

## Decisions Made

- Exported `applySignature` from `mail.ts` rather than keeping it private, enabling direct unit testing of the pure function
- Test assertions updated to match actual call arguments (`false` not `undefined` for `isHtml` default) — caught during TDD GREEN phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Minor test fix during TDD GREEN: initial `sendEmail` test expectations used `undefined` for the `isHtml` argument but the method passes its actual default value `false` to `smtpClient.send()`. Corrected expectations to match the real contract.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 17 complete: signature field in config, tool schemas updated (plan 01), append logic wired (plan 02)
- Accounts with a `signature` field in accounts.json will now have it appended automatically
- AI agents can suppress signature per-message with `includeSignature: false`

---
*Phase: 17-email-signature-support*
*Completed: 2026-03-23*
