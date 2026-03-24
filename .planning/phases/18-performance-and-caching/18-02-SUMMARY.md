---
phase: 18-performance-and-caching
plan: "02"
subsystem: services
tags: [cache, performance, imap, mail-service]
dependency_graph:
  requires: [MessageBodyCache (18-01)]
  provides: [MailService with body caching, invalidateBodyCache]
  affects: [src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [cache-aside (check cache, populate on miss), invalidation on mutation]
key_files:
  created: []
  modified:
    - src/services/mail.ts
    - src/index.ts
decisions:
  - "invalidateBodyCache placed as public method on MailService (not on ImapClient) since the cache is owned by MailService"
  - "No try/catch around invalidateBodyCache call — in-memory delete cannot throw; best-effort is correct"
  - "_cachedFetchBody is private; cache key format matches D-01: accountId:folder:uid"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 18 Plan 02: Wire MessageBodyCache into MailService Summary

**One-liner:** Cache-aside pattern wired into MailService — readEmail and downloadAttachment skip IMAP on repeat calls; move_email invalidates stale entries.

## What Was Built

### Task 1 — Cache integration in `src/services/mail.ts`

- Imported `MessageBodyCache` and `ParsedMail` type
- Added `private readonly bodyCache = new MessageBodyCache()` — scoped per MailService instance (per account)
- Added `private async _cachedFetchBody(uid, folder)`: builds key `accountId:folder:uid`, returns cached `ParsedMail` on hit, fetches from IMAP and populates cache on miss
- Replaced `this.imapClient.fetchMessageBody(...)` in both `readEmail()` and `downloadAttachment()` with `this._cachedFetchBody(...)`
- Added `public invalidateBodyCache(folder, uid)` — deletes the cache entry for that key

### Task 2 — Invalidation in `src/index.ts`

- Added `service.invalidateBodyCache(args.sourceFolder, args.uid)` in the `move_email` handler immediately after `await service.moveMessage(...)` succeeds
- Prevents stale cached body from being served after the message no longer exists in `sourceFolder`

## Behavior After This Plan

- First `read_email` for a UID fetches from IMAP and caches the `ParsedMail`
- Subsequent `read_email` or `download_attachment` for the same UID+folder returns immediately from cache (no IMAP round-trip) for up to 5 minutes
- `move_email` removes the cache entry; subsequent read triggers a fresh IMAP fetch in the new location

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `grep "import.*MessageBodyCache" src/services/mail.ts` — line 6
- [x] `grep "private readonly bodyCache" src/services/mail.ts` — line 33
- [x] `grep "_cachedFetchBody" src/services/mail.ts` — lines 120, 134, 204
- [x] `grep "invalidateBodyCache" src/services/mail.ts` — line 129
- [x] `grep "fetchMessageBody" src/services/mail.ts` only in `_cachedFetchBody` (line 124) — not in readEmail or downloadAttachment
- [x] `grep "invalidateBodyCache" src/index.ts` — line 594 (move_email handler)
- [x] `tsc --noEmit` exits 0
- [x] `npm test` — 206/206 tests pass
- [x] Commits: 8a662a8 (Task 1), 5927bf1 (Task 2)
