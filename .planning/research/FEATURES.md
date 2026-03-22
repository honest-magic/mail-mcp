# Feature Landscape: Hardening & Reliability (Milestone v1.1.0)

**Domain:** MCP Tool Server — Node.js IMAP/SMTP hardening
**Researched:** 2026-03-22
**Overall Confidence:** HIGH (codebase read directly; imapflow, nodemailer, Zod docs verified)

## Context: Subsequent Milestone

This research is scoped to the **v1.1.0 hardening and reliability milestone**. All 14 MCP tools,
read-only mode, CLI account management, and npm packaging are already shipped in v1.0.0.
This file documents only the new features required for production-grade reliability and DX.

**Identified gap areas (from CONCERNS.md):**
- Connection leaks: `MailMCPServer.services` map never disconnects on exit
- No Zod validation on `accounts.json` account entries (only config env vars validated)
- No email address validation before SMTP send
- SMTP `secure`/TLS not derived from port — callers must set it manually
- No attachment size guard before downloading
- No rate limiting — a buggy agent could exhaust IMAP server quota
- No startup health check — misconfigured accounts fail silently at tool-call time
- No integration tests against real IMAP/SMTP
- No pagination for large email lists
- Unstructured error responses (plain `Error: message` string)

---

## Table Stakes

Features that must ship for v1.1.0 to be considered production-ready. Missing any of these
leaves a known reliability hole that was explicitly called out in CONCERNS.md.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Graceful shutdown (SIGTERM/SIGINT)** | Prevents connection leaks and stale IMAP sessions on server exit. Without this, every restart leaks a TCP connection. imapflow has no auto-reconnect and no auto-close — the caller owns the lifecycle. | Low | Existing `MailService.disconnect()` already exists; add signal handlers in `src/index.ts` |
| **Account config Zod validation** | `accounts.json` entries have no schema enforcement. Missing `host`, `port`, or `authType` fields surface as cryptic runtime connect errors, not actionable startup errors. | Low | Zod already a dependency (`config.ts` uses it for env vars); extend to `EmailAccount` shape |
| **Email address validation on send** | No validation on `to`, `cc`, `bcc` before SMTP send. Malformed addresses cause SMTP rejections. RFC 5322 format check catches common mistakes without network round-trips. | Low | `send_email` and `create_draft` tool handlers in `src/index.ts` |
| **SMTP port-aware TLS (`secure`) derivation** | Port 465 requires `secure: true`; port 587 uses STARTTLS with `secure: false`. Currently callers must set `useTLS` manually. Auto-deriving from `smtpPort` removes a configuration foot-gun. | Low | `SmtpClient` constructor in `src/protocol/smtp.ts` |
| **Attachment size limit before download** | `get_attachment` and `extract_attachment_text` have no size guard. A 200 MB attachment will attempt full memory load. IMAP `BODYSTRUCTURE` gives sizes before content is fetched. | Medium | `ImapClient` in `src/protocol/imap.ts`; requires fetching `BODYSTRUCTURE` before part content |
| **Structured error types** | All tool errors return `Error: ${error.message}` plain text. MCP callers cannot branch on error type. Need typed error classes: `AuthError`, `NetworkError`, `ValidationError`, `QuotaError`. | Medium | `src/index.ts` tool dispatch; new `src/errors.ts` module |
| **Pagination for large email lists** | `listMessages()` buffers all results up to `count`. No way to fetch page 2. imapflow's `fetch()` is an async generator — pagination is a range slice over sorted UIDs. | Medium | `ImapClient.listMessages()` and `ImapClient.searchMessages()`; add `offset` param to tool schemas |

---

## Differentiators

Features that exceed the baseline hardening target and meaningfully improve production
experience or developer confidence.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| **In-memory per-account rate limiter** | Prevents a buggy or adversarial LLM agent from exhausting IMAP server quota (Gmail allows ~250 commands/min before throttling). Sliding window per account ID; no Redis needed — a plain `Map<string, number[]>` of timestamps is sufficient for a single-process local server. | Low | New `src/utils/rate-limiter.ts`; called in `getService()` or tool dispatch in `src/index.ts` |
| **Connection health check (`--validate-accounts`)** | Tests IMAP CAPABILITY command and SMTP EHLO handshake at startup without loading message data. Surfaces auth failures and misconfigured TLS before the first tool call, giving users immediate actionable feedback. | Medium | New CLI flag in entry point; calls `imapClient.connect()` + NOOP probe + `imapClient.disconnect()`; SMTP uses `nodemailer.verify()` |
| **Integration test suite (smtp-server + real IMAP credentials)** | `smtp-server` (Nodemailer org, v3.18.1, Jan 2026 — actively maintained) provides an in-process SMTP server for real send/receive tests. For IMAP: `hoodiecrow-imap` is deprecated (10 years old, last publish 2015); `imapper` is also stale (last publish 2022). Viable IMAP integration testing requires either: (A) a real IMAP account via CI secrets, or (B) GreenMail via Docker. Option A is the pragmatic choice for a local tool — test against a real Gmail account with app password stored in CI secrets. | High | `smtp-server` devDependency for outbound; real IMAP credentials in CI for inbound; `vitest` test runner already present |
| **Account config caching with file watcher** | `getAccounts()` reads `accounts.json` synchronously on every tool call. A module-level cache with `fs.watch()` invalidation eliminates per-request file I/O. | Low | `src/config.ts`; replaces current synchronous `readFileSync` pattern |
| **Improved error messages with context** | Errors currently say `Error: [Errno 111] Connection refused`. Wrapping in typed errors lets responses say "IMAP connection to imap.gmail.com:993 refused — check host/port for account work@example.com". Same thrown error, richer message. | Low | `src/errors.ts` (same module as structured error types above) |
| **Reconnect on connection drop** | imapflow emits `'close'` when connection drops; no auto-reconnect. A `close` listener in `ImapClient` can attempt one reconnect with exponential backoff before failing. Prevents zombie cached services after network blip. | Medium | `ImapClient.connect()` in `src/protocol/imap.ts`; `MailMCPServer.services` cache invalidation in `src/index.ts` |

---

## Anti-Features

Features that appear relevant to hardening but should not be built in v1.1.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **SQLite message cache** | Adds a persistent-state dependency to what is intentionally a stateless gateway. Cache invalidation against live IMAP is non-trivial; stale cache is worse than no cache for an AI agent that expects current data. | Defer to v2 IDLE feature where real-time sync is the proper solution |
| **Redis-backed rate limiter** | This is a local single-process server. Redis adds an external process dependency for zero benefit. | Use in-memory sliding window (see Differentiators) |
| **Docker/Testcontainers for integration tests** | GreenMail via Testcontainers works but requires Docker running during CI. For a local MCP tool, Docker as a CI dependency is heavyweight. | Use smtp-server (in-process) + real IMAP credentials in CI (see Differentiators) |
| **hoodiecrow-imap for IMAP integration tests** | Deprecated — last published to npm ~10 years ago (2015). No maintenance, no ESM support, no modern Node.js compatibility guarantees. | Use real IMAP account via CI secrets for IMAP tests |
| **Real-time IMAP IDLE push** | Out of scope for v1.1.0. Requires significant architecture change: imapflow IDLE emits events that need a persistent subscriber loop, which conflicts with the current request/response tool model. | Deferred to v2 per PROJECT.md (REAL-01) |
| **IMAP EXAMINE mode for read-only** | Deferred from v1.0.0. Valid feature but lower priority than reliability hardening. Does not affect tool correctness — only prevents implicit `\Seen` flag mutation on `read_email`. | Deferred to v2 per PROJECT.md (ROM-08) |
| **Per-account configurable batch size limits** | CONCERNS.md notes this is fragile, but making it per-account config adds surface area to `accounts.json` schema. The simpler fix is a sensible hard-coded default. | Hard-code to 50 UIDs in `MailService.batchOperations()` |

---

## Feature Dependencies

```
Graceful shutdown
  → requires: MailService.disconnect() [already exists in src/services/mail.ts]
  → wire: process.on('SIGTERM') and process.on('SIGINT') in src/index.ts
  → add: forced exit timeout (10s) to handle hung imapflow logout

Account config Zod validation
  → requires: Zod [already a dependency]
  → extends: EmailAccount interface in src/types/index.ts
  → called by: getAccounts() in src/config.ts
  → enables: --validate-accounts health check (validation must run before connect attempt)

Email address validation
  → requires: RFC 5322 format check (regex or lightweight lib)
  → called by: send_email and create_draft handlers in src/index.ts
  → independent of all other features

SMTP port-aware TLS derivation
  → requires: smtpPort field on EmailAccount (already present as optional)
  → applied in: SmtpClient constructor in src/protocol/smtp.ts
  → independent of all other features

Attachment size limit
  → requires: BODYSTRUCTURE fetch before part content fetch
  → applied in: ImapClient.getAttachment() in src/protocol/imap.ts
  → configurable default (50 MB) in account or global config

Structured error types
  → new file: src/errors.ts
  → consumed by: all tool handlers in src/index.ts
  → enables: richer error messages (same module)

Pagination
  → requires: offset parameter added to list_emails and search_emails tool schemas
  → applied in: ImapClient.listMessages() and ImapClient.searchMessages()
  → independent of other features

Per-account rate limiter
  → requires: account ID available at dispatch time [already available via getService()]
  → new file: src/utils/rate-limiter.ts
  → called by: getService() or top of each tool handler in src/index.ts

Connection health check (--validate-accounts)
  → requires: Account config Zod validation [validates accounts before probing]
  → requires: imapflow connect + NOOP/CAPABILITY probe
  → requires: nodemailer.verify() for SMTP
  → new CLI flag parsed in entry point before server construction

Reconnect on connection drop
  → requires: ImapClient close event listener
  → invalidates: cached MailService in MailMCPServer.services
  → independent of other features; adds reliability to existing IMAP ops

Integration tests
  → requires: smtp-server (devDependency — Nodemailer org, actively maintained)
  → requires: real IMAP account credentials in CI secrets for inbound path
  → tests: graceful shutdown, auth errors, search, send, attachment, reconnect
  → can be added incrementally alongside production code changes

Account config caching
  → replaces: synchronous readFileSync in getAccounts()
  → requires: fs.watch() or similar for invalidation
  → independent of all other features
```

---

## MVP Recommendation

Build in this order, grouped by risk and dependency:

**Group 1 — Zero-risk, high-value fixes (do first):**
1. **Graceful shutdown** — 3-4 lines in `src/index.ts`. No new dependencies. Eliminates connection leak on every server restart.
2. **SMTP port-aware TLS** — 1 conditional in `SmtpClient` constructor. Eliminates a class of misconfiguration silently swallowed today.
3. **Email address validation** — Simple regex in tool handlers. Catches malformed recipients before SMTP handshake.
4. **Account config caching** — Module-level cache + fs.watch in `config.ts`. Removes per-request file I/O with no behavioral change.

**Group 2 — Schema and error quality:**
5. **Account config Zod validation** — Extend existing Zod usage to `EmailAccount` shape. Surfaces bad config at startup, not at connect time.
6. **Structured error types** — New `src/errors.ts`. Enables richer error messages throughout without changing tool surface area.

**Group 3 — Safety limits:**
7. **Attachment size limit** — Fetch `BODYSTRUCTURE` before content; reject if over limit. Prevents memory exhaustion.
8. **Per-account rate limiter** — In-memory sliding window. Prevents quota exhaustion from runaway agents.

**Group 4 — Discovery and testing:**
9. **Pagination for large email lists** — Add `offset` param to `list_emails` and `search_emails` schemas and wire into IMAP UID range slicing.
10. **Connection health check** — `--validate-accounts` CLI flag that probes IMAP/SMTP without loading messages.
11. **Reconnect on connection drop** — Close event listener + single retry in `ImapClient`.
12. **Integration test suite** — smtp-server (in-process) + real IMAP credentials in CI. Highest effort but highest long-term value.

**Defer from this milestone:**
- SQLite cache (complexity/correctness tradeoff)
- IMAP EXAMINE mode (v2)
- IMAP IDLE (v2)

---

## Complexity and Effort Estimates

| Feature | Effort | Risk |
|---------|--------|------|
| Graceful shutdown | 1h | Low |
| SMTP port-aware TLS | 30min | Low |
| Email address validation | 1h | Low |
| Account config caching | 2h | Low |
| Account config Zod validation | 2h | Low |
| Structured error types | 3h | Low |
| Per-account rate limiter | 2h | Low |
| Attachment size limit | 3h | Medium (requires BODYSTRUCTURE protocol path) |
| Pagination | 3h | Medium (touches tool schema + IMAP UID range logic) |
| Connection health check | 4h | Medium (requires probing each account cleanly) |
| Reconnect on connection drop | 3h | Medium (close event + cache invalidation coordination) |
| Integration tests | 8-12h | High (new test infra, CI secrets, server setup/teardown) |

---

## MCP-Specific Notes

**Tool schema changes required for pagination:**
- `list_emails`: add optional `offset: number` (default 0) to `inputSchema`
- `search_emails`: add optional `offset: number` (default 0) to `inputSchema`
- No existing tools need removal or rename

**Error response format stays the same:**
- MCP tool errors already return `{ content: [{ type: 'text', text: '...' }], isError: true }`
- Structured error types improve the `text` content without changing the envelope
- No MCP protocol version changes needed

**Backward compatibility:**
- All 14 existing tool names and input schemas remain unchanged (except adding optional `offset`)
- `--read-only` flag behavior unchanged
- `accounts.json` format unchanged (Zod validates the same shape, just throws if malformed)

---

## Implementation Notes by Feature

### Graceful Shutdown
imapflow does not auto-reconnect or auto-close connections. The `close` event fires when a connection drops, but no built-in reconnection follows. `MailMCPServer.services` must be iterated and each `MailService.disconnect()` called on process signals. A forced exit timeout (10 seconds) prevents hung processes if imapflow logout stalls.

```typescript
// In src/index.ts main()
const shutdown = async () => {
  await server.cleanup(); // calls disconnect() on all services
  process.exit(0);
};
const forceExit = setTimeout(() => process.exit(1), 10_000);
forceExit.unref();
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Attachment Size Limit
IMAP `BODYSTRUCTURE` response includes byte sizes for each body part before content is downloaded. The check happens at `get_attachment` and `extract_attachment_text` call time: fetch structure → read size → compare to limit → reject or proceed. Default limit: 50 MB.

### Rate Limiter
Sliding window per account ID. Window: 60 seconds, max requests: 100. Implementation: `Map<accountId, number[]>` of timestamps. On each tool dispatch, evict timestamps older than the window, check count, push current timestamp. No external dependency required.

### Integration Test Strategy

**SMTP (in-process — recommended):** `smtp-server` from the Nodemailer organization (v3.18.1, actively maintained through January 2026) provides a scriptable in-process SMTP server. Tests real nodemailer send paths without network calls. Suitable for CI with no external services.

**IMAP (real credentials — recommended for v1.1.0):** No in-process IMAP server is a viable option:
- `hoodiecrow-imap` — deprecated, last published 2015, no ESM support
- `imapper` — last published 2022, maintenance status unclear
- `imap-core` — low-level, not a ready-made test server

The pragmatic approach for v1.1.0: test IMAP flows against a real account (dedicated Gmail with app password) stored in GitHub Actions secrets. Tests are skipped locally unless credentials are set. This covers the real protocol paths that matter most (connection, auth, search, fetch) without adding a stale dependency.

**Docker option (deferred):** GreenMail via Testcontainers provides a standards-compliant IMAP/SMTP server in Docker. Valid but heavyweight for a local CLI tool; defer to v2 if in-process fidelity becomes important.

### Email Address Validation
A well-tested RFC 5322 regex covering common cases (no full RFC 5322 coverage needed for sending) is sufficient and zero-dependency. The validation catches `user@` (missing domain), `@domain.com` (missing local), and plaintext strings. Does not require DNS/MX lookups — format only. Alternative: `email-addresses` npm package (~25KB) for stricter RFC 5322 parsing.

### SMTP Port-Aware TLS
Nodemailer's documented convention (HIGH confidence — official docs):
- Port 465: `secure: true` (TLS from connection start)
- Port 587: `secure: false` (STARTTLS — nodemailer auto-upgrades if server advertises it)
- Port 25: `secure: false` (plain SMTP, rarely used for submission)

Auto-derive from `smtpPort` when `useTLS` is not explicitly set in `EmailAccount`.

### Reconnect on Connection Drop
imapflow emits a `'close'` event on connection drop (confirmed in official docs and issue #63). The `ImapClient` should listen for this event and attempt one reconnect before invalidating the cached `MailService` in `MailMCPServer.services`. The next tool call will trigger fresh service creation.

---

## Sources

- imapflow no auto-reconnect — confirmed: [ImapFlow Docs](https://imapflow.com/module-imapflow-ImapFlow.html) (HIGH confidence)
- imapflow close event behavior: [GitHub Issue #63](https://github.com/postalsys/imapflow/issues/63) (MEDIUM confidence)
- Nodemailer SMTP port/TLS convention: [Nodemailer SMTP docs](https://nodemailer.com/smtp) (HIGH confidence)
- smtp-server actively maintained (v3.18.1, 2026-01-28): npm registry (HIGH confidence)
- hoodiecrow-imap deprecated (v2.1.0, ~10 years old): [npm hoodiecrow-imap](https://www.npmjs.com/package/hoodiecrow-imap) (HIGH confidence)
- imapper last published 2022-06-19: npm registry (HIGH confidence)
- Zod config validation pattern: [Zod official docs](https://zod.dev/) (HIGH confidence)
- imapflow NOOP/CAPABILITY for health check: [ImapFlow Client API](https://imapflow.com/docs/api/imapflow-client/) (HIGH confidence)
- Node.js SIGTERM/SIGINT graceful shutdown patterns: standard Node.js docs (HIGH confidence)
- rate-limiter-flexible in-memory store: [GitHub animir/node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) (HIGH confidence)
- email-addresses RFC 5322 parser: [npm email-addresses](https://www.npmjs.com/package/email-addresses) (MEDIUM confidence)
- Codebase concerns audit: `.planning/codebase/CONCERNS.md` (HIGH confidence — read directly)
- Existing source files: `src/protocol/imap.ts`, `src/services/mail.ts`, `src/index.ts`, `src/types/index.ts` (HIGH confidence — read directly)
