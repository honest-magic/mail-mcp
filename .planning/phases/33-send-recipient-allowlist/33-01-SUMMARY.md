---
phase: 33
plan: 01
name: Send Recipient Allowlist
subsystem: validation
tags: [security, validation, allowlist, recipients]
dependency_graph:
  requires: []
  provides: [validateRecipients, allowedRecipients-config-field]
  affects: [send_email, create_draft, reply_email, forward_email]
tech_stack:
  added: []
  patterns: [TDD red-green, allowlist-by-domain-or-address]
key_files:
  created: []
  modified:
    - src/utils/validation.ts
    - src/utils/validation.test.ts
    - src/config.ts
    - src/index.ts
decisions:
  - validateRecipients receives recipients as Array<string|undefined> matching pattern of validateEmailAddresses
  - Domain pattern matching uses @domain suffix check (address ends with the pattern)
  - reply_email skips 'to' validation — AI cannot control the auto-determined reply-to address
  - allowlist guard placed after format validation so format errors surface first
  - Empty allowlist (absent or []) means no restriction — backward compatible
metrics:
  duration_seconds: 251
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_modified: 4
---

# Phase 33 Plan 01: Send Recipient Allowlist Summary

**One-liner:** Optional per-account allowedRecipients allowlist (exact addresses or @domain patterns) enforced on send_email, create_draft, reply_email, and forward_email before any SMTP/IMAP I/O.

## What Was Built

Added a recipient allowlist safety feature to prevent AI agents from sending emails to unintended recipients. When `allowedRecipients` is configured on an account, every outbound email is validated against that list before sending.

### Key Components

1. **`validateRecipients()` utility** (`src/utils/validation.ts`) — New exported function that:
   - Accepts an array of recipient fields (may be undefined or comma-separated strings)
   - Parses each field using the shared `extractAddresses()` helper (handles angle-bracket format)
   - Checks each address against exact matches (case-insensitive) or domain patterns (`@example.com`)
   - Throws `ValidationError` with message: `"Recipient {addr} is not in the allowed recipients list for account {id}"`
   - No-ops when allowlist is empty (backward compatible)

2. **`allowedRecipients` config field** (`src/config.ts`) — Added `allowedRecipients: z.array(z.string()).optional()` to `emailAccountSchema`. Field is optional so existing accounts.json files continue to work without modification.

3. **Allowlist guard in `dispatchTool()`** (`src/index.ts`) — After existing email format validation, fetches the account and calls `validateRecipients` for:
   - `send_email` — validates to, cc, bcc
   - `create_draft` — validates to, cc, bcc
   - `forward_email` — validates to, cc, bcc
   - `reply_email` — validates cc, bcc only (to is auto-determined from original sender)

## Decisions Made

- **validateRecipients receives `Array<string|undefined>`** — mirrors the variadic pattern of `validateEmailAddresses`, making call sites clean.
- **Domain match uses `@` prefix** — `"@example.com"` in the allowlist matches any address whose domain portion equals `example.com`. This is the natural convention users expect.
- **reply_email skips `to` validation** — The `to` for a reply is extracted from the original message's From header; the AI cannot control it. Validating it would cause false rejections when replying to external senders before allowlisting them.
- **Guard placed after format validation** — If an address is syntactically invalid, that error surfaces first (more informative). The allowlist check only runs on syntactically valid addresses.
- **Empty allowlist = no restriction** — Accounts without `allowedRecipients` or with `[]` behave exactly as before. No migration needed.

## Deviations from Plan

None — plan executed exactly as written.

## Tests Added

13 new test cases in `src/utils/validation.test.ts`:
- Throws ValidationError for non-allowlisted address
- Error message includes blocked address and account ID
- Exact address match (plain and case-insensitive)
- Domain pattern match
- All-recipients-allowed passes
- Empty recipients array no-ops
- Undefined recipients no-ops
- Comma-separated multi-address validation
- Angle-bracket format (allowed and blocked)
- Empty allowlist = no restriction
- Exact error message format test

## Known Stubs

None.

## Self-Check: PASSED
