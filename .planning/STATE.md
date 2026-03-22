---
gsd_state_version: 1.0
milestone: v1.1.0
milestone_name: Hardening & Reliability
status: roadmap_ready
stopped_at: null
last_updated: "2026-03-22T00:00:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 10 — Connection Lifecycle & Error Infrastructure

## Current Position

Phase: 10 — Connection Lifecycle & Error Infrastructure
Plan: —
Status: Not started (roadmap complete, ready to plan)
Last activity: 2026-03-22 — Roadmap created for v1.1.0

Progress: ░░░░░░░░░░ 0/4 phases complete

## Performance Metrics

- **Phases Completed:** 0/4 (v1.1.0)
- **Requirements Covered:** 0/12 (v1.1.0 requirements pending)
- **Current Velocity:** —

## Accumulated Context

### Key Decisions

- **Stack:** Node.js with TypeScript.
- **Protocol:** IMAP/SMTP via `imapflow` and `nodemailer`.
- **Security:** Use macOS Keychain via `cross-keychain`.
- **Infrastructure:** Local Model Context Protocol (MCP) server.
- **Search:** Support unified search interface (from, subject, since, before).
- **Organization:** Unified tool for moving emails and separate tool for labels (flags).
- **Threading:** Use header-based reconstruction (Message-ID, References) with X-GM-EXT-1 optimization.
- **Attachments:** Return metadata first, fetch content on-demand via tools/resources.
- **PDF Extraction:** Use `pdf-parse`.
- **Batching:** Limit batch operations to 100 emails at once. Use comma-joined UID sequences for imapflow batch calls.
- **Read-Only Mode:** Enforce exclusively at the MCP dispatch layer (`src/index.ts`); service layer has zero knowledge of mode.
- **Write Refusal Message Format:** Must name the blocked tool and state the mode.
- **Mode Discovery:** Delivered via `InitializeResult.instructions` at MCP handshake.
- **SMTP Skip:** Skip `smtpClient.connect()` in `MailService` when `readOnly === true`; IMAP EXAMINE deferred to v2 (ROM-08).
- **npm Package Name:** `@honest-magic/mail-mcp`, version `1.0.0`, scoped public under `honest-magic` org.
- **bin Entry:** `"mail-mcp": "dist/index.js"` — enables `npx @honest-magic/mail-mcp` and global install.
- **Publish Strategy:** Simple tag-based (push `v*` tag → publish). No semantic-release or changesets.
- **CI Gate:** Publish workflow has `needs: ci` — broken builds cannot publish.
- **Account Config:** Account definitions read from `~/.config/mail-mcp/accounts.json`. Credentials remain in macOS Keychain.

### v1.1.0 Decisions (new for this milestone)

- **Typed Error Classes:** Use `MailMCPError` base class with `MailErrorCode` enum (`AuthError`, `NetworkError`, `ValidationError`, `QuotaError`). Map to `McpError`/`ErrorCode` at the MCP boundary without leaking internals.
- **Config Validation:** Per-item `safeParse` on account array — one bad account does not prevent valid accounts from loading.
- **Config Caching:** In-memory cache with `fs.watch()` invalidation. Eliminates per-call `fs.readFileSync`.
- **SMTP TLS Derivation:** Port 465 → `secure: true`; port 587 → `secure: false` with STARTTLS. Enforced via Zod `.refine()` in the account schema.
- **Graceful Shutdown:** `shuttingDown` flag + in-flight request counter + 10-second forced exit deadline.
- **Rate Limiter:** `RateLimiterMemory` from `rate-limiter-flexible`, instantiated per `MailMCPServer` (not singleton). Per-account `Map<accountId, RateLimiter>`. Default: 100 req/60s sliding window.
- **Attachment Size Guard:** Check BODYSTRUCTURE-reported size before content download. Default cap: 50 MB.
- **Email Validation:** Simple safe regex (no RFC 5322 full regex — ReDoS risk). Check all addresses in to/cc/bcc before SMTP send.
- **Reconnect:** One retry only with exponential backoff. Remove dead `MailService` from `services` Map on `close` event. Never re-use after close.
- **Pagination:** `offset` parameter on `list_emails` and `search_emails`. imapflow UID range slicing.
- **Health Check:** `--validate-accounts` CLI flag probes IMAP CAPABILITY + SMTP EHLO per account. Exits after reporting.
- **Integration Tests:** Separate `vitest.integration.config.ts` including only `*.integration.test.ts`. SMTP tests use in-process `smtp-server`. IMAP tests use real credentials via `TEST_IMAP_*` env vars with `describe.skipIf` guard.
- **New packages:** `rate-limiter-flexible ^10.0.1` (production), `smtp-server ^3.18.1` (devDependency), `@types/smtp-server ^3.5.x` (devDependency).

### Critical Blockers

- None identified.

### Technical Debt / Todo

- Verify `smtp-server ^3.18.1` CommonJS module loads correctly in the ESM Vitest 4.x `globalSetup` environment before Phase 13 planning.
- Decide CI secret injection strategy (which provider, dedicated test account vs. developer account) before Phase 13 planning.
- Confirm `rate-limiter-flexible ^10.0.1` `RateLimiterMemory` constructor and `consume()` API against actual TypeScript types in `node_modules/` before Phase 11 implementation.
- Confirm whether `client.usable`, `client.authenticated`, or a combination is the correct imapflow v1.2.x liveness indicator for the reconnect guard.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260321 | Fix 3 audit gaps: SMTP-04, THRD non-Gmail, IMAP-01 snippet | 2026-03-21 | c6f1bf2 | [260321-fix-audit-gaps](.planning/quick/260321-fix-audit-gaps/) |
| 260322-l1d | Replace ACCOUNTS_JSON env var with ~/.config/mail-mcp/accounts.json | 2026-03-22 | d066b29 | [260322-l1d-replace-accounts-json-env-var-with-confi](.planning/quick/260322-l1d-replace-accounts-json-env-var-with-confi/) |
| 260322-ms9 | Add CLI helper commands for managing accounts (add/list/remove) | 2026-03-22 | 26f07bc | [260322-ms9-add-cli-helper-commands-for-managing-acc](.planning/quick/260322-ms9-add-cli-helper-commands-for-managing-acc/) |

## Session Continuity

**Last Action:** Roadmap created for v1.1.0 Hardening & Reliability (Phases 10–13, 12 requirements mapped).
**Next Step:** Plan Phase 10 — `/gsd:plan-phase 10`
**Stopped At:** Roadmap creation complete.
**Context for Next Agent:** v1.1.0 roadmap is ready. Phase 10 is the first phase — it covers connection lifecycle (CONN-01), config validation (VAL-01), SMTP TLS auto-derivation (VAL-03), config caching (VAL-04), and typed error classes (SAFE-02). Typed errors are in Phase 10 (not Phase 11) because every downstream phase depends on them. The research file at `.planning/research/SUMMARY.md` has a full pitfall list — H-01 (no auto-reconnect), H-02 (lock deadlock), H-03 (SIGTERM drain) are critical for Phase 10 implementation. Before Phase 11 rate limiting, verify `RateLimiterMemory` API. Before Phase 13, verify smtp-server ESM/Vitest compatibility and decide CI IMAP credentials strategy.
