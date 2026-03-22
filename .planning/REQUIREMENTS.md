# Requirements: Mail MCP Server

**Defined:** 2026-03-22
**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.

## v1.1.0 Requirements

Requirements for hardening & reliability milestone. Each maps to roadmap phases.

### Connection Lifecycle

- [x] **CONN-01**: Server gracefully disconnects all IMAP/SMTP connections on SIGTERM/SIGINT with 10s forced exit timeout
- [x] **CONN-02**: IMAP client automatically attempts one reconnect with exponential backoff when connection drops
- [x] **CONN-03**: User can run `--validate-accounts` to probe IMAP CAPABILITY and SMTP EHLO for all accounts at startup

### Input Validation

- [x] **VAL-01**: Account config is validated against a Zod schema at load time, with actionable error messages on failure
- [x] **VAL-02**: Email addresses (to/cc/bcc) are validated as RFC 5322 format before SMTP send
- [x] **VAL-03**: SMTP `secure` flag is auto-derived from port (465=TLS, 587=STARTTLS) when not explicitly set
- [x] **VAL-04**: Account config is cached in memory and invalidated via file watcher instead of reading from disk per call

### Safety Limits

- [x] **SAFE-01**: Attachment download is rejected with clear error when BODYSTRUCTURE size exceeds configurable limit (default 50MB)
- [x] **SAFE-02**: All tool errors use typed error classes (AuthError, NetworkError, ValidationError, QuotaError) with contextual messages
- [x] **SAFE-03**: Per-account in-memory rate limiter enforces a sliding window limit (default 100 req/60s)

### Quality & Testing

- [x] **QUAL-01**: User can paginate large email lists via an `offset` parameter on `list_emails` and `search_emails`
- [x] **QUAL-02**: Integration test suite covers SMTP send (via smtp-server) and IMAP operations (via real credentials in CI)

## Future Requirements

### Deferred to v2+

- **REAL-01**: Real-time push via IMAP IDLE
- **CONT-01**: Contact lookup and history enrichment
- **AI-01**: Proactive inbox triage suggestions
- **ROM-08**: IMAP EXAMINE mode (no \Seen flag mutation in read-only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| SQLite message cache | Adds persistent-state dependency to stateless gateway; cache invalidation against live IMAP is non-trivial |
| Redis-backed rate limiter | Single-process local server; Redis adds external dependency for zero benefit |
| Docker/Testcontainers for tests | Heavyweight for a local CLI tool; use smtp-server + real IMAP credentials instead |
| hoodiecrow-imap for IMAP tests | Deprecated ~10 years; no ESM support, no modern Node.js compatibility |
| Per-account configurable batch limits | Hard-coded sensible default is simpler than adding config surface area |
| IMAP IDLE (real-time push) | Significant architecture change; deferred to v2 (REAL-01) |
| IMAP EXAMINE for read-only | Lower priority than reliability hardening; deferred to v2 (ROM-08) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 10 | Complete |
| CONN-02 | Phase 12 | Complete |
| CONN-03 | Phase 12 | Complete |
| VAL-01 | Phase 10 | Complete |
| VAL-02 | Phase 11 | Complete |
| VAL-03 | Phase 10 | Complete |
| VAL-04 | Phase 10 | Complete |
| SAFE-01 | Phase 11 | Complete |
| SAFE-02 | Phase 10 | Complete |
| SAFE-03 | Phase 11 | Complete |
| QUAL-01 | Phase 12 | Complete |
| QUAL-02 | Phase 13 | Complete |

**Coverage:**
- v1.1.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — traceability populated after roadmap creation*
