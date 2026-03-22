---
phase: 13-integration-test-suite
plan: 02
subsystem: testing
tags: [integration-tests, imap, ci, vitest, credential-gating]
dependency_graph:
  requires: [13-01]
  provides: [imap-integration-test, ci-integration-job]
  affects: [.github/workflows/ci.yml, vitest.integration.config.ts]
tech_stack:
  added: []
  patterns: [describe.skipIf-credential-gating, vi.mock-keychain-bypass, github-vars-vs-secrets]
key_files:
  created:
    - tests/integration/imap.integration.test.ts
  modified:
    - .github/workflows/ci.yml
    - vitest.integration.config.ts
decisions:
  - "Use vars.TEST_IMAP_HOST (not secrets) for IMAP host and port — non-sensitive config belongs in repository variables; only credentials (user/pass) go in secrets"
  - "testTimeout: 15000 in vitest.integration.config.ts — SMTP server cold-start on first test can take >5s; raise global timeout once rather than annotate every test"
metrics:
  duration: 180s
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 13 Plan 02: IMAP Credential-Gated Integration Test and CI Job Summary

**One-liner:** IMAP integration test with describe.skipIf credential gating and vi.mock keychain bypass, plus optional CI integration job gated on repository variable availability.

## What Was Built

Completed the integration test suite with IMAP tests that skip cleanly when credentials are absent, and added a CI workflow job so integration tests run automatically when secrets are configured.

- `tests/integration/imap.integration.test.ts` — IMAP integration test file with `vi.mock` for keychain (returns `TEST_IMAP_PASS` instead of macOS Keychain) and `describe.skipIf(!hasImapCredentials)` wrapping all three tests. Tests: listFolders (asserts array with INBOX), listMessages (asserts array, uid is number if non-empty), searchMessages (asserts array for broad date query). Each test has 15000ms timeout.
- `.github/workflows/ci.yml` — new `integration` job after `ci`, with `needs: ci` gate and `if: ${{ vars.TEST_IMAP_HOST != '' }}` condition. Passes `TEST_IMAP_HOST`/`TEST_IMAP_PORT` as repository variables and `TEST_IMAP_USER`/`TEST_IMAP_PASS` as secrets. Existing `ci` job unchanged.
- `vitest.integration.config.ts` — added `testTimeout: 15000` (bug fix; see Deviations).

## Verification Results

- `npm run test:integration` without `TEST_IMAP_HOST`: 3 SMTP tests pass, 3 IMAP tests skip, exit 0
- `npm test`: 177 unit tests pass, exit 0, no integration test output
- `.github/workflows/ci.yml` contains `integration` job with correct `needs`, `if`, and `env` blocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SMTP integration test flakiness — first test timed out at 5008ms**
- **Found during:** Task 1 verification
- **Issue:** The first SMTP integration test was consistently timing out at 5008ms (1ms over the 5000ms vitest default). SMTP server cold-start (first connection + TLS negotiation) takes ~5s. This was pre-existing from 13-01 but not caught (timing-sensitive, may pass on faster machines). Subsequent tests pass because the server is already warm.
- **Fix:** Added `testTimeout: 15000` to `vitest.integration.config.ts`. This global timeout applies to all integration tests consistently, including the IMAP tests which specify 15000ms per-test already.
- **Files modified:** `vitest.integration.config.ts`
- **Commit:** e0c918c (bundled with Task 1 IMAP test file)

## Known Stubs

None. The IMAP test skips via `describe.skipIf` when credentials are absent — this is intentional gating, not a stub. When `TEST_IMAP_HOST` is set, all three tests exercise the real `ImapClient` against a live server.

## Self-Check: PASSED

- tests/integration/imap.integration.test.ts: FOUND
- .github/workflows/ci.yml integration job: FOUND
- vitest.integration.config.ts testTimeout: FOUND
- Commit e0c918c: FOUND
- Commit 7bacdc9: FOUND
