# Project Research Summary

**Project:** Mail MCP Server — v1.1.0 Hardening & Reliability
**Domain:** MCP Tool Server — Node.js IMAP/SMTP Hardening
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

The v1.0.0 Mail MCP Server ships a fully functional 14-tool IMAP/SMTP gateway, but direct codebase analysis (CONCERNS.md) identified ten reliability gaps that prevent production use: connection leaks on exit, unvalidated account config, no rate limiting, no email address validation, missing attachment size guards, no startup health check, no integration tests, no pagination, and unstructured error responses. The v1.1.0 milestone is a hardening pass — not new feature work. All gaps are well-understood and addressable without new architecture or significant refactoring.

The recommended approach is to build in four sequential groups ordered by risk and dependency: (1) zero-friction fixes that eliminate connection leaks and config foot-guns, (2) schema and error quality improvements, (3) safety limits that prevent memory exhaustion and quota abuse, and (4) discovery tooling and integration tests. The stack additions are minimal — only `rate-limiter-flexible` as a production dependency and `smtp-server` plus `@types/smtp-server` as devDependencies. Everything else uses existing Zod, Node.js built-ins, and real-account environment-variable-gated IMAP integration tests.

The most critical risks are not in the new features but in the existing connection model: ImapFlow does not auto-reconnect, mailbox locks must use `finally` blocks or they deadlock, and a naive SIGTERM handler can corrupt in-flight IMAP batch operations. Any reconnect logic added during lifecycle management must account for these constraints before anything else is wired together.

## Key Findings

### Recommended Stack

The existing stack is fixed and validated. The only net-new additions for v1.1.0 are narrow and justified. See `.planning/research/STACK.md` for full detail.

**Core technologies (existing — do not re-research):**
- `imapflow ^1.2.16`: IMAP client — modern async/await, handles mailbox locking
- `nodemailer ^8.0.3`: SMTP client — gold standard, zero dependencies
- `mailparser ^3.9.4`: MIME parsing — best-in-class attachment and body handling
- `zod ^4.3.6`: Schema validation — already in use; extend to `EmailAccount` shape
- `vitest ^4.1.0`: Unit test runner — extend with separate integration config

**New additions only:**
- `rate-limiter-flexible ^10.0.1` (production dep): Per-account in-memory sliding window rate limiting; 416K weekly downloads, TypeScript types bundled, no external storage required
- `smtp-server ^3.18.1` (devDependency): In-process SMTP listener from the Nodemailer team; enables real protocol integration tests without Docker
- `@types/smtp-server ^3.5.x` (devDependency): TypeScript types for smtp-server (not bundled)

**What to explicitly not add:** No SQLite cache (stateful, invalidation complexity outweighs benefit), no Redis-backed rate limiter (local single-process server), no `hoodiecrow-imap` (abandoned 8 years, zero dependents — confirmed from npm), no Docker/Testcontainers (GreenMail too heavy for a local MCP tool), no `ts-custom-error` (standard TypeScript class extension is sufficient in ES2022).

**IMAP integration testing:** No viable in-process IMAP server exists in 2026. Use real account credentials via `TEST_IMAP_*` environment variables with `describe.skipIf(!process.env.TEST_IMAP_HOST)`. This is the same pattern used by the imapflow test suite itself.

### Expected Features

All features in this milestone are hardening — not new tool surface area. No existing tool names or schemas change except adding an optional `offset` parameter to `list_emails` and `search_emails`. See `.planning/research/FEATURES.md` for effort estimates and the full dependency graph.

**Must have (table stakes — CONCERNS.md-identified gaps):**
- Graceful shutdown (SIGTERM/SIGINT) — eliminates IMAP connection leak on every restart; 3-4 lines in `src/index.ts` calling existing `MailService.disconnect()`
- Account config Zod validation — surfaces malformed `accounts.json` at load time, not at connect time
- Email address validation on send — catches malformed recipients before SMTP handshake
- SMTP port-aware TLS derivation — port 465 forces `secure: true`; port 587 uses STARTTLS; eliminates silent misconfiguration
- Attachment size limit before download — BODYSTRUCTURE check before content fetch; prevents 200 MB memory load
- Structured error types — typed error classes (`AuthError`, `NetworkError`, etc.) so callers can branch on error type
- Pagination for large email lists — `offset` param on `list_emails` and `search_emails`; imapflow already supports UID range slicing

**Should have (differentiators):**
- Per-account rate limiter — sliding window per accountId; prevents runaway AI agent from exhausting IMAP quota
- Connection health check (`--validate-accounts`) — CAPABILITY + EHLO probe at startup; surfaces auth failures before first tool call
- Integration test suite — real IMAP account (env-var-gated) + in-process smtp-server; covers lifecycle, auth, search, send, reconnect

**Defer to v2+:**
- SQLite message cache (stateful, invalidation complexity outweighs benefit for a live-data gateway)
- IMAP EXAMINE mode for read-only (lower priority than reliability hardening)
- IMAP IDLE push (requires significant architecture change, conflicts with request/response model)
- Per-account configurable batch size limits (hard-code 50 UIDs as sensible default instead)

**Recommended build order:**
1. Group 1 (zero-risk): Graceful shutdown, SMTP port-aware TLS, email address validation, account config caching (async I/O)
2. Group 2 (schema/errors): Account config Zod validation, structured error types
3. Group 3 (safety limits): Attachment size limit, per-account rate limiter
4. Group 4 (discovery/testing): Pagination, `--validate-accounts` health check, integration test suite

### Architecture Approach

The existing five-layer architecture (`MailMCPServer → MailService → ImapClient/SmtpClient → Keychain/OAuth2`) is sound and requires no restructuring. All new features attach cleanly to existing integration points. See `.planning/research/ARCHITECTURE.md` for the complete component boundary table and build order.

**Modified components:**
1. `src/config.ts` — add `emailAccountSchema` (Zod); validate at `getAccounts()` load time using per-item `safeParse` so one bad account does not hide all others; make I/O async
2. `src/index.ts` — add `MailMCPServer.shutdown()` method, SIGTERM/SIGINT signal handlers, `--validate-accounts` flag parsing, rate limiter instantiation in constructor, email validation in `send_email`/`create_draft` handlers
3. `src/services/mail.ts` — add `MailService.healthCheck()`, reconnect guard (one retry only, not a loop), attachment size check in `downloadAttachment()`

**New files:**
1. `src/utils/validation.ts` — `validateEmailAddresses(addrs: string[]): string[]` (returns list of invalid addresses)
2. `src/utils/rate-limit.ts` — `RateLimiter` class exported as a class (not singleton) for test isolation
3. `src/errors.ts` — `MailMCPError` base class + `MailErrorCode` enum; maps to existing `McpError`/`ErrorCode`
4. `src/integration/` directory — test helpers and suite files (env-var-gated, separate Vitest config)
5. `vitest.integration.config.ts` — includes only `*.integration.test.ts`, sets 30-second timeout

**Revised tool call flow (v1.1.0):**
```
MCP Client → CallToolRequestSchema handler
  → RateLimiter.check(accountId)          [new — O(1), fast reject]
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

See `.planning/research/PITFALLS.md` for full detail on all 12 pitfalls (7 from v1.0.0 read-only mode work, 5 new for v1.1.0 hardening).

**Top 5 pitfalls for v1.1.0:**

1. **ImapFlow does not auto-reconnect (H-01)** — After a `close` event, the dead `MailService` stays in the `services` Map forever. Every subsequent tool call throws with "Connection not available." Prevention: register a `'close'` listener on the ImapFlow client that removes the dead entry from the Map; implement exponential backoff (1s start, 60s cap, 5 attempts max) before marking account unavailable. Never re-use a `MailService` instance after its client has emitted `close`.

2. **Mailbox lock not released on error — deadlock (H-02)** — `getMailboxLock()` must be released in a `finally` block, not in `catch`. A lock held after a thrown error blocks all subsequent IMAP calls silently for 15+ minutes (confirmed imapflow GitHub issue #48). Also: never use `fetch()` (streaming) alongside other IMAP commands in the same lock — use `fetchAll()` first, then process results (imapflow issue #110). Audit every existing lock usage in `src/protocol/imap.ts` before adding new code.

3. **SIGTERM races with in-flight IMAP operations (H-03)** — A naive `process.on('SIGTERM', () => disconnect())` tears down a socket while a batch operation holds a mailbox lock, potentially corrupting partial flag changes. Prevention: set a `shuttingDown` flag, drain active requests with an in-flight counter, wait for completion, then disconnect, then exit. Set a 10-second hard deadline for forced exit.

4. **Zod account validation failing open (H-04)** — Using `.safeParse()` and logging the error while returning invalid account data is worse than the current behavior. Use per-item `safeParse` to filter invalid accounts while keeping valid ones; surface structured error messages that name the failing field and account ID.

5. **Email regex ReDoS (H-09)** — Complex RFC 5322 regexes have exponential worst-case behavior and can block the Node.js event loop on crafted input. Use a simple safe regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) or the `validator` npm package. Never write a custom full-RFC-5322 regex.

## Implications for Roadmap

Research strongly supports a four-phase structure ordered by dependency and risk. Each phase is independently deployable and testable before the next begins.

### Phase 1: Connection Lifecycle and Config Foundations

**Rationale:** Every other hardening feature operates on validated account data and live connections. Config validation must come first so reconnect logic operates on clean data. Connection lifecycle (SIGTERM handling, reconnect guard) must be stable before rate limiting and health checks are layered on top. These are also the lowest-effort, highest-impact items — eliminating the most visible production failure modes immediately.

**Delivers:** No more connection leaks on restart; no more silent bad-config errors at connect time; no more misleading SMTP TLS auth failures from port/TLS mismatch; no more synchronous I/O blocking the event loop on every tool call.

**Addresses (FEATURES.md):** Graceful shutdown, account config Zod validation, SMTP port-aware TLS derivation, account config caching (async `fs.promises.readFile`)

**Avoids (PITFALLS.md):** H-01 (ImapFlow no auto-reconnect), H-02 (mailbox lock deadlock), H-03 (SIGTERM race), H-04 (Zod failing open), H-06 (SMTP TLS mismatch), H-08 (stale config cache)

**Files touched:** `src/index.ts`, `src/services/mail.ts`, `src/config.ts`

**Research flag:** Standard patterns — signal handlers and Zod `safeParse` are well-documented; imapflow `logout()` and `connect()` are existing APIs already used in the codebase. No deeper research needed.

### Phase 2: Input Validation and Safety Limits

**Rationale:** Once the connection layer is stable, the next risk is unbounded inputs: malformed email addresses causing SMTP rejections, oversized attachments exhausting memory, and runaway agents hitting IMAP quota. These are all independent of each other and can be parallelized within the phase. The Zod infrastructure from Phase 1 enables cleaner validation patterns.

**Delivers:** Pre-flight rejection of malformed recipients; 50 MB attachment cap enforced before content download; per-account rate limiting at 60 rpm default; richer typed error messages that name the failing field and account.

**Addresses (FEATURES.md):** Email address validation, attachment size limit, per-account rate limiter, structured error types

**Avoids (PITFALLS.md):** H-05 (rate limiter granularity — must be per-account `Map<accountId, RateLimiter>`, not global), H-09 (email regex ReDoS — use simple safe regex)

**Files touched:** `src/utils/validation.ts` (new), `src/utils/rate-limit.ts` (new), `src/errors.ts` (new), `src/index.ts`, `src/services/mail.ts`

**Research flag:** Standard patterns. Validate that `rate-limiter-flexible ^10.0.1` `RateLimiterMemory` constructor and `consume()` API match expected interface against installed `node_modules/` before wiring (STACK.md flags MEDIUM confidence on version-specific API).

### Phase 3: Pagination and Health Check

**Rationale:** Pagination and the `--validate-accounts` health check both touch the tool schema surface and the CLI entry point. Grouping them avoids two separate changes to `src/index.ts` for adjacent concerns. Both are medium-complexity features that depend on validated accounts (Phase 1) and structured errors (Phase 2) being stable.

**Delivers:** Page 2+ access for large mailboxes via `offset` parameter; startup credential validation that surfaces auth failures before the first tool call without loading any message data.

**Addresses (FEATURES.md):** Pagination for large email lists, connection health check (`--validate-accounts`)

**Avoids (PITFALLS.md):** H-07 (health check NOOP during IDLE — safe for v1.1.0 because IDLE is deferred to v2, but add a code comment warning against adding NOOP timers in the future v2 IDLE implementation)

**Files touched:** `src/index.ts` (tool schemas + `--validate-accounts` flag), `src/protocol/imap.ts` (UID range offset), `src/services/mail.ts` (`healthCheck()` method)

**Research flag:** Standard patterns — imapflow UID range slicing via `range` parameter is documented; nodemailer `transporter.verify()` for SMTP health check is documented. No deeper research needed.

### Phase 4: Integration Test Suite

**Rationale:** Integration tests are the highest-effort item (8-12h estimate) and depend on all prior phases being stable — they validate the complete hardened system end-to-end. Placing them last ensures the code under test is final, not a moving target.

**Delivers:** Real-protocol test coverage for connection lifecycle, auth, search, send, attachment, and reconnect scenarios; a separate `npm run test:integration` command that skips automatically when credentials are absent; CI job design for optional secret injection.

**Addresses (FEATURES.md):** Integration test suite (smtp-server for SMTP; real account env vars for IMAP)

**Avoids (PITFALLS.md):** H-10 (shared state between tests — use unique message IDs and a dedicated `INBOX.mail-mcp-test` subfolder with `beforeAll`/`afterAll` cleanup using `try/finally`), H-11 (integration tests leaking into default CI run — use `*.integration.test.ts` naming and a separate `vitest.integration.config.ts`)

**Files touched:** `src/integration/` (all new), `vitest.integration.config.ts` (new), `package.json` (`test:integration` script)

**Research flag:** Needs attention — verify `smtp-server ^3.18.1` CommonJS module loads correctly in the ESM Vitest 4.x environment before writing fixture scaffolding. Decide CI secret injection strategy (real Gmail/Outlook credentials vs. a self-hosted test account) before Phase 4 planning begins.

### Phase Ordering Rationale

- Config validation must precede reconnect logic (Phase 1 internal dependency): reconnect creates new `MailService` instances from `getAccounts()` data; invalid accounts would cause reconnect loops
- Safety limits (Phase 2) depend on Phase 1 connection stability: rate limiter and attachment guard are exercised on live connections; a dead/zombie connection invalidates their behavior
- Pagination and health check (Phase 3) benefit from structured errors (Phase 2): both return error responses that benefit from typed error formatting
- Integration tests (Phase 4) must come last: they validate the complete hardened system; writing them against unstable code creates churn

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Integration Tests):** Verify `smtp-server ^3.18.1` ESM compatibility with Vitest 4.x `globalSetup`. Decide CI secret injection strategy before writing fixture scaffolding.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Signal handlers, Zod `safeParse`, imapflow `logout()` and `connect()` are all documented and already used in the codebase
- **Phase 2:** Simple regex validation, per-account rate limiting, typed error classes are standard TypeScript/Node.js patterns
- **Phase 3:** imapflow UID range slicing, nodemailer `verify()`, CLI flag parsing with `util.parseArgs` are existing patterns in the codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | New packages (`rate-limiter-flexible`, `smtp-server`) sourced from npm search results, not official docs; versions confirmed from search result metadata. Existing stack is HIGH confidence (validated in v1.0.0). |
| Features | HIGH | Sourced directly from CONCERNS.md (codebase read), imapflow docs, and nodemailer docs. Feature list maps 1:1 to identified gaps. Effort estimates informed by direct codebase familiarity. |
| Architecture | HIGH | Based on direct source code reading of `src/index.ts`, `src/services/mail.ts`, `src/protocol/imap.ts`, `src/config.ts`. Integration points confirmed against actual method signatures. |
| Pitfalls | HIGH | Critical pitfalls (H-01 deadlock, H-02 lock, H-03 SIGTERM race) confirmed against imapflow GitHub issues #48 and #110 and imapflow's explicit documentation of no auto-reconnect behavior. |

**Overall confidence:** HIGH

### Gaps to Address

- **`rate-limiter-flexible` API surface:** STACK.md rates this MEDIUM confidence (version from search result). Before implementing Phase 2 rate limiting, verify `RateLimiterMemory` constructor and `consume()` API against the package's actual TypeScript types in `node_modules/`.
- **`smtp-server` Vitest 4.x globalSetup compatibility:** STACK.md rates this MEDIUM confidence. Verify that the CommonJS `smtp-server` module loads correctly in the ESM Vitest environment before writing Phase 4 fixture scaffolding.
- **Zod 4 `z.regexes.rfc5322Email` availability:** STACK.md rates this MEDIUM confidence (referenced in a search result). For Phase 2 email validation, confirm this regex is present in the installed `zod ^4.3.6` before depending on it; fall back to the simple safe regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) if absent.
- **CI integration test strategy:** Phase 4 integration tests require IMAP credentials in CI. The env-var approach is correct but the CI job design (which provider, whether to use a dedicated test account, GitHub Actions secrets vs. no-op skip) is unresolved and should be decided during Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — gap analysis driving all v1.1.0 features (direct codebase read)
- `src/index.ts`, `src/services/mail.ts`, `src/protocol/imap.ts`, `src/config.ts` — architecture integration points (direct source read)
- [ImapFlow API Docs](https://imapflow.com/) — `logout()`, `getMailboxLock()`, `connect()`, `noop()` behavior
- [Nodemailer SMTP Docs](https://nodemailer.com/smtp) — port/TLS conventions (`secure: true` on 465, STARTTLS on 587)
- [Vitest globalSetup docs](https://vitest.dev/config/globalsetup) — `provide`/`inject` API for cross-thread data
- [Zod official docs](https://zod.dev/) — `safeParse`, `z.regexes.rfc5322Email` API
- ImapFlow GitHub issues #48 (lock deadlock, 15+ minute hang), #63 (no auto-reconnect explicit statement), #110 (fetch + flagsAdd deadlock)
- hoodiecrow abandonment — confirmed from npm: last published 8 years ago, zero dependents

### Secondary (MEDIUM confidence)
- [rate-limiter-flexible on npm](https://www.npmjs.com/package/rate-limiter-flexible) — v10.0.1, 416K weekly downloads, TypeScript bundled (from npm search result)
- [smtp-server on npm](https://www.npmjs.com/package/smtp-server) — v3.18.1, 295K weekly downloads, Nodemailer org (from npm search result)
- [node-rate-limiter-flexible GitHub](https://github.com/animir/node-rate-limiter-flexible) — `RateLimiterMemory` API surface
- [OneUptime blog 2026-01-06](https://oneuptime.com/blog/post/2026-01-06-nodejs-graceful-shutdown-handler/view) — graceful shutdown pattern with drain counter

### Tertiary (LOW confidence / needs validation before use)
- Zod 4 `z.regexes.rfc5322Email` — referenced in a search result citing Zod docs; needs confirmation against installed package before depending on it in Phase 2

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
