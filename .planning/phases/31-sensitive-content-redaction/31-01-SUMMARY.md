---
phase: 31
plan: 01
name: sensitive-content-redaction
subsystem: utils/mail-service/cli
tags: [security, redaction, pii, tdd]
dependency_graph:
  requires: []
  provides: [redactSensitiveContent, --redact-flag]
  affects: [readEmail, MailService, MailMCPServer, CLI]
tech_stack:
  added: []
  patterns: [regex-redaction, tdd-red-green, constructor-injection]
key_files:
  created:
    - src/utils/redact.ts
    - src/utils/redact.test.ts
    - .planning/phases/31-sensitive-content-redaction/CONTEXT.md
    - .planning/phases/31-sensitive-content-redaction/31-01-PLAN.md
  modified:
    - src/services/mail.ts
    - src/index.ts
decisions:
  - redact param is opt-in default-false constructor injection on MailService (no breaking change)
  - Zero external dependencies — regex only approach for portability and auditability
  - Redaction applied to email body content only (not headers like From/Subject/To)
  - Pattern for API keys requires 16+ alphanumeric chars after prefix to avoid false positives
metrics:
  duration_seconds: 305
  completed_date: "2026-03-26"
  tasks_completed: 4
  files_changed: 4
---

# Phase 31 Plan 01: Sensitive Content Redaction Summary

Regex-based PII redaction utility with `--redact` CLI flag applied in `readEmail()` before content reaches the AI — covering credit cards, SSNs, contextual passwords, and API keys with zero external dependencies.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Write failing tests (TDD RED) | a3f5ba9 | src/utils/redact.test.ts |
| 2 | Implement redactSensitiveContent (TDD GREEN) | 50a64f9 | src/utils/redact.ts |
| 3 | Wire --redact flag end-to-end | c8888e2 | src/services/mail.ts, src/index.ts |
| 4 | Full test suite verification | (in task 3 commit) | — |

## What Was Built

### `src/utils/redact.ts`

Pure utility function `redactSensitiveContent(text: string): string` with four regex patterns:

- **Credit card**: 16-digit groups with optional spaces/dashes → `[REDACTED CC]`
- **SSN**: `XXX-XX-XXXX` format → `[REDACTED SSN]`
- **Password context**: `password/pwd/passwd/pass:` or `=` label with value → `label: [REDACTED]`
- **API keys**: `sk-`, `api_`, `token_`, `secret_` prefixes with 16+ alphanumeric chars → `[REDACTED KEY]`

### `src/services/mail.ts`

- Added `redact: boolean = false` third constructor parameter
- Imported `redactSensitiveContent` from `../utils/redact.js`
- Applied conditional redaction: `const body = this.redact ? redactSensitiveContent(content) : content;`

### `src/index.ts`

- Added `private readonly redact: boolean` field to `MailMCPServer`
- Extended constructor with `redact: boolean = false` 5th parameter
- Passed `this.redact` to `new MailService(account, this.readOnly, this.redact)`
- Added `'redact': { type: 'boolean', default: false }` to parseArgs options
- Added `--redact` line to help text
- Wired `const redact = (values['redact'] as boolean | undefined) ?? false` into server constructor

## Decisions Made

1. **Constructor injection (not singleton flag)**: `redact` is passed into `MailService` on construction, consistent with `readOnly` pattern in the same constructor. No global state.

2. **Zero external dependencies**: Regex-only approach. No NLP, no ML, no lookup tables. Fast and auditable.

3. **Body-only redaction**: Headers (From, Subject, To, Date) are not redacted — they're metadata the AI needs to reason about. Only the body content where sensitive strings typically appear is processed.

4. **16+ char threshold for API keys**: Short matches like `sk-abc` are likely false positives (URL slugs, abbreviations). 16+ characters after the prefix is a strong signal.

5. **Opt-in default-off**: Redaction is off by default. Enable with `--redact` flag. This prevents false positives from breaking normal use while giving privacy-conscious users the option.

## Test Results

```
Test Files  1 passed (1)
Tests       19 passed (19)
```

All 19 unit tests pass covering all 4 pattern types, edge cases, and multi-pattern inputs.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/utils/redact.ts` exists: FOUND
- `src/utils/redact.test.ts` exists: FOUND
- Commit a3f5ba9 (TDD RED): FOUND
- Commit 50a64f9 (TDD GREEN): FOUND
- Commit c8888e2 (wiring): FOUND
