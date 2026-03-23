---
phase: 14
slug: distribution-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-XX | 01 | 1 | DOC-01 | manual-only | N/A — prose review | N/A | ⬜ pending |
| 14-02-XX | 02 | 1 | DIST-01 | manual-only | `brew audit --tap honest-magic/tap` | N/A — new repo | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase adds no new source code — it creates documentation and a Homebrew formula in a separate repo. Existing unit tests serve as regression guard only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README contains "Updating" section with npx/npm/brew subsections | DOC-01 | Prose content — no runtime behavior | `grep -c "## Updating" README.md` returns 1; section has 3 subsections |
| README contains install method comparison table | DOC-01 | Prose content | `grep -c "Method.*Command.*Best for" README.md` returns 1 |
| Homebrew formula exists with correct metadata | DIST-01 | Formula lives in separate tap repo | `brew audit --tap honest-magic/tap mail-mcp` passes |
| `brew install mail-mcp` produces working binary | DIST-01 | Requires Homebrew runtime | `brew install honest-magic/tap/mail-mcp && mail-mcp --help` |
| publish.yml creates GitHub Release on tag push | DOC-01 | CI behavior — tested by tagging | Push a test tag and verify release appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
