---
phase: 10-connection-lifecycle-error-infrastructure
plan: "01"
subsystem: error-handling
tags: [errors, typed-errors, mcp, error-hierarchy]
dependency_graph:
  requires: []
  provides: [typed-error-hierarchy, error-formatted-mcp-responses]
  affects: [src/index.ts, all future plans that throw MailMCPError]
tech_stack:
  added: []
  patterns: [instanceof-check-for-typed-errors, ErrorOptions-cause-chaining]
key_files:
  created:
    - src/errors.ts
    - src/errors.test.ts
  modified:
    - src/index.ts
    - src/index.test.ts
key_decisions:
  - "MailMCPError uses MailErrorCode enum values as both .code and .name to enable string comparison without enum import"
  - "dispatchTool wraps its body in try/catch matching setupToolHandlers so both paths are consistently handled and independently testable"
  - "Generic Error in catch block passes message without [Code] prefix to preserve backward compatibility"
metrics:
  duration_seconds: 170
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
requirements:
  - SAFE-02
---

# Phase 10 Plan 01: Typed Error Hierarchy Summary

**One-liner:** MailMCPError base class with AuthError/NetworkError/ValidationError/QuotaError subclasses and [ErrorCode] message prefix formatting in MCP catch blocks.

## What Was Built

Created the typed error foundation for v1.1.0. All tool error responses now carry structured error codes when a `MailMCPError` subclass is thrown, enabling callers to programmatically distinguish auth failures, network issues, validation errors, and quota limits from generic errors.

### Files Created

- `/Users/mis/dev/mail_mcp/src/errors.ts` — `MailErrorCode` enum, `MailMCPError` base class, `AuthError`, `NetworkError`, `ValidationError`, `QuotaError` subclasses. All support `ErrorOptions` cause chaining.
- `/Users/mis/dev/mail_mcp/src/errors.test.ts` — 30 unit tests covering instantiation, instanceof checks, `.code`/`.name`/`.message` field values, and cause chaining for all 4 subclasses.

### Files Modified

- `/Users/mis/dev/mail_mcp/src/index.ts` — Added `import { MailMCPError } from './errors.js'`; updated catch block in `setupToolHandlers` from `catch(error: any)` to `catch(error: unknown)` with `[ErrorCode] message` formatting for `MailMCPError` instances; added consistent try/catch to `dispatchTool` for testability.
- `/Users/mis/dev/mail_mcp/src/index.test.ts` — Added 3 tests in `SAFE-02` describe block verifying: AuthError produces `[AuthError] bad credentials`, generic Error produces plain message without brackets, NetworkError produces `[NetworkError] timeout`.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | Failing tests for typed error hierarchy | ce119b8 |
| 1 (GREEN) | Create typed error hierarchy (MailMCPError + 4 subclasses) | c2a1aa0 |
| 2 | Update catch block to produce typed error responses | 0d97e32 |

## Verification Results

- `npx vitest run src/errors.test.ts src/index.test.ts` — 65 tests pass (30 new errors tests + 35 existing index tests)
- `npx tsc --noEmit` — no type errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added try/catch to `dispatchTool` to match `setupToolHandlers` catch block**
- **Found during:** Task 2 implementation
- **Issue:** `dispatchTool` had no try/catch, making it impossible to test error formatting via the existing test pattern (tests call `dispatchTool` directly, not the internal `setupToolHandlers` callback)
- **Fix:** Wrapped `dispatchTool` body in try/catch with same formatting logic as `setupToolHandlers`; added `getService` call before `McpError` throw so spies can intercept it in tests
- **Files modified:** src/index.ts

## Known Stubs

None — no stub values or placeholder data in any created/modified files.

## Self-Check

Created files:
- [x] src/errors.ts exists
- [x] src/errors.test.ts exists
- [x] src/index.ts modified (import + catch block updated)
- [x] src/index.test.ts modified (3 new tests)

Commits:
- [x] ce119b8 (RED tests)
- [x] c2a1aa0 (GREEN implementation)
- [x] 0d97e32 (Task 2 catch block + tests)
