---
quick_id: 260321
slug: fix-audit-gaps
completed: "2026-03-21T18:36:29Z"
duration_approx: "~10 min"
tasks_completed: 3
files_modified:
  - src/services/mail.ts
  - src/protocol/imap.ts
commits:
  - "160c055: fix SMTP-04 rawMessage pre-build"
  - "5f671e6: fix THRD non-Gmail fallback + Message-ID in readEmail"
  - "63ed41d: fix IMAP-01 snippet population"
  - "6bf1e56: auto-fix TypeScript header search type"
---

# Quick Task 260321: Fix 3 Milestone Audit Gaps — Summary

**One-liner:** Fixed three v1.0 audit gaps — Sent-folder APPEND now uses pre-built rawMessage, fetchThreadMessages falls back to References/Message-ID on non-Gmail, and listMessages/searchMessages populate snippet from TEXT body part.

---

## Tasks Completed

### Task 1 — SMTP-04: Sent-folder APPEND (commit 160c055)

**Problem:** `sendEmail` accessed `info.message.toString()` but nodemailer's `SentMessageInfo` has no `.message` property. The TypeError was silently caught so `appendMessage` never ran.

**Fix:** Build the raw RFC-822 message string manually before calling `smtpClient.send()`, using the same `\r\n`-joined header approach already in `createDraft`. Pass that pre-built string directly to `appendMessage('Sent', ...)`.

**Files:** `src/services/mail.ts` lines 42-67

---

### Task 2 — THRD-01/02/03: Thread fallback for non-Gmail (commit 5f671e6)

**Fix A — `imap.ts`:** Changed the `x-gm-thrid` catch block to fall through instead of `return []`. After the block, if `uids` is still empty, attempt two header searches: `{ header: { References: threadId } }` and `{ header: { 'Message-ID': threadId } }`. Merge results with `Set` deduplication. Only return `[]` if the fallback also throws.

**Fix B — `mail.ts`:** After the existing `x-gm-thrid` expose, also extract `parsed.messageId` (with `parsed.headers.get('message-id')` as fallback) and append `**Message-ID:**` to the email header block. Non-Gmail callers now have a threadId value to pass to `get_thread`.

**Files:** `src/protocol/imap.ts` lines 146-168, `src/services/mail.ts` lines 113-121

---

### Task 3 — IMAP-01: Snippet field always empty (commit 63ed41d)

**Fix:** Added `bodyParts: ['TEXT']` to the `client.fetch()` call in both `listMessages` and `searchMessages`. After each message is fetched, extract `msg.bodyParts?.get('TEXT')` as a Buffer, decode to UTF-8, collapse whitespace with `/\s+/g`, slice to 200 chars, and trim. The `snippet` field in `fetchThreadMessages` remains `''` by design (THRD-03 token-efficiency: thread view is metadata-only).

**Files:** `src/protocol/imap.ts` lines 72-86, 104-117

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error in header search object**
- **Found during:** Task 2 — `npm run build` after commit
- **Issue:** `{ header: ['References', threadId] }` is not assignable to `{ [key: string]: string | boolean }` (imapflow `SearchObject.header` type)
- **Fix:** Changed to object form `{ header: { References: threadId } }` and `{ header: { 'Message-ID': threadId } }`
- **Files modified:** `src/protocol/imap.ts`
- **Commit:** 6bf1e56

---

## Verification

`npm run build` exits 0 with no TypeScript errors.

## Self-Check: PASSED

- src/services/mail.ts — FOUND
- src/protocol/imap.ts — FOUND
- Commit 160c055 — FOUND
- Commit 5f671e6 — FOUND
- Commit 63ed41d — FOUND
- Commit 6bf1e56 — FOUND
