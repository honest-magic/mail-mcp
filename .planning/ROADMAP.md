# Roadmap: Mail MCP Server

## Milestones

- ✅ **v1.0.0 Mail MCP Server** — Phases 1–9 (shipped 2026-03-22)
- ✅ **v1.1.0 Hardening & Reliability** — Phases 10–13 (shipped 2026-03-22)
- ✅ **v1.2.0 Distribution & Documentation** — Phase 14 (shipped 2026-03-23)
- **v1.3.0 Signature Support & Performance Improvements** — Phases 15–18 (active)

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

### v1.3.0 Signature Support & Performance Improvements (Phases 15–18)

- [x] **Phase 15: Upgrade GitHub Actions to Node.js 24** - Upgrade CI workflows before forced migration (completed 2026-03-23)
- [x] **Phase 16: MCP Tool Description Improvements** - Better AI routing between mail-mcp and Gmail (completed 2026-03-23)
- [x] **Phase 17: Email Signature Support** - Per-account signatures for send and draft (completed 2026-03-23)
- [x] **Phase 18: Performance & Caching** - Connection pooling, response caching, faster search (completed 2026-03-24)

## Phase Details

### Phase 15: Upgrade GitHub Actions to Node.js 24
**Goal**: Upgrade actions/checkout and actions/setup-node to Node.js 24-compatible versions before forced migration on 2026-06-02
**Depends on**: Nothing (standalone CI work)
**Requirements**: None (CI maintenance)
**Plans**: 1 plan

Plans:
- [x] 15-01-PLAN.md — Upgrade ci.yml and publish.yml action versions and standardize node-version to '22'

### Phase 16: MCP Tool Description Improvements
**Goal**: Make tool descriptions specific enough that AI clients prefer mail-mcp for IMAP accounts and Gmail MCP for Google accounts
**Depends on**: Nothing (standalone metadata work)
**Requirements**: None (metadata improvement)
**Plans**: 1 plan

Plans:
- [x] 16-01-PLAN.md — Update all 14 tool descriptions and server instructions with IMAP/provider keywords

### Phase 17: Email Signature Support
**Goal**: Allow per-account email signatures that are automatically appended when sending or drafting emails
**Depends on**: Nothing
**Requirements**: None (feature addition)
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md — Add signature to emailAccountSchema and includeSignature to tool input schemas
- [x] 17-02-PLAN.md — Implement applySignature helper and wire through sendEmail/createDraft/tool handler

### Phase 18: Performance & Caching
**Goal**: Add in-memory response caching for message body fetches to eliminate redundant IMAP round-trips when AI agents re-read the same email multiple times in a session
**Depends on**: Nothing (can run independently, but benefits from stable codebase)
**Requirements**: None (performance improvement)
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md — Create MessageBodyCache utility (TTL Map, 5 min / 100 entries, oldest-first eviction)
- [x] 18-02-PLAN.md — Wire cache into MailService.readEmail/downloadAttachment; invalidate on move_email

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
| 18. Performance & Caching | v1.3.0 | 2/2 | Complete   | 2026-03-24 |

---
*Last updated: 2026-03-23 — Phase 18 planned (2 plans)*
