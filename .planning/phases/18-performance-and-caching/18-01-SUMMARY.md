---
phase: 18-performance-and-caching
plan: "01"
subsystem: utils
tags: [cache, performance, ttl, imap]
dependency_graph:
  requires: []
  provides: [MessageBodyCache]
  affects: [src/services/mail.ts]
tech_stack:
  added: []
  patterns: [TTL Map wrapper, oldest-first eviction via Map insertion order]
key_files:
  created:
    - src/utils/message-cache.ts
    - src/utils/message-cache.test.ts
  modified: []
decisions:
  - "TTL and maxSize injected via constructor (defaulting to constants) to allow test-time overrides without module-level mutation"
  - "size getter reports raw store count including stale entries — consistent with Map semantics and avoids O(n) scan on every size check"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 18 Plan 01: MessageBodyCache Utility Summary

**One-liner:** Zero-dependency in-memory TTL cache for parsed email bodies with oldest-first eviction at 100-entry capacity.

## What Was Built

`MessageBodyCache` — a self-contained class wrapping a `Map<string, CacheEntry>` with:

- **TTL expiry:** 5-minute default; checked lazily on `get()` — expired entries are deleted at read time, not on a background timer
- **Capacity bound:** 100 entries max; oldest entry (by insertion order, using `Map.keys().next()`) evicted before inserting at full capacity
- **Key reset on re-set:** `delete` before `set` moves re-inserted keys to newest position, resetting both TTL and eviction order
- **API:** `get(key)`, `set(key, value)`, `delete(key)`, `size` getter
- **Exports:** `MessageBodyCache`, `MESSAGE_CACHE_TTL_MS`, `MESSAGE_CACHE_MAX_SIZE`

The pattern mirrors `rate-limiter.ts`: class-based, Map storage, constructor-injected configuration, instantiated per-service (not a module singleton).

## Test Coverage (15 tests)

- Constants: TTL_MS = 300000, MAX_SIZE = 100
- get/set lifecycle: miss, hit before TTL, miss after TTL, boundary (>=), re-set resets TTL
- size: raw store count including stale entries
- delete: removes entry; no-op on missing key
- Capacity eviction (maxSize=5): 6th entry evicts 1st; correct oldest-first ordering; re-set moves to newest

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/utils/message-cache.ts` exists
- [x] `src/utils/message-cache.test.ts` exists
- [x] All exports present (MessageBodyCache, MESSAGE_CACHE_TTL_MS, MESSAGE_CACHE_MAX_SIZE)
- [x] `insertedAt` timestamp stored
- [x] `this.store.keys().next().value` oldest-first eviction
- [x] 206 tests pass (191 existing + 15 new)
- [x] `tsc --noEmit` clean
- [x] Commits: d624d58 (test RED), 7505b76 (feat GREEN)
