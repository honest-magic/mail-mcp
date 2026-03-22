---
phase: 11-input-validation-safety-limits
verified: 2026-03-22T22:02:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 11: Input Validation & Safety Limits Verification Report

**Phase Goal:** Malformed inputs and resource-exhausting requests are rejected before any network I/O occurs
**Verified:** 2026-03-22T22:02:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `send_email` with invalid recipient returns ValidationError without SMTP connection | VERIFIED | `validateEmailAddresses` fires at line 487 of `src/index.ts`, before `getService` at line 488; index.test.ts lines 378-395 confirm `[ValidationError]` and `notanemail` in response |
| 2  | `create_draft` with invalid recipient returns ValidationError without IMAP append | VERIFIED | `validateEmailAddresses` fires at line 502 of `src/index.ts`, before `getService` at line 503; index.test.ts lines 406-428 confirm `[ValidationError]` |
| 3  | `get_attachment` for 50MB+ attachment returns ValidationError without downloading content | VERIFIED | `downloadAttachment` calls `fetchAttachmentSize` first (mail.ts line 156), throws `ValidationError` at line 158 before `fetchMessageBody`; mail.test.ts lines 65-103 confirm |
| 4  | `get_attachment` for small attachment or null BODYSTRUCTURE proceeds normally | VERIFIED | Guard condition `size != null && size > maxBytes` passes through both cases; mail.test.ts lines 105-128 confirm |
| 5  | Tool calls exceeding 100/60s for one account return QuotaError | VERIFIED | `rateLimiter.consume(accountId)` fires at index.ts line 321 (dispatchTool) and line 409 (setupToolHandlers); index.test.ts lines 446-475 confirm `[QuotaError]` |
| 6  | `list_accounts` is not rate-limited (no accountId) | VERIFIED | Rate limit guard keyed on `accountId` presence; `list_accounts` has no accountId in args; index.test.ts lines 478-487 confirm |
| 7  | `validateEmailAddresses` throws ValidationError for syntactically invalid addresses | VERIFIED | `EMAIL_RE` test at validation.ts line 29; validation.test.ts has 10 passing tests |
| 8  | `AccountRateLimiter.consume()` resolves under limit, throws QuotaError when exceeded | VERIFIED | rate-limiter.ts lines 39-52; rate-limiter.test.ts has 8 passing tests including per-account isolation |
| 9  | Rate limits are per-account (exhausting account A does not affect account B) | VERIFIED | `Map<string, RateLimiterMemory>` pattern in rate-limiter.ts line 18; rate-limiter.test.ts lines 60-69 confirm isolation |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/validation.ts` | Email address validation utility, exports `validateEmailAddresses` | VERIFIED | 38 lines; exports `validateEmailAddresses`, uses `EMAIL_RE`, handles angle-brackets, comma-separated, undefined fields |
| `src/utils/validation.test.ts` | Unit tests for email validation | VERIFIED | 53 lines, 10 tests covering all specified behaviors |
| `src/utils/rate-limiter.ts` | Per-account rate limiter, exports `AccountRateLimiter`, `DEFAULT_RATE_LIMIT_POINTS`, `DEFAULT_RATE_LIMIT_DURATION` | VERIFIED | 53 lines; `Map<string, RateLimiterMemory>` isolation, throws `QuotaError` with retry seconds |
| `src/utils/rate-limiter.test.ts` | Unit tests for rate limiter | VERIFIED | 77 lines, 8 tests including per-account isolation, custom limits, error message content |
| `src/protocol/imap.ts` | `fetchAttachmentSize()` BODYSTRUCTURE helper | VERIFIED | Method at lines 280-306; walks `childNodes` tree, checks `parameters.name` and `dispositionParameters.filename`, `try/finally` lock release |
| `src/services/mail.ts` | Size guard before attachment download | VERIFIED | `downloadAttachment` at lines 155-174; `fetchAttachmentSize` called before `fetchMessageBody`, throws `ValidationError` for size > 50MB |
| `src/index.ts` | Rate limiter and email validation wired at dispatch level | VERIFIED | `AccountRateLimiter` imported at line 15, instantiated at line 32; `rateLimiter.consume` at lines 321 and 409; `validateEmailAddresses` at lines 340, 487, 502 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/validation.ts` | `src/errors.ts` | `import ValidationError` | WIRED | Line 1: `import { ValidationError } from '../errors.js'` |
| `src/utils/rate-limiter.ts` | `src/errors.ts` | `import QuotaError` | WIRED | Line 2: `import { QuotaError } from '../errors.js'` |
| `src/utils/rate-limiter.ts` | `rate-limiter-flexible` | `import RateLimiterMemory` | WIRED | Line 1: `import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'` |
| `src/index.ts` | `src/utils/rate-limiter.ts` | `import AccountRateLimiter` | WIRED | Line 15: `import { AccountRateLimiter } from './utils/rate-limiter.js'` |
| `src/index.ts` | `src/utils/validation.ts` | `import validateEmailAddresses` | WIRED | Line 16: `import { validateEmailAddresses } from './utils/validation.js'` |
| `src/services/mail.ts` | `src/protocol/imap.ts` | `this.imapClient.fetchAttachmentSize()` | WIRED | `downloadAttachment` line 156 calls `this.imapClient.fetchAttachmentSize(uid, filename, folder)` |
| `src/services/mail.ts` | `src/errors.ts` | `throw new ValidationError` for oversized attachments | WIRED | Lines 5 and 158: imported and thrown with correct message format |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VAL-02 | 11-01-PLAN.md, 11-02-PLAN.md | Email addresses (to/cc/bcc) are validated as RFC 5322 format before SMTP send | SATISFIED | `validateEmailAddresses` implemented with `EMAIL_RE`; wired in `send_email` and `create_draft` handlers in both `setupToolHandlers` and `dispatchTool`; REQUIREMENTS.md checkbox marked `[x]` |
| SAFE-01 | 11-02-PLAN.md | Attachment download rejected with clear error when BODYSTRUCTURE size exceeds configurable limit (default 50MB) | SATISFIED | `fetchAttachmentSize` in ImapClient walks BODYSTRUCTURE tree; `downloadAttachment` rejects with `ValidationError` when `size > maxBytes` (default `50 * 1024 * 1024`); REQUIREMENTS.md checkbox marked `[x]` |
| SAFE-03 | 11-01-PLAN.md, 11-02-PLAN.md | Per-account in-memory rate limiter enforces sliding window limit (default 100 req/60s) | SATISFIED | `AccountRateLimiter` with `Map<string, RateLimiterMemory>` per-account isolation; wired as `private readonly rateLimiter` on `MailMCPServer`; fires before `getService`; REQUIREMENTS.md checkbox marked `[x]` |

No orphaned requirements: REQUIREMENTS.md traceability table maps VAL-02, SAFE-01, and SAFE-03 to Phase 11 — all three are claimed by plans and verified above.

### Anti-Patterns Found

No blockers or warnings found. Scan of phase-modified files:

- `src/utils/validation.ts` — No TODO/FIXME, no empty returns, no placeholder comments. `EMAIL_RE` is a ReDoS-safe pattern with no nested quantifiers.
- `src/utils/rate-limiter.ts` — No module-level singleton; class is instantiated per `MailMCPServer`. Per-account `Map` pattern confirmed.
- `src/protocol/imap.ts` (`fetchAttachmentSize`) — Lock acquired in method scope with `try/finally` release. Returns `null` gracefully when BODYSTRUCTURE unavailable (best-effort guard, not blocking).
- `src/services/mail.ts` (`downloadAttachment`) — Size check fires before `fetchMessageBody`. Guard is conditional (`size != null && size > maxBytes`), preserving pass-through for null BODYSTRUCTURE.
- `src/index.ts` — Rate limit guard fires before `getService` in both code paths (setupToolHandlers and dispatchTool). `list_accounts` correctly skipped (no accountId). Email validation fires before `getService` in `send_email` and `create_draft`.

### Human Verification Required

None. All three guards have dispatch-level integration tests in `src/index.test.ts` and unit tests in their respective test files. The guard ordering (before network I/O) is structurally verifiable from the source: `validateEmailAddresses` and `rateLimiter.consume` appear before `getService` calls in both handler paths.

### Commits Verified

| Commit | Content |
|--------|---------|
| `734053b` | Email validation utility with unit tests |
| `6c70548` | Per-account rate limiter with unit tests |
| `ce97872` | Attachment size guard in ImapClient and MailService |
| `d879c57` | Wire rate limiter and email validation into dispatch layer |

All four commits confirmed present in `git log`.

### Test Suite

```
npm test
Test Files  11 passed (11)
Tests       158 passed (158)

npx tsc --noEmit
(clean — no output)
```

---

_Verified: 2026-03-22T22:02:00Z_
_Verifier: Claude (gsd-verifier)_
