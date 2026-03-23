# Roadmap: Mail MCP Server

## Milestones

- ✅ **v1.0.0 Mail MCP Server** — Phases 1–9 (shipped 2026-03-22)
- ✅ **v1.1.0 Hardening & Reliability** — Phases 10–13 (shipped 2026-03-22)
- **v1.2.0 Distribution & Documentation** — Phase 14 (active)

## Phases

<details>
<summary>✅ v1.0.0 Mail MCP Server (Phases 1–9) — SHIPPED 2026-03-22</summary>

- [x] Phase 1: Secure Connectivity & Basic Messaging (4/4 plans) — completed 2026-03-21
- [x] Phase 2: Discovery & Organization (2/2 plans) — completed 2026-03-22
- [x] Phase 3: Context & Resources (2/2 plans) — completed 2026-03-21
- [x] Phase 4: Efficiency & Scale (1/1 plans) — completed 2026-03-21
- [x] Phase 5: Read-Only Enforcement (1/1 plans) — completed 2026-03-21
- [x] Phase 6: Mode Discoverability & Connection Hygiene (1/1 plans) — completed 2026-03-22
- [x] Phase 7: npm Package Setup (1/1 plans) — completed 2026-03-22
- [x] Phase 8: GitHub Repository (2/2 plans) — completed 2026-03-22
- [x] Phase 9: GitHub Actions (2/2 plans) — completed 2026-03-22

Full archive: `.planning/milestones/v1.0.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1.0 Hardening & Reliability (Phases 10–13) — SHIPPED 2026-03-22</summary>

- [x] Phase 10: Connection Lifecycle & Error Infrastructure (3/3 plans) — completed 2026-03-22
- [x] Phase 11: Input Validation & Safety Limits (2/2 plans) — completed 2026-03-22
- [x] Phase 12: Pagination, Health Check & Reconnect (2/2 plans) — completed 2026-03-22
- [x] Phase 13: Integration Test Suite (2/2 plans) — completed 2026-03-22

Full archive: `.planning/milestones/v1.1.0-ROADMAP.md`

</details>

### v1.2.0 Distribution & Documentation (Phase 14)

- [x] **Phase 14: Distribution & Documentation** - Ship Homebrew install and README update guide (completed 2026-03-23)

## Phase Details

### Phase 14: Distribution & Documentation
**Goal**: Users can install and update mail-mcp via Homebrew, and existing npm users know how to keep their install current
**Depends on**: Nothing (standalone docs and packaging work)
**Requirements**: DOC-01, DIST-01
**Success Criteria** (what must be TRUE):
  1. A user can run `brew install mail-mcp` and get a working install
  2. The README contains a dedicated section explaining how to update (npm update, npx re-run, version pinning)
  3. A Homebrew formula file exists in the repository with correct metadata (name, version, url, sha256, bin entry)
  4. A new user reading the README can determine which install method (npm vs Homebrew) suits their workflow
**Plans:** 2/2 plans complete

Plans:
- [x] 14-01-PLAN.md — README updates (Homebrew install, Updating section, comparison table) + GitHub Release workflow step
- [x] 14-02-PLAN.md — Homebrew formula creation + tap repo setup

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Secure Connectivity | v1.0.0 | 4/4 | Complete | 2026-03-21 |
| 2. Discovery & Organization | v1.0.0 | 2/2 | Complete | 2026-03-22 |
| 3. Context & Resources | v1.0.0 | 2/2 | Complete | 2026-03-21 |
| 4. Efficiency & Scale | v1.0.0 | 1/1 | Complete | 2026-03-21 |
| 5. Read-Only Enforcement | v1.0.0 | 1/1 | Complete | 2026-03-21 |
| 6. Mode Discoverability | v1.0.0 | 1/1 | Complete | 2026-03-22 |
| 7. npm Package Setup | v1.0.0 | 1/1 | Complete | 2026-03-22 |
| 8. GitHub Repository | v1.0.0 | 2/2 | Complete | 2026-03-22 |
| 9. GitHub Actions | v1.0.0 | 2/2 | Complete | 2026-03-22 |
| 10. Connection Lifecycle | v1.1.0 | 3/3 | Complete | 2026-03-22 |
| 11. Input Validation | v1.1.0 | 2/2 | Complete | 2026-03-22 |
| 12. Pagination & Reconnect | v1.1.0 | 2/2 | Complete | 2026-03-22 |
| 13. Integration Tests | v1.1.0 | 2/2 | Complete | 2026-03-22 |
| 14. Distribution & Documentation | v1.2.0 | 2/2 | Complete    | 2026-03-23 |

## Backlog

### Phase 999.3: Upgrade GitHub Actions to Node.js 24-compatible versions (BACKLOG)

**Goal:** Upgrade actions/checkout@v4 and actions/setup-node@v4 to Node.js 24-compatible versions before forced migration on 2026-06-02
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.4: Improve MCP tool descriptions to distinguish mail-mcp from Gmail (BACKLOG)

**Goal:** Make tool descriptions specific enough that AI clients prefer mail-mcp for IMAP accounts and Gmail MCP for Google accounts — add account type hints, negative guidance on Gmail tools, and priority routing hints
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.5: Performance & Caching (BACKLOG)

**Goal:** Reduce latency across the full request path — IMAP connection pooling, response caching for repeated email/thread fetches, faster search on large mailboxes, efficient body/attachment parsing
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.6: Email signature support for sending (BACKLOG)

**Goal:** Allow per-account email signatures that are automatically appended when sending or drafting emails
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

---
*Last updated: 2026-03-23 — Backlog item 999.6 added*
