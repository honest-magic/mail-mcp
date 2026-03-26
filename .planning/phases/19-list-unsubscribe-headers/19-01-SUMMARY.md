---
phase: 19
plan: 01
subsystem: mail-service
tags: [headers, rfc-2369, list-unsubscribe, tdd]
dependency_graph:
  requires: []
  provides: [list-unsubscribe-extraction]
  affects: [read_email-output]
tech_stack:
  added: []
  patterns: [regex-angle-bracket-parsing, tdd-red-green]
key_files:
  created: []
  modified:
    - src/services/mail.ts
    - src/services/mail.test.ts
decisions:
  - parseUnsubscribeHeader as private helper method keeps readEmail() readable and enables isolated regex testing
  - https URLs output before mailto to match RFC 2369 preference order
  - mailto prefix stripped so output shows bare email address
metrics:
  duration: "84s"
  completed: "2026-03-26"
  tasks_completed: 2
  files_modified: 2
---

# Phase 19 Plan 01: Extract List-Unsubscribe Headers Summary

**One-liner:** RFC 2369 `List-Unsubscribe` header parsing via angle-bracket regex, surfacing https and mailto unsubscribe links (plus one-click flag) in `readEmail()` header output.

## What Was Built

Added List-Unsubscribe header extraction to `readEmail()` in `MailService`. When a `List-Unsubscribe` header is present in a parsed email, the method now appends structured lines to the header block:

- `**Unsubscribe:** <https-url>` for each https/http URL
- `**Unsubscribe (one-click):** yes` if `List-Unsubscribe-Post: List-Unsubscribe=One-Click` is present
- `**Unsubscribe (mailto):** <address>` for each mailto link (scheme prefix stripped)

When the header is absent, the output is unchanged.

## Implementation Details

**`parseUnsubscribeHeader(raw: string)`** — private helper method that:
- Uses a `/<([^>]+)>/g` regex to extract all angle-bracket tokens from the raw header value
- Routes each token to `https[]` or `mailto[]` array based on URL scheme
- Returns `{ https: string[], mailto: string[] }`

**`readEmail()` changes** — after the Message-ID block:
1. Reads `parsed.headers.get('list-unsubscribe')`
2. Calls helper to parse URLs
3. Appends https lines, then checks for one-click Post header, then appends mailto lines

## Tasks Completed

| Task | Type | Description | Commit |
|------|------|-------------|--------|
| 1 | TDD RED | Write 5 failing tests for List-Unsubscribe extraction | 86bd521 |
| 2 | TDD GREEN | Implement parseUnsubscribeHeader + readEmail() changes | 705798a |

## Test Coverage

5 new tests added to `src/services/mail.test.ts`:

- https-only header → Unsubscribe line present
- mailto-only header → Unsubscribe (mailto) line present
- both URLs → both lines present
- absent header → no Unsubscribe output
- List-Unsubscribe-Post present → one-click yes line

**Test results:** 211 passed / 0 failed across 12 test files.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/services/mail.ts
- FOUND: src/services/mail.test.ts
- FOUND: 19-01-SUMMARY.md
- FOUND commit 86bd521 (test RED)
- FOUND commit 705798a (feat GREEN)
