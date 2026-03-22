# Feature Landscape: Hardening & Reliability (Milestone v1.1.0)

**Domain:** MCP Tool Server — Node.js IMAP/SMTP hardening
**Researched:** 2026-03-22
**Overall Confidence:** HIGH (codebase read directly; imapflow, nodemailer, Zod docs verified via search)

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
| **Graceful shutdown (SIGTERM/SIGINT)** | Prevents connection leaks and stale IMAP sessions on server exit. Without this, every restart leaks a TCP connection. imapflow does not auto-reconnect or auto-close — the caller owns the lifecycle. | Low | Existing `MailService.disconnect()` method already exists; just need signal handlers in `index.ts` |
| **Account config Zod validation** | `accounts.json` entries have no schema enforcement. Missing `host`, `port`, or `authType` fields surface as cryptic runtime connect errors, not actionable startup errors. | Low | Zod already a dependency (`config.ts` uses it for env vars). Extend to `EmailAccount` shape. |
| **Email address validation on send** | No validation on `to`, `cc`, `bcc` before SMTP send. Malformed addresses cause SMTP rejections. RFC 5322 format check catches common mistakes without network round-trips. | Low | `send_email` and `create_draft` tool handlers in `index.ts` |
| **SMTP port-aware TLS (`secure`) derivation** | Port 465 requires `secure: true`; port 587 uses STARTTLS with `secure: false`. Currently callers must set `useTLS` manually. Auto-deriving from `smtpPort` removes a configuration foot-gun. | Low | `SmtpClient` constructor in `src/protocol/smtp.ts` |
| **Attachment size limit before download** | `get_attachment` and `extract_attachment_text` have no size guard. A 200 MB attachment will attempt full memory load. IMAP message structure (body part sizes) is available before fetching content. | Medium | `ImapClient.getAttachment()` in `src/protocol/imap.ts`; requires fetching `BODYSTRUCTURE` before part content |
| **Structured error types** | All tool errors return `Error: ${error.message}` plain text. MCP callers cannot branch on error type. Need typed error classes: `AuthError`, `NetworkError`, `ValidationError`, `QuotaError`. | Medium | `src/index.ts` tool dispatch; new `src/errors.ts` module |
| **Pagination for large email lists** | `listMessages()` buffers all results up to `count`. No way to fetch page 2. `count` max of 10 is an arbitrary default; users need offset-based access for large mailboxes. imapflow's `fetch()` is an async generator — pagination is a range slice over sorted UIDs. | Medium | `ImapClient.listMessages()` and `ImapClient.searchMessages()` in `src/protocol/imap.ts`; add `offset` param to tool schemas |

---

## Differentiators

Features that exceed the baseline hardening target and meaningfully improve production
experience or developer confidence.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| **In-memory per-account rate limiter** | Prevents a buggy or adversarial LLM agent from exhausting IMAP server quota (Gmail allows ~250 commands/min before throttling). Sliding window per account ID; no Redis needed — a plain `Map<string, number[]>` of timestamps is sufficient for a single-process local server. | Low | New `src/utils/rate-limiter.ts`; called in `getService()` in `index.ts` |
| **Connection health check (`--validate-accounts`)** | Tests IMAP CAPABILITY command and SMTP EHLO handshake at startup without loading message data. Surfaces auth failures and misconfigured TLS before the first tool call, giving users immediate actionable feedback. | Medium | New CLI flag parsed in entry point; calls `imapClient.connect()` + `client.getMailboxLock()` probe + `imapClient.logout()`; SMTP uses `nodemailer.verify()` |
| **Integration test suite (hoodiecrow + smtp-server)** | hoodiecrow-imap is a scriptable in-process IMAP server from the Nodemailer organization; smtp-server is the companion in-process SMTP server. Together they allow real protocol tests with no Docker dependency. Covers connection lifecycle, auth, search, send-and-append round-trips, and reconnect on error. | High | New `src/**/*.integration.test.ts` files; `hoodiecrow-imap` and `smtp-server` as devDependencies |
| **Account config caching with file watcher** | `getAccounts()` reads `accounts.json` synchronously on every tool call. Caching in memory with `fs.watch()` invalidation eliminates per-request file I/O. Relevant when many tools are called in rapid succession. | Low | `src/config.ts`; replaces current synchronous `readFileSync` pattern |
| **Improved error messages with context** | Error messages currently say `Error: [Errno 111] Connection refused`. Wrapping in typed errors lets responses say "IMAP connection to imap.gmail.com:993 refused — check host/port config for account work@example.com". Same thrown error, richer message. | Low | `src/errors.ts` (same module as structured error types above) |

---

## Anti-Features

Features that appear relevant to hardening but should not be built in v1.1.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **SQLite message cache** | Adds a persistent-state dependency to what is intentionally a stateless gateway. Cache invalidation against live IMAP is non-trivial; stale cache is worse than no cache for an AI agent that expects current data. | CONCERNS.md notes this as a "No Persistent Message Cache" problem — defer to v2 IDLE feature where real-time sync is the proper solution |
| **Redis-backed rate limiter** | This is a local single-process server. Redis adds an external process dependency for zero benefit. An in-memory Map is correct here. | Use in-memory sliding window (see Differentiators) |
| **Docker/Testcontainers for integration tests** | GreenMail via Testcontainers works but requires Docker running during CI. The hoodiecrow + smtp-server approach runs entirely in-process with no external dependencies — better fit for a local MCP server. | Use hoodiecrow-imap + smtp-server (see Differentiators) |
| **Real-time IMAP IDLE push** | Out of scope for v1.1.0. Requires significant architecture change: imapflow IDLE emits events that need a persistent subscriber loop, which conflicts with the current request/response tool model. | Deferred to v2 per PROJECT.md (REAL-01) |
| **IMAP EXAMINE mode for read-only** | Deferred from v1.0.0. Valid feature but lower priority than reliability hardening. Does not affect tool correctness — only prevents implicit `\Seen` flag mutation on `read_email`. | Deferred to v2 per PROJECT.md (ROM-08) |
| **Per-account configurable batch size limits** | CONCERNS.md notes this is fragile, but making it per-account config adds surface area to `accounts.json` schema. The simpler fix is a sensible default (50 UIDs) enforced in code. | Hard-code to 50 UIDs in `MailService.batchOperations()` |

---

## Feature Dependencies

```
Graceful shutdown
  → requires: MailService.disconnect() [already exists in src/services/mail.ts]
  → wire: process.on('SIGTERM') and process.on('SIGINT') in src/index.ts

Account config Zod validation
  → requires: Zod [already a dependency]
  → extends: EmailAccount interface in src/types/index.ts
  → called by: getAccounts() in src/config.ts
  → enables: --validate-accounts health check (validation needed before connect attempt)

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
  → configurable default in account or global config

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
  → requires: imapflow connect + CAPABILITY probe
  → requires: nodemailer.verify() for SMTP
  → new CLI flag parsed in entry point before server construction

Integration tests
  → requires: hoodiecrow-imap (devDependency)
  → requires: smtp-server (devDependency — from Nodemailer org)
  → tests: graceful shutdown, auth errors, search, send, attachment, reconnect
  → independent of production code changes (can be added incrementally)

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
3. **Email address validation** — Simple regex or lightweight import in tool handlers. Catches malformed recipients before SMTP handshake.
4. **Account config caching** — Module-level cache + fs.watch in `config.ts`. Removes per-request file I/O with no behavioral change.

**Group 2 — Schema and error quality:**
5. **Account config Zod validation** — Extend existing Zod usage to `EmailAccount` shape. Surfaces bad config at startup, not at connect time.
6. **Structured error types** — New `src/errors.ts`. Enables richer error messages throughout without changing tool surface area.

**Group 3 — Safety limits:**
7. **Attachment size limit** — Fetch `BODYSTRUCTURE` before content; reject if over limit. Prevents memory exhaustion.
8. **Per-account rate limiter** — In-memory sliding window. Prevents quota exhaustion from runaway agents.

**Group 4 — Discovery and testing:**
9. **Pagination for large email lists** — Add `offset` param to `list_emails` and `search_emails` tool schemas and wire into IMAP UID range slicing.
10. **Connection health check** — `--validate-accounts` CLI flag that probes IMAP/SMTP without loading messages.
11. **Integration test suite** — hoodiecrow-imap + smtp-server. Highest effort but highest long-term value; covers all the above in real protocol paths.

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
| Integration tests | 8-12h | High (new test infra, server setup/teardown) |

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
imapflow does not auto-reconnect or auto-close connections. The `close` event fires when a connection drops, but no built-in reconnection follows. This means `MailMCPServer.services` must be iterated and each `MailService.disconnect()` called on process signals.

```typescript
// In src/index.ts main()
const shutdown = async () => {
  await server.cleanup(); // calls disconnect() on all services
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

A forced exit timeout (10 seconds) prevents hung processes if imapflow logout stalls.

### Attachment Size Limit
IMAP `BODYSTRUCTURE` response includes byte sizes for each body part before content is downloaded. The check happens at `get_attachment` and `extract_attachment_text` call time: fetch structure → read size → compare to limit → reject or proceed. Default limit: 50 MB (configurable via account config or environment variable).

### Rate Limiter
Sliding window per account ID. Window: 60 seconds, max requests: 100 (configurable). Implementation: `Map<accountId, number[]>` of timestamps. On each tool dispatch, evict timestamps older than the window, check count, push current timestamp. No external dependency. Appropriate for a single-process local server.

### Integration Test Strategy
Two approaches are viable:

**Option A — In-process (recommended):** `hoodiecrow-imap` (scriptable IMAP, from Nodemailer org) + `smtp-server` (in-process SMTP, from Nodemailer org). No Docker required. Tests run in the same Vitest process. Clean setup/teardown per test file. Best fit for a local CLI tool with CI that runs without Docker.

**Option B — Docker + Testcontainers + GreenMail:** Full protocol fidelity (GreenMail is a real Java IMAP/SMTP implementation). Requires Docker during CI. Slower startup. Better for verifying edge cases against a stricter RFC-compliant server. Overkill for v1.1.0.

**Recommendation:** Option A for v1.1.0. Adds hoodiecrow-imap and smtp-server as devDependencies only.

### Email Address Validation
`email-addresses` (npm) is an RFC 5322 parser at ~25KB. Alternatively, a well-tested regex covering the common cases (no full RFC 5322 coverage needed for sending) is sufficient and zero-dependency. The validation catches `user@` (missing domain), `@domain.com` (missing local), and plaintext strings. It does not require DNS/MX lookups — format only.

### SMTP Port-Aware TLS
Nodemailer's documented convention (HIGH confidence — official docs):
- Port 465: `secure: true` (TLS from start)
- Port 587: `secure: false` (STARTTLS — nodemailer auto-upgrades if server advertises it)
- Port 25: `secure: false` (plain SMTP, rarely used for submission)

Currently `useTLS: boolean` in `EmailAccount` is the sole signal. Adding auto-derivation from `smtpPort` when `useTLS` is not explicitly set eliminates the mismatch case.

---

## Sources

- imapflow reconnect behavior (no auto-reconnect): [GitHub Issue #63](https://github.com/postalsys/imapflow/issues/63) (MEDIUM confidence)
- imapflow connection methods: [ImapFlow API Docs](https://imapflow.com/docs/api/imapflow-client/) (HIGH confidence)
- Nodemailer SMTP port/TLS convention: [Nodemailer SMTP docs](https://nodemailer.com/smtp) (HIGH confidence)
- Zod config validation pattern: [Zod official docs](https://zod.dev/) (HIGH confidence)
- hoodiecrow-imap in-process IMAP server: [GitHub andris9/hoodiecrow](https://github.com/andris9/hoodiecrow) (MEDIUM confidence — last active 2022; still functional for integration tests)
- smtp-server in-process SMTP: [npm smtp-server](https://www.npmjs.com/package/smtp-server) (HIGH confidence — Nodemailer org, actively maintained)
- GreenMail + Testcontainers + Vitest: [Vitest Testcontainers guide](https://dev.to/jcteague/using-testconatiners-with-vitest-499f) (MEDIUM confidence)
- Node.js SIGTERM/SIGINT graceful shutdown: [OneUptime blog 2026-01-06](https://oneuptime.com/blog/post/2026-01-06-nodejs-graceful-shutdown-handler/view) (MEDIUM confidence)
- imapflow NOOP / health check: [ImapFlow Docs](https://imapflow.com/module-imapflow-ImapFlow.html) (HIGH confidence)
- rate-limiter-flexible in-memory: [GitHub animir/node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) (HIGH confidence — supports memory store)
- email-addresses RFC 5322 parser: [GitHub jackbearheart/email-addresses](https://github.com/jackbearheart/email-addresses) (MEDIUM confidence)
- Codebase concerns audit: `.planning/codebase/CONCERNS.md` (HIGH confidence — read directly)
- Existing source: `src/config.ts`, `src/services/mail.ts`, `src/types/index.ts` (HIGH confidence — read directly)
