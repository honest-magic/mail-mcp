---
phase: 10
slug: connection-lifecycle-error-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SAFE-02 | unit | `npx vitest run src/errors.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | VAL-01 | unit | `npx vitest run src/config.test.ts` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 1 | VAL-04 | unit | `npx vitest run src/config.test.ts` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 2 | VAL-03 | unit | `npx vitest run src/protocol/smtp.test.ts` | ✅ | ⬜ pending |
| 10-04-01 | 04 | 2 | CONN-01 | unit | `npx vitest run src/index.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/errors.test.ts` — stubs for SAFE-02 error type tests

*Existing test files cover all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SIGTERM closes connections | CONN-01 | Requires process signal | Start server, send SIGTERM, verify clean exit |
| fs.watch invalidates cache | VAL-04 | Requires file system event | Edit accounts.json while server runs, verify new config on next call |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
