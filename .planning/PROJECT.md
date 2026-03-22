# Mail MCP Server

## What This Is

A local Model Context Protocol (MCP) server that provides AI agents with structured, tool-based access to email accounts via IMAP and SMTP. Ships as `@honest-magic/mail-mcp` on npm — installable via `npx` or global install. Supports Gmail, Outlook, and any standard IMAP/SMTP provider.

## Core Value

Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.

## Current State

**v1.0.0 shipped 2026-03-22.** 14 MCP tools covering the full email lifecycle — read, search, send, thread, organize, attach. Read-only mode enforced at handshake. Published to npm under `@honest-magic/mail-mcp`. CI + tag-based publish via GitHub Actions.

- 1,312 TypeScript LOC (src), 678 test LOC, 55 passing tests
- Stack: imapflow, nodemailer, mailparser, pdf-parse, @modelcontextprotocol/sdk
- Repo: `github.com/honest-magic/mail-mcp`

## Requirements

### Validated

- ✓ **AUTH-01–04**: Keychain storage, TLS/SSL, user/password auth, OAuth2 (Gmail/Outlook) — v1.0.0
- ✓ **IMAP-01–04**: List messages, full content (Markdown), advanced search, folder listing — v1.0.0
- ✓ **SMTP-01–04**: Send email, CC/BCC, create draft, sync to Sent folder — v1.0.0
- ✓ **ORG-01–03**: Move messages, modify labels, batch operations (up to 100) — v1.0.0
- ✓ **THRD-01–03**: Thread reconstruction (x-gm-thrid + RFC 5256), conversation view — v1.0.0
- ✓ **RES-01–03**: Attachment metadata, on-demand content via MCP URIs, PDF text extraction — v1.0.0
- ✓ **ROM-01–07**: Read-only mode flag, write blocking, tool filtering, MCP handshake instructions, SMTP skip — v1.0.0
- ✓ **PKG-01–04**: npm package @honest-magic/mail-mcp, bin entry, files scoping, build artifact — v1.0.0
- ✓ **GH-01–02**: Public GitHub repo, consumer-facing README — v1.0.0
- ✓ **GHA-01–03**: CI workflow (tsc + vitest), tag-based publish, needs gate — v1.0.0
- ✓ **CONN-01**: Graceful shutdown (SIGTERM/SIGINT) with 10s forced-exit fallback — v1.1.0 Phase 10
- ✓ **VAL-01**: Account config Zod validation with actionable error messages — v1.1.0 Phase 10
- ✓ **VAL-03**: SMTP port-aware TLS auto-derivation (465=TLS, 587=STARTTLS) — v1.1.0 Phase 10
- ✓ **VAL-04**: In-memory config cache with fs.watch invalidation — v1.1.0 Phase 10
- ✓ **SAFE-02**: Typed error classes (AuthError, NetworkError, ValidationError, QuotaError) — v1.1.0 Phase 10
- ✓ **VAL-02**: Email address RFC 5322 validation on send/draft before SMTP — v1.1.0 Phase 11
- ✓ **SAFE-01**: Attachment size cap (50MB) via BODYSTRUCTURE check before download — v1.1.0 Phase 11
- ✓ **SAFE-03**: Per-account in-memory rate limiter (100 req/60s sliding window) — v1.1.0 Phase 11

### Out of Scope

- Hosting a mail server (client/adapter only)
- Proprietary APIs (Gmail/Outlook REST) — IMAP/SMTP preferred for compatibility
- Permanent local mailbox sync — real-time gateway model
- Runtime read-only toggle — mode is a startup contract
- Per-tool granular allow-listing — binary read/write mode is sufficient
- IMAP EXAMINE in read-only (ROM-08) — deferred to v2

## Constraints

- **Protocol**: Must use IMAP/SMTP for broad compatibility.
- **Environment**: Runs locally on macOS (Darwin); distributed via npm.
- **Interface**: Must adhere to the Model Context Protocol (MCP) specification.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript/Node.js | Rich MCP SDK, async-native, strong ecosystem | ✓ Good |
| imapflow over node-imap | Modern async/await, built-in IDLE, connection locking | ✓ Good |
| macOS Keychain via cross-keychain | Secure, no plaintext, works with npx global install | ✓ Good |
| Separate `move_email` + `modify_labels` tools | Clear semantics; Gmail labels ≠ IMAP folders | ✓ Good |
| Read-only at startup (not toggleable) | Startup contract is simpler and safer than runtime toggle | ✓ Good |
| `--read-only` filters tools from list | Prevents LLM from planning blocked operations | ✓ Good |
| Tag-based npm publish (not semantic-release) | Manual control over release timing; simpler CI pipeline | ✓ Good |

## Current Milestone: v1.1.0 Hardening & Reliability

**Goal:** Make the MCP server production-ready with robust connection lifecycle, input validation, error handling, and developer tooling.

**Target features:**
- Connection lifecycle management (graceful shutdown, reconnection)
- Account config validation (Zod schema on load)
- Email address validation on send
- SMTP port-aware TLS handling
- Attachment size limits
- Rate limiting per account
- Connection health checks
- Integration tests against real IMAP/SMTP
- Improved error messages with structured error types
- Pagination for large email lists

## Deferred (v2+)

- **REAL-01**: Real-time push via IMAP IDLE
- **CONT-01**: Contact lookup and history enrichment
- **AI-01**: Proactive inbox triage suggestions
- **ROM-08**: IMAP EXAMINE mode (no \Seen flag mutation in read-only)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 — Phase 11 complete (input validation & safety limits)*
