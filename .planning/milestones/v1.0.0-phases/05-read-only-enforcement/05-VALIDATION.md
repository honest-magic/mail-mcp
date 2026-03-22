---
phase: 5
slug: read-only-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) — `include: ['src/**/*.test.ts']`, `environment: 'node'` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | ROM-01–06 | unit | `npx vitest run src/index.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | ROM-01 | unit | `npx vitest run src/index.test.ts` | ✅ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | ROM-05 | unit | `npx vitest run src/index.test.ts` | ✅ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | ROM-02, ROM-03 | unit | `npx vitest run src/index.test.ts` | ✅ W0 | ⬜ pending |
| 5-01-05 | 01 | 1 | ROM-06 | unit | `npx vitest run src/index.test.ts` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/index.test.ts` — stubs for ROM-01, ROM-02, ROM-03, ROM-05, ROM-06 (10 test cases; file does not yet exist)

*All 10 required tests are in a single new file. No other infrastructure gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All behaviors have automated verification | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
