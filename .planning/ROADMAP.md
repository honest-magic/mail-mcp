# Roadmap: Mail MCP Server

## Milestones

- ✅ **v1.0.0 Mail MCP Server** — Phases 1–9 (shipped 2026-03-22)
- 🔄 **v1.1.0 Hardening & Reliability** — Phases 10–13 (in progress)

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

### v1.1.0 Hardening & Reliability

- [x] **Phase 10: Connection Lifecycle & Error Infrastructure** — Graceful shutdown, config validation, SMTP TLS derivation, config caching, typed errors (completed 2026-03-22)
- [ ] **Phase 11: Input Validation & Safety Limits** — Email address validation, attachment size cap, per-account rate limiting
- [ ] **Phase 12: Pagination, Health Check & Reconnect** — Large mailbox pagination, startup account probing, auto-reconnect on drop
- [ ] **Phase 13: Integration Test Suite** — Real-protocol SMTP and IMAP integration tests with CI support

## Phase Details

### Phase 10: Connection Lifecycle & Error Infrastructure
**Goal**: The server starts and stops cleanly, account configs are validated before use, and all errors carry typed context
**Depends on**: Nothing (first v1.1.0 phase)
**Requirements**: CONN-01, VAL-01, VAL-03, VAL-04, SAFE-02
**Success Criteria** (what must be TRUE):
  1. When the server receives SIGTERM or SIGINT, all open IMAP and SMTP connections are cleanly disconnected before the process exits, with a 10-second forced-exit fallback
  2. A malformed `accounts.json` entry produces an actionable error naming the bad field and account ID at startup, and does not prevent valid accounts from loading
  3. An account config with `port: 465` and no explicit `secure` setting connects over TLS without error; `port: 587` connects via STARTTLS
  4. The accounts config is read once and served from an in-memory cache; editing `accounts.json` on disk invalidates the cache so the next tool call picks up the change
  5. Tool errors returned to the MCP client carry a typed error code (`AuthError`, `NetworkError`, `ValidationError`, `QuotaError`) and a human-readable contextual message
**Plans:** 3/3 plans complete

Plans:
- [x] 10-01-PLAN.md — Typed error hierarchy (MailMCPError + subclasses) and catch block update
- [x] 10-02-PLAN.md — Zod account validation, config caching with fs.watch, SMTP TLS derivation
- [x] 10-03-PLAN.md — Graceful shutdown with signal handlers and in-flight request draining

### Phase 11: Input Validation & Safety Limits
**Goal**: Malformed inputs and resource-exhausting requests are rejected before any network I/O occurs
**Depends on**: Phase 10 (typed error infrastructure used by all new guards)
**Requirements**: VAL-02, SAFE-01, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Calling `send_email` with a syntactically invalid recipient address (e.g. `notanemail`) returns a `ValidationError` without any SMTP connection being opened
  2. Requesting attachment content for an attachment whose BODYSTRUCTURE-reported size exceeds 50 MB returns a clear error before any bytes are downloaded
  3. An AI agent issuing more than 100 tool calls in 60 seconds against a single account receives a `QuotaError` response; subsequent calls within the window continue to be rejected until the window resets
**Plans**: TBD

### Phase 12: Pagination, Health Check & Reconnect
**Goal**: Users can navigate large mailboxes, validate credentials at startup, and the server recovers automatically from dropped connections
**Depends on**: Phase 10 (validated config for health check and reconnect), Phase 11 (structured errors for health check responses)
**Requirements**: QUAL-01, CONN-02, CONN-03
**Success Criteria** (what must be TRUE):
  1. Calling `list_emails` or `search_emails` with an `offset` parameter returns the correct subsequent page of results without re-fetching earlier messages
  2. Running the server with `--validate-accounts` probes IMAP CAPABILITY and SMTP EHLO for every configured account and prints a pass/fail result per account before exiting
  3. When an IMAP connection drops mid-session, the next tool call against that account automatically attempts one reconnect with exponential backoff before succeeding or surfacing a `NetworkError`
**Plans**: TBD

### Phase 13: Integration Test Suite
**Goal**: The full hardened server is validated end-to-end against real mail protocols in both local and CI environments
**Depends on**: Phase 10, Phase 11, Phase 12 (tests validate the complete hardened system)
**Requirements**: QUAL-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run test:integration` with a local smtp-server fixture completes a full send-receive cycle (compose -> send -> receive -> verify headers) without any mocked transport
  2. Running `npm run test:integration` without IMAP credentials set in environment skips IMAP tests cleanly with a descriptive skip message, and exits zero
  3. The integration test suite does not appear in or interfere with the default `npm test` unit test run
**Plans**: TBD

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
| 10. Connection Lifecycle & Error Infrastructure | v1.1.0 | 3/3 | Complete    | 2026-03-22 |
| 11. Input Validation & Safety Limits | v1.1.0 | 0/? | Not started | - |
| 12. Pagination, Health Check & Reconnect | v1.1.0 | 0/? | Not started | - |
| 13. Integration Test Suite | v1.1.0 | 0/? | Not started | - |

---
*Last updated: 2026-03-22 — Phase 10 planned (3 plans in 2 waves)*

## Backlog

### Phase 999.1: README update section (BACKLOG)

**Goal:** Write a section in the README.md about updating the MCP server
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
