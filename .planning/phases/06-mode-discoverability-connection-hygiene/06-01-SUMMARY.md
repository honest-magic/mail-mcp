---
phase: 06-mode-discoverability-connection-hygiene
plan: 01
subsystem: api
tags: [mcp, imap, smtp, read-only, imapflow, nodemailer]

# Dependency graph
requires:
  - phase: 05-read-only-enforcement
    provides: MailMCPServer with readOnly field, WRITE_TOOLS set, dispatch guard

provides:
  - Server constructor emits instructions string in InitializeResult when readOnly=true (ROM-04)
  - MailService skips smtpClient.connect() when readOnly=true (ROM-07)
  - getService() passes readOnly flag to MailService constructor

affects:
  - any future phase adding new MCP capabilities or transport options

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spread conditional options into MCP Server constructor: ...(condition ? { key: value } : {})"
    - "TDD mock constructors with vi.fn(function(){}) not vi.fn().mockImplementation(() => {})"

key-files:
  created:
    - src/services/mail.test.ts
  modified:
    - src/index.ts
    - src/index.test.ts
    - src/services/mail.ts

key-decisions:
  - "Instructions string delivered via MCP InitializeResult.instructions, no extra tool call required"
  - "SMTP skip scoped to MailService.connect() with readOnly guard; IMAP EXAMINE deferred to v2 (ROM-08)"
  - "Test mock constructors require vi.fn(function(){}) pattern, not arrow function mockImplementation"

patterns-established:
  - "Conditional spread for optional MCP Server options: ...(this.readOnly ? { instructions: '...' } : {})"
  - "MailService accepts optional readOnly boolean param defaulting to false, backward-compatible"

requirements-completed: [ROM-04, ROM-07]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 6 Plan 01: Mode Discoverability and SMTP Skip Summary

**MCP handshake now exposes read-only mode via InitializeResult.instructions and MailService skips smtpClient.connect() when readOnly=true**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T06:45:27Z
- **Completed:** 2026-03-22T06:46:54Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- ROM-04: Server constructor conditionally spreads `instructions` into MCP Server options when `readOnly=true`, making mode discoverable to clients at handshake without any extra tool call
- ROM-07: `MailService.connect()` guards `smtpClient.connect()` behind `if (!this.readOnly)`, eliminating unnecessary SMTP auth in read-only sessions
- `getService()` now passes `this.readOnly` to `MailService` constructor, connecting the dispatch layer's mode flag to the service layer
- Full TDD cycle: 4 failing tests written first (RED), then implementation made all 26 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for ROM-04 and ROM-07** - `d831f0f` (test)
2. **Task 2: Implement ROM-04 and ROM-07** - `e25f070` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified

- `src/index.ts` - Added conditional instructions spread in Server constructor; updated MailService instantiation to pass readOnly
- `src/services/mail.ts` - Added `readOnly` param to constructor; wrapped smtpClient.connect() with if guard
- `src/index.test.ts` - Appended ROM-04 describe block with Test P and Test Q
- `src/services/mail.test.ts` (created) - ROM-07 describe block with Test R and Test S using proper mock constructor pattern

## Decisions Made

- Used spread conditional `...(this.readOnly ? { instructions: '...' } : {})` to keep the Server constructor call clean and avoid an undefined key being present when readOnly is false
- Placed ROM-07 tests in a separate file (`src/services/mail.test.ts`) to avoid conflict with the top-level `vi.mock('./services/mail.js')` in `src/index.test.ts` which mocks the entire MailService
- IMAP EXAMINE (read-only folder selection) deferred to v2 as ROM-08; ROM-07 scope limited to SMTP skip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock constructor pattern for ImapClient/SmtpClient**
- **Found during:** Task 2 (Implement ROM-04 and ROM-07)
- **Issue:** Plan's test template used arrow function `() => ({})` inside `vi.fn().mockImplementation()` — Vitest warns these are not valid constructors and the tests fail with "() => ... is not a constructor"
- **Fix:** Changed mock factories to use `vi.fn(function () { return { connect: mockFn }; })` pattern which Vitest accepts as a constructor mock
- **Files modified:** src/services/mail.test.ts
- **Verification:** All 26 tests pass; no constructor warnings
- **Committed in:** e25f070 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in plan's mock template)
**Impact on plan:** Single-line fix in test file only. No scope creep. Implementation files exactly as planned.

## Issues Encountered

None beyond the mock constructor pattern fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 read-only mode requirements (ROM-01 through ROM-07) are now complete
- Phase 6 (mode-discoverability-connection-hygiene) is fully implemented
- v1.1 milestone complete: `--read-only` flag works end-to-end with mode discovery, write blocking, filtered tool list, annotations, and SMTP skip
- ROM-08 (IMAP EXAMINE for read-only folder access) deferred to v2

## Self-Check: PASSED

All created files exist and all task commits verified.

---
*Phase: 06-mode-discoverability-connection-hygiene*
*Completed: 2026-03-22*
