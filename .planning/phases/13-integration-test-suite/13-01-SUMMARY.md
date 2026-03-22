---
phase: 13-integration-test-suite
plan: 01
subsystem: testing
tags: [integration-tests, smtp, vitest, smtp-server]
dependency_graph:
  requires: []
  provides: [integration-test-infra, smtp-integration-test]
  affects: [package.json]
tech_stack:
  added: [smtp-server@^3.18.1, "@types/smtp-server@^3.5.12"]
  patterns: [vitest-globalSetup-provide-inject, vitest-separate-config-isolation, CJS-createRequire-interop]
key_files:
  created:
    - vitest.integration.config.ts
    - tests/integration/setup.ts
    - tests/integration/smtp.integration.test.ts
  modified:
    - package.json
decisions:
  - "Use server.server.address() instead of server.address() — SMTPServer wraps a net.Server internally; address() is on the inner net.Server not the SMTPServer class itself"
metrics:
  duration: 117s
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 13 Plan 01: Integration Test Infrastructure and SMTP Test Summary

**One-liner:** Separate vitest integration config with in-process smtp-server globalSetup fixture and 3-test SMTP send/receive suite using nodemailer against ephemeral port.

## What Was Built

Integration test infrastructure isolated from the unit suite, plus a working SMTP send/receive test that validates nodemailer protocol compliance against a real smtp-server (no mocks).

- `vitest.integration.config.ts` — separate vitest config with `include: ['tests/integration/**/*.integration.test.ts']` and `globalSetup: ['tests/integration/setup.ts']`. Never overlaps with `vitest.config.ts`'s `src/**/*.test.ts` glob.
- `tests/integration/setup.ts` — globalSetup that starts smtp-server on port 0 (ephemeral), awaits bind, extracts port via `(server as any).server.address().port`, and shares it to test workers via `project.provide('smtpPort', port)`. Teardown closes the server.
- `tests/integration/smtp.integration.test.ts` — 3 tests: plain text send (asserts messageId, accepted, rejected), HTML send with custom header, multi-recipient send (asserts 2 accepted).
- `package.json` — added `"test:integration": "vitest run --config vitest.integration.config.ts"` script; added smtp-server and @types/smtp-server devDependencies.

## Verification Results

- `npm run test:integration` — 3/3 tests pass, exit 0
- `npm test` — 177 unit tests pass, exit 0, zero integration test output (confirmed with `grep -i integration`)
- `grep -r "integration" vitest.config.ts` — returns nothing; unit config untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed server.address() — SMTPServer wraps net.Server internally**
- **Found during:** Task 1 (first test run)
- **Issue:** Research examples called `server.address()` directly on the SMTPServer instance. At runtime, `server.address is not a function` because SMTPServer does not expose `address()` — it stores the underlying `net.Server` in `server.server`.
- **Fix:** Changed `server.address()` to `(server as any).server.address()` in `tests/integration/setup.ts`.
- **Files modified:** `tests/integration/setup.ts`
- **Commit:** aa289ed (bundled with Task 2 test file commit)

## Known Stubs

None. All data flows are wired. The smtp-server receives real SMTP DATA and nodemailer's `info.messageId` / `info.accepted` / `info.rejected` are real protocol responses.

## Self-Check: PASSED

- vitest.integration.config.ts: FOUND
- tests/integration/setup.ts: FOUND
- tests/integration/smtp.integration.test.ts: FOUND
- package.json test:integration script: FOUND
- Commit b2fa751: FOUND
- Commit aa289ed: FOUND
