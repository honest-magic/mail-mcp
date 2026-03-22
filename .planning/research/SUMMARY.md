# Project Research Summary

**Project:** Mail MCP Server — v1.1.0 Hardening & Reliability
**Domain:** MCP Tool Server / Email Infrastructure (IMAP/SMTP)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

The v1.0.0 Mail MCP Server ships a fully functional 14-tool IMAP/SMTP gateway. Direct codebase analysis (CONCERNS.md) identified ten reliability gaps that block production use: connection leaks on exit, unvalidated account config, no rate limiting, no email address validation, missing attachment size guards, no startup health check, no integration tests, no pagination, and unstructured error responses. The v1.1.0 milestone is a surgical hardening pass — not new feature work. All gaps are well-understood and addressable without new architecture or significant refactoring. Only three packages need to be added: `rate-limiter-flexible` (production), `smtp-server`, and `@types/smtp-server` (both devDependencies).

The recommended approach builds in four sequential groups ordered by dependency and risk: (1) connection lifecycle and config validation — which everything else depends on, (2) input validation and safety limits, (3) pagination and health check tooling, and (4) integration tests as the final validation layer. Each group is independently shippable. The existing five-layer architecture (`MailMCPServer → MailService → ImapClient/SmtpClient → Keychain/OAuth2`) is sound and requires no restructuring — all new features attach at precise existing integration points.

The dominant risks are not in the new features but in the existing connection model and the implementation details of connecting lifecycle: ImapFlow does not auto-reconnect (H-01 critical), mailbox locks must use `finally` blocks or deadlock indefinitely (H-02 critical), and a naive SIGTERM handler can corrupt in-flight IMAP batch operations (H-03 critical). All three are preventable with known patterns and must be addressed before any other hardening work is layered on top.

## Key Findings

### Recommended Stack

The existing stack is validated and fixed. Net-new additions for v1.1.0 are minimal. See `.planning/research/STACK.md` for full detail.

**Core technologies (existing — treat as fixed):**
- `imapflow ^1.2.16`: IMAP client — modern async/await, handles connection locking; caller owns lifecycle (no auto-reconnect)
- `nodemailer ^8.0.3`: SMTP client — `secure` and `requireTLS` options handle all port/TLS combinations
- `mailparser ^3.9.4`: MIME parsing — attachment and body extraction
- `zod ^4.3.6`: Schema validation — already in use for env vars; extend to `EmailAccount` shape
- `vitest ^4.1.0`: Test runner — extend with a separate `vitest.integration.config.ts`

**New additions only:**
- `rate-limiter-flexible ^10.0.1` (production): `RateLimiterMemory` for per-account in-memory sliding window; 416K weekly downloads, TypeScript bundled, no external storage dependency
- `smtp-server ^3.18.1` (devDependency): In-process SMTP listener from the Nodemailer team; enables real send/receive integration tests without Docker
- `@types/smtp-server ^3.5.x` (devDependency): TypeScript types for smtp-server (ships CJS without bundled types)

**What to explicitly avoid adding:** SQLite cache (stateful, invalidation complexity outweighs benefit), Redis-backed rate limiter (local single-process server needs no external storage), `hoodiecrow-imap` (abandoned 8 years, zero dependents, no ESM support), GreenMail via Docker/testcontainers (heavyweight for a local CLI tool), `ts-custom-error` (ES2022 class extension is sufficient).

**IMAP integration testing:** No viable in-process IMAP server exists. Use real account credentials via `TEST_IMAP_*` environment variables with `describe.skipIf(!process.env.TEST_IMAP_HOST)` — the same pattern used by the imapflow test suite.

### Expected Features

All features are hardening — no new tool surface area except an optional `offset` parameter on `list_emails` and `search_emails`. See `.planning/research/FEATURES.md` for effort estimates and the full dependency graph.

**Must have (table stakes — all from CONCERNS.md gap audit):**
- Graceful shutdown (SIGTERM/SIGINT) — eliminates IMAP connection leak on every restart; existing `MailService.disconnect()` already exists, needs wiring to signal handlers
- Account config Zod validation — `accounts.json` is currently cast from raw JSON without schema; malformed entries surface as cryptic connect errors
- Email address validation on send — no format check before SMTP send; catches malformed recipients before network round-trip
- SMTP port-aware TLS derivation — port 465 requires `secure: true`; port 587 requires `secure: false` with STARTTLS; currently manual and error-prone
- Attachment size limit before download — BODYSTRUCTURE check before content fetch; prevents full memory load of oversized attachments
- Structured error types — typed `MailMCPError` class with `MailErrorCode` enum; enables callers to branch on error type
- Pagination for large email lists — `offset` parameter on list/search tools; imapflow already supports UID range slicing

**Should have (differentiators):**
- Per-account rate limiter — sliding window per `accountId`; prevents runaway AI agent from exhausting IMAP server quota (Gmail throttles at ~250 commands/min)
- Connection health check (`--validate-accounts`) — CAPABILITY + EHLO probe at startup; surfaces auth failures before first tool call
- Reconnect on connection drop — `close` event listener with one retry and exponential backoff; prevents zombie cached services after network blips
- Account config caching with invalidation — eliminate per-request `fs.readFileSync` via in-memory cache + `fs.watch()` invalidation

**Defer to v2+:**
- SQLite message cache — stateful; cache invalidation against live IMAP is non-trivial
- IMAP EXAMINE mode — lower priority than reliability hardening
- IMAP IDLE push — requires significant architecture change, conflicts with request/response model
- Per-account configurable batch size limits — hard-code 50 UIDs as sensible default instead

### Architecture Approach

The existing five-layer architecture is sound and requires no restructuring. All new features attach at precise, well-defined integration points. See `.planning/research/ARCHITECTURE.md` for the complete component boundary table and build order.

**Modified components:**
1. `src/config.ts` — add `emailAccountSchema` (Zod); use per-item `safeParse` so one bad account does not hide all others; make I/O async
2. `src/index.ts` — add `MailMCPServer.shutdown()`, SIGTERM/SIGINT handlers, `--validate-accounts` CLI flag, `RateLimiter` instance in constructor (not singleton — testability), email validation in write tool handlers
3. `src/services/mail.ts` — add `MailService.healthCheck()`, reconnect guard (one retry only, not a loop), attachment size check in `downloadAttachment()`

**New files:**
1. `src/utils/validation.ts` — `validateEmailAddresses(addrs: string[]): string[]` (returns list of invalid addresses)
2. `src/utils/rate-limit.ts` — `RateLimiter` class (exported as class, not singleton; `MailMCPServer` instantiates it)
3. `src/errors.ts` — `MailMCPError` + `MailErrorCode` enum; maps to `McpError`/`ErrorCode` without leaking internals
4. `src/integration/` — test helpers and suite files (env-var-gated, separate Vitest config)
5. `vitest.integration.config.ts` — includes only `*.integration.test.ts`, sets 30-second timeout

**Revised tool call flow (v1.1.0):**
```
MCP Client → CallToolRequestSchema handler
  → RateLimiter.check(accountId)          [new — O(1), no I/O, fast reject]
  → readOnly guard (existing)
  → validateEmailAddresses()              [new — send_email/create_draft only]
  → getService(accountId)
      → getAccounts() with Zod validation [modified — per-item safeParse]
      → create/cache MailService
  → service.operation()
      → reconnect guard if !client         [new — one retry, then rethrow]
      → attachment size check              [new — in downloadAttachment()]
  → return MCP response
```

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 12 pitfalls (7 from v1.0.0, 5 new for v1.1.0).

**Top 5 for v1.1.0 — all must be addressed in Phase 1 before other work proceeds:**

1. **ImapFlow does not auto-reconnect (H-01 — CRITICAL)** — After a `close` event, the dead `MailService` stays in `services` Map forever and all subsequent tool calls throw "Connection not available." Prevention: register a `close` listener that removes the dead entry from the Map; implement exponential backoff (1s start, 60s cap, 5 attempts) before marking account unavailable. Never re-use a `MailService` after its client emits `close`.

2. **Mailbox lock not released on error — deadlock (H-02 — CRITICAL)** — `getMailboxLock()` must be released in a `finally` block, never in `catch` only. A held lock blocks all subsequent IMAP calls silently for 15+ minutes (imapflow issue #48). Also: never use streaming `fetch()` alongside other IMAP commands inside the same lock — use `fetchAll()` first, then process results (issue #110). Audit every existing lock in `src/protocol/imap.ts` before adding new code.

3. **SIGTERM races with in-flight IMAP operations (H-03 — CRITICAL)** — Naive shutdown calls `disconnect()` immediately, tearing down the socket mid-batch-operation. Prevention: set `shuttingDown` flag, drain in-flight requests with a counter, wait for completion, then disconnect, then exit. Set a 10-second hard deadline for forced exit.

4. **Zod validation fails open (H-04 — MODERATE)** — Using `.safeParse()` on the account array without per-item validation either crashes all accounts (if one is bad) or returns invalid data silently. Use per-item `safeParse` to filter invalid accounts while keeping valid ones; surface structured error messages naming the failing field and account ID.

5. **Email regex ReDoS (H-09 — MODERATE)** — Complex RFC 5322 regexes have exponential worst-case behavior and can block the Node.js event loop on crafted input. Use a simple safe regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) or the `validator` npm package. Never write a custom full-RFC-5322 regex.

## Implications for Roadmap

Research strongly supports a four-phase structure ordered by dependency and risk. Each phase is independently testable and deployable.

### Phase 1: Connection Lifecycle and Config Foundations

**Rationale:** Every other hardening feature depends on validated account data and stable connections. Config validation must come first so reconnect logic operates on clean objects. Connection lifecycle (SIGTERM, reconnect guard) must be stable before rate limiting and health checks are layered on top. These are also the lowest-effort, highest-impact items — eliminating the most visible production failures immediately.

**Delivers:** No connection leaks on restart; no silent bad-config errors at connect time; no misleading SMTP TLS auth failures; no synchronous I/O blocking the event loop per tool call.

**Addresses (FEATURES.md):** Graceful shutdown, account config Zod validation, SMTP port-aware TLS derivation, account config caching (async `fs.promises.readFile` + `fs.watch()`)

**Avoids (PITFALLS.md):** H-01 (ImapFlow no auto-reconnect), H-02 (mailbox lock deadlock — audit before adding new code), H-03 (SIGTERM drain), H-04 (Zod failing open — per-item `safeParse`), H-06 (SMTP TLS mismatch — enforce port/TLS relationship in Zod via `.refine()`), H-08 (stale config cache — add `fs.watch()` invalidation)

**Files touched:** `src/index.ts`, `src/services/mail.ts`, `src/config.ts`

**Research flag:** Standard patterns — signal handlers and Zod `safeParse` are documented; imapflow `logout()` and `connect()` are existing APIs already in the codebase. No deeper research needed.

### Phase 2: Input Validation and Safety Limits

**Rationale:** Once the connection layer is stable, add the protective layers that prevent unbounded inputs: malformed email addresses causing SMTP rejections, oversized attachments exhausting memory, and runaway agents hitting IMAP quota. These are all independent of each other and can be parallelized within the phase. The Zod and error infrastructure from Phase 1 enables cleaner patterns.

**Delivers:** Pre-flight rejection of malformed recipients; 50 MB attachment cap enforced before content download; per-account rate limiting at 60 rpm default; typed error classes that surface code and context rather than opaque strings.

**Addresses (FEATURES.md):** Email address validation, attachment size limit, per-account rate limiter, structured error types

**Avoids (PITFALLS.md):** H-05 (rate limiter must be per-account `Map<accountId, RateLimiter>` — not global), H-09 (email regex ReDoS — use simple safe regex, not RFC 5322)

**Files touched:** `src/utils/validation.ts` (new), `src/utils/rate-limit.ts` (new), `src/errors.ts` (new), `src/index.ts`, `src/services/mail.ts`

**Research flag:** Standard patterns. Before implementing, verify `rate-limiter-flexible ^10.0.1` `RateLimiterMemory` API against the package's actual TypeScript types in `node_modules/` (STACK.md rates this MEDIUM confidence — version from npm search result).

### Phase 3: Pagination and Health Check

**Rationale:** Pagination and the `--validate-accounts` flag both touch the tool schema surface and the CLI entry point. Grouping them avoids two separate changes to `src/index.ts` for adjacent concerns. Both depend on validated accounts (Phase 1) and structured errors (Phase 2).

**Delivers:** Page 2+ access for large mailboxes via `offset` parameter; startup credential validation that surfaces auth failures before the first tool call without loading any message data.

**Addresses (FEATURES.md):** Pagination for large email lists, connection health check (`--validate-accounts`)

**Avoids (PITFALLS.md):** H-07 (health check NOOP during IDLE — safe for v1.1.0 since IDLE is deferred to v2, but add a code comment warning against adding NOOP timers when v2 IDLE is implemented)

**Files touched:** `src/index.ts` (tool schemas + flag), `src/protocol/imap.ts` (UID range offset), `src/services/mail.ts` (`healthCheck()` method)

**Research flag:** Standard patterns — imapflow UID range slicing and nodemailer `transporter.verify()` are documented. No deeper research needed.

### Phase 4: Integration Test Suite

**Rationale:** Integration tests are the highest-effort item (8-12h estimate) and depend on all prior phases being stable — they validate the complete hardened system end-to-end. Writing them against unstable code creates churn. Placing them last ensures the code under test is final.

**Delivers:** Real-protocol test coverage for connection lifecycle, auth, search, send, attachment, and reconnect; separate `npm run test:integration` command that skips cleanly when credentials are absent; CI job design for optional secret injection.

**Addresses (FEATURES.md):** Integration test suite (smtp-server in-process + real IMAP credentials in CI)

**Avoids (PITFALLS.md):** H-10 (shared test state — use unique message IDs and a dedicated `INBOX.mail-mcp-test` subfolder with `beforeAll`/`afterAll` using `try/finally`), H-11 (integration tests must not leak into default `npm test` — use `*.integration.test.ts` naming and a separate Vitest config)

**Files touched:** `src/integration/` (all new), `vitest.integration.config.ts` (new), `package.json` (`test:integration` script)

**Research flag:** Needs validation before scaffolding — verify `smtp-server ^3.18.1` CommonJS module loads correctly in the ESM Vitest 4.x `globalSetup` environment. Decide CI secret injection strategy (real Gmail/Outlook vs. dedicated test account) before Phase 4 planning.

### Phase Ordering Rationale

- Config validation must precede reconnect logic (Phase 1 internal): reconnect creates new `MailService` from `getAccounts()` data; invalid accounts cause reconnect loops
- Safety limits (Phase 2) depend on Phase 1 stability: rate limiter and attachment guard are exercised on live connections; zombie/dead connections invalidate their behavior
- Pagination and health check (Phase 3) benefit from structured errors (Phase 2): both return error responses that benefit from typed formatting
- Integration tests (Phase 4) must come last: they validate the complete hardened system; writing against a moving target creates churn

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Integration Tests):** Verify `smtp-server ^3.18.1` ESM compatibility with Vitest 4.x `globalSetup`. Decide CI secret injection strategy before writing fixture scaffolding.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Signal handlers, Zod `safeParse`, imapflow `logout()` and `connect()` are all documented and already used in the codebase
- **Phase 2:** Simple regex validation, per-account rate limiting, typed error classes are standard TypeScript/Node.js patterns
- **Phase 3:** imapflow UID range slicing and nodemailer `verify()` are documented; CLI flag parsing is already in use in the codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Existing stack is HIGH (validated in v1.0.0). New packages (`rate-limiter-flexible`, `smtp-server`) are MEDIUM — versions confirmed from npm search, not official release notes; TypeScript types confirmed as bundled. |
| Features | HIGH | Feature list sourced directly from CONCERNS.md codebase audit. Every feature maps 1:1 to an identified gap. Effort estimates informed by direct codebase familiarity. |
| Architecture | HIGH | Integration points confirmed by direct source reading of `src/index.ts`, `src/services/mail.ts`, `src/protocol/imap.ts`, `src/config.ts`. Design decisions (class not singleton for RateLimiter; validation at handler not service layer) are principled and consistent with existing patterns. |
| Pitfalls | HIGH | Critical pitfalls (H-01, H-02, H-03) confirmed against imapflow official docs and GitHub issues #48, #63, #110. All pitfalls are codebase-specific, not general advisories. |

**Overall confidence:** HIGH

### Gaps to Address

- **`rate-limiter-flexible` API surface:** MEDIUM confidence on version-specific API. Before implementing Phase 2 rate limiting, verify `RateLimiterMemory` constructor and `consume()` API against the package's actual TypeScript types in `node_modules/`.
- **`smtp-server` Vitest 4.x globalSetup compatibility:** MEDIUM confidence. Verify CommonJS `smtp-server` loads correctly in the ESM Vitest environment before writing Phase 4 fixture scaffolding.
- **Zod 4 `z.email()` / `z.regexes.rfc5322Email` API:** MEDIUM confidence (referenced in migration guide). Confirm these standalone forms are available in the installed `zod ^4.3.6`; if not, `z.string().email()` still works in v4 (deprecated but not removed).
- **CI integration test strategy:** Phase 4 requires IMAP credentials in CI. The env-var approach is correct but the CI job design — which provider, dedicated test account vs. developer account, GitHub Actions secrets naming — is unresolved and should be decided during Phase 4 planning.
- **imapflow connection liveness check:** The reconnect guard (Phase 1) should check connection state before issuing `logout()` during shutdown. Confirm whether `client.usable`, `client.authenticated`, or a combination is the correct liveness indicator for imapflow v1.2.x.

## Sources

### Primary (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — explicit gap list driving all v1.1.0 features (direct codebase read)
- `src/index.ts`, `src/services/mail.ts`, `src/protocol/imap.ts`, `src/config.ts` — architecture integration points (direct source read)
- [ImapFlow API Docs](https://imapflow.com/) — `logout()`, `getMailboxLock()`, `connect()`, `noop()`, no auto-reconnect statement
- [ImapFlow GitHub issue #48](https://github.com/postalsys/imapflow/issues/48) — lock deadlock, 15+ minute hang confirmed
- [ImapFlow GitHub issue #63](https://github.com/postalsys/imapflow/issues/63) — no auto-reconnect confirmed
- [ImapFlow GitHub issue #110](https://github.com/postalsys/imapflow/issues/110) — `fetch()` + flag mutation deadlock
- [Nodemailer SMTP Docs](https://nodemailer.com/smtp) — `secure: true` on port 465, STARTTLS on port 587
- [Vitest globalSetup docs](https://vitest.dev/config/) — `provide`/`inject` cross-thread API
- [Zod official docs](https://zod.dev/) — `safeParse`, `z.email()` standalone validator
- hoodiecrow abandonment — confirmed from npm: last published 2015, zero dependents

### Secondary (MEDIUM confidence)
- [rate-limiter-flexible on npm](https://www.npmjs.com/package/rate-limiter-flexible) — v10.0.1, 416K weekly downloads, TypeScript bundled
- [node-rate-limiter-flexible GitHub](https://github.com/animir/node-rate-limiter-flexible) — `RateLimiterMemory` API surface
- [smtp-server on npm](https://www.npmjs.com/package/smtp-server) — v3.18.1, Nodemailer org authorship
- [smtp-server GitHub](https://github.com/nodemailer/smtp-server) — `onData`/`onRcptTo` event API, CJS package
- [Zod v4 migration guide](https://zod.dev/v4/changelog) — `z.email()` standalone, `z.regexes.rfc5322Email`

### Tertiary (LOW confidence — validate at implementation time)
- Zod 4 `z.regexes.rfc5322Email` availability — referenced in migration guide; confirm against installed package before depending on it

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
