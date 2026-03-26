---
phase: "20"
plan: "01"
subsystem: "smtp,mail-service,mcp-tools"
tags: ["threading", "reply", "forward", "rfc2822", "smtp", "tdd"]
dependency_graph:
  requires: []
  provides: ["reply_email-tool", "forward_email-tool", "smtp-extra-headers"]
  affects: ["src/protocol/smtp.ts", "src/services/mail.ts", "src/index.ts"]
tech_stack:
  added: []
  patterns: ["RFC 2822 In-Reply-To/References threading", "extraHeaders on SMTP send"]
key_files:
  created: []
  modified:
    - "src/protocol/smtp.ts"
    - "src/services/mail.ts"
    - "src/index.ts"
    - "src/protocol/smtp.test.ts"
    - "src/services/mail.test.ts"
    - "src/index.test.ts"
decisions:
  - "SmtpClient.send() extended with optional extraHeaders: Record<string, string> as 7th param (backward-compatible)"
  - "replyEmail() uses _cachedFetchBody() internally — reuses body cache from Phase 18"
  - "forwardEmail() does not set In-Reply-To/References — forwards break thread chain per convention"
  - "reply_email to address auto-determined from original sender (not a required input param)"
  - "forward_email validates 'to' address via validateEmailAddresses before calling service"
  - "Test counts updated from 14 to 16 tools, write tools from 6 to 8 (deviation: auto-fix stale test expectations)"
metrics:
  duration_seconds: 415
  completed_date: "2026-03-26"
  tasks_completed: 4
  files_modified: 6
---

# Phase 20 Plan 01: Reply & Forward Threading Summary

## One-liner

RFC 2822 reply threading via In-Reply-To/References headers and Fwd: forwarding with original body inclusion, both saving to Sent via IMAP.

## What Was Built

### SmtpClient.send() — extraHeaders parameter (Task 1)
Added optional 7th parameter `extraHeaders?: Record<string, string>` to `SmtpClient.send()`.
When provided and non-empty, the headers are passed to nodemailer via `mailOptions.headers`.
Existing callers are unaffected (backward compatible).

### MailService.replyEmail() (Task 2)
New method `replyEmail(uid, folder, body, isHtml, cc, bcc, includeSignature)`:
- Fetches original message via `_cachedFetchBody()` (reuses Phase 18 cache)
- Extracts `messageId`, existing `References` header, original sender address, subject
- Sets `In-Reply-To: <messageId>` and `References: <existing> <messageId>` (appends to chain)
- Prepends "Re: " to subject (idempotent — does not double-prepend)
- Applies signature via `applySignature()`
- Sends via `SmtpClient.send()` with threading headers in `extraHeaders`
- Appends to Sent folder via `imapClient.appendMessage()`
- Handles missing messageId gracefully (sends without threading headers)

### MailService.forwardEmail() (Task 3)
New method `forwardEmail(uid, folder, to, body, isHtml, cc, bcc, includeSignature)`:
- Fetches original message via `_cachedFetchBody()`
- Prepends "Fwd: " to subject (idempotent)
- Builds a forwarded block with "--- Forwarded message ---" separator, original From/Date/Subject/To headers, and original body text
- Appends forwarded block to user's preamble body
- Does NOT set In-Reply-To/References (forwards break thread chain per convention)
- Applies signature, sends, saves to Sent folder

### MCP Tools: reply_email and forward_email (Task 4)
Both tools added to `WRITE_TOOLS` (blocked in read-only mode).

**reply_email** — requires `accountId`, `uid`, `body`; optional `folder`, `isHtml`, `cc`, `bcc`, `includeSignature`

**forward_email** — requires `accountId`, `uid`, `to`; optional `folder`, `body`, `isHtml`, `cc`, `bcc`, `includeSignature`

Handlers added to both `dispatchTool()` and `setupToolHandlers()`. `forward_email` validates the `to` address. Tool count updated from 14 to 16 (8 write, 8 read).

## Test Results

| Metric | Before | After |
|--------|--------|-------|
| Test files | 12 | 12 |
| Tests passing | 211 | 253 |
| Tests added | — | +42 |
| Failures | 0 | 0 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 01c4534 | test | add failing tests for SmtpClient.send() extraHeaders parameter |
| 2b121bd | feat | extend SmtpClient.send() with optional extraHeaders parameter |
| 42292c3 | test | add failing tests for MailService.replyEmail() |
| 2c17db6 | feat | implement MailService.replyEmail() with RFC 2822 threading headers |
| dabc516 | test | add failing tests for MailService.forwardEmail() |
| d4dc9a5 | feat | implement MailService.forwardEmail() |
| a1f0686 | test | add failing tests for reply_email and forward_email MCP tools |
| 48d6e31 | feat | add reply_email and forward_email MCP tool definitions and handlers |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale tool count expectations in existing tests**
- **Found during:** Task 4 GREEN phase
- **Issue:** `src/index.test.ts` had hardcoded `14` tool count and `6` write tool count from before Phase 20 additions
- **Fix:** Updated all stale count references (Test C, Test J, Test K, Test L, Test I, Test F descriptions) to reflect 16 total / 8 write tools
- **Files modified:** `src/index.test.ts`
- **Commit:** 48d6e31

**2. [Rule 1 - Bug] Case-sensitive string match in handler test**
- **Found during:** Task 4 GREEN phase
- **Issue:** Test expected `'reply'` (lowercase) but response text was `'Reply sent...'` (capitalized)
- **Fix:** Used `.toLowerCase()` in the assertion to make it case-insensitive
- **Files modified:** `src/index.test.ts`
- **Commit:** 48d6e31

## Known Stubs

None — all functionality is wired end-to-end. `replyEmail()` and `forwardEmail()` fetch real message data from IMAP, compute real RFC 2822 headers, and send via real SMTP with Sent folder append.

## Self-Check: PASSED

All 8 implementation commits verified present. All 6 modified files exist. 253/253 tests pass.
