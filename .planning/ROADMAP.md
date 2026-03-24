# Roadmap: Mail MCP Server

## Milestones

- ✅ **v1.0.0 Mail MCP Server** — Phases 1–9 (shipped 2026-03-22)
- ✅ **v1.1.0 Hardening & Reliability** — Phases 10–13 (shipped 2026-03-22)
- ✅ **v1.2.0 Distribution & Documentation** — Phase 14 (shipped 2026-03-23)
- ✅ **v1.3.0 Signature Support & Performance Improvements** — Phases 15–18 (shipped 2026-03-24)

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

<details>
<summary>✅ v1.2.0 Distribution & Documentation (Phase 14) — SHIPPED 2026-03-23</summary>

- [x] Phase 14: Distribution & Documentation (2/2 plans) — completed 2026-03-23

</details>

<details>
<summary>✅ v1.3.0 Signature Support & Performance Improvements (Phases 15–18) — SHIPPED 2026-03-24</summary>

- [x] Phase 15: Upgrade GitHub Actions to Node.js 24 (1/1 plans) — completed 2026-03-23
- [x] Phase 16: MCP Tool Description Improvements (1/1 plans) — completed 2026-03-23
- [x] Phase 17: Email Signature Support (2/2 plans) — completed 2026-03-23
- [x] Phase 18: Performance & Caching (2/2 plans) — completed 2026-03-24

Full archive: `.planning/milestones/v1.3.0-ROADMAP.md`

</details>

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
| 14. Distribution & Documentation | v1.2.0 | 2/2 | Complete | 2026-03-23 |
| 15. GH Actions Node.js 24 | v1.3.0 | 1/1 | Complete    | 2026-03-23 |
| 16. Tool Descriptions | v1.3.0 | 1/1 | Complete    | 2026-03-23 |
| 17. Email Signatures | v1.3.0 | 2/2 | Complete    | 2026-03-23 |
| 18. Performance & Caching | v1.3.0 | 2/2 | Complete    | 2026-03-24 |

## Backlog

### Phase 999.4: Extract List-Unsubscribe headers for mailing list management (BACKLOG)

**Goal:** Surface RFC 2369 List-Unsubscribe headers (mailto: and https: URLs) as structured data in read_email output, enabling AI agents to automate mailing list unsubscription — mailto: via send_email, https: via browser tools
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.5: Reply and forward with proper threading headers (BACKLOG)

**Goal:** Add reply_email and forward_email tools that set In-Reply-To and References headers correctly so AI-composed replies appear in the original conversation thread
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.6: Contact extraction and frequency analysis (BACKLOG)

**Goal:** New tool to extract structured contact data (name, email, frequency) from mailbox — enables "who emails me most?" and "find emails from my manager" workflows
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.7: Mailbox stats — unread count, folder sizes (BACKLOG)

**Goal:** New tool to return mailbox statistics (unread count per folder, message counts, storage usage) without listing individual emails — fast triage for AI agents
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.8: Header-only fetch for fast email triage (BACKLOG)

**Goal:** Lightweight fetch mode that returns email metadata (subject, from, date, flags) without downloading body — enables fast inbox scanning and triage at scale
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.9: Email templates for reusable reply and compose patterns (BACKLOG)

**Goal:** Let users define reusable email templates (per-account or global) that AI agents can fill in — standard replies, acknowledgments, out-of-office, etc.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.10: Folder rules and filters via SIEVE scripts (BACKLOG)

**Goal:** Allow AI agents to create and manage server-side IMAP filters (SIEVE scripts) for automated mail sorting, forwarding, and flagging
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.11: Dedicated mark read/unread and star/unstar tools (BACKLOG)

**Goal:** Add simple mark_read, mark_unread, star, and unstar tools so AI agents don't need to know IMAP flag syntax (\\Seen, \\Flagged)
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.12: Dedicated delete email tool (BACKLOG)

**Goal:** Add a delete_email tool for single-message deletion without using batch_operations or move-to-Trash workarounds
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

---
*Last updated: 2026-03-24 — Backlog items 999.9–999.12 added*
