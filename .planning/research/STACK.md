# Technology Stack

**Project:** Mail MCP Server — v1.1.0 Hardening & Reliability
**Researched:** 2026-03-22
**Scope:** Stack additions for connection lifecycle, input validation, rate limiting, integration tests, structured error handling, pagination

---

## Existing Stack (do not re-research)

Already validated in v1.0.0 — treat these as fixed:

| Technology | Version | Purpose |
|------------|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP server framework |
| `imapflow` | `^1.2.16` | IMAP client |
| `nodemailer` | `^8.0.3` | SMTP client |
| `mailparser` | `^3.9.4` | MIME parsing |
| `pdf-parse` | `^2.4.5` | PDF text extraction |
| `zod` | `^4.3.6` | Schema validation |
| `cross-keychain` | `^1.1.0` | OS credential storage |
| `vitest` | `^4.1.0` | Unit test runner |
| `typescript` | `^5.9.3` | Compiler |

---

## New Capability: Rate Limiting

**Recommendation:** `rate-limiter-flexible` (production dep)

**Version:** `^10.0.1` (latest as of 2026-03-22, published ~5 days prior)
**Confidence:** MEDIUM (npm registry data confirmed via search; TypeScript types bundled; `RateLimiterMemory` API from GitHub wiki)

**Why:** 416K weekly downloads, actively maintained, TypeScript types bundled (no `@types/` needed), `RateLimiterMemory` for in-process use with zero external storage dependency. The MCP server is single-process local software — Redis/distributed backends are unnecessary overhead.

**What it solves:** A buggy AI agent could trigger thousands of IMAP commands against a real mail server. `RateLimiterMemory` lets us implement a per-account sliding-window limiter keyed on `accountId`.

**How it integrates:**
- Create a `RateLimiterMemory` instance per account at startup (or lazily on first access)
- Wrap every tool dispatch that invokes IMAP/SMTP through a `consume(accountId)` call before connecting
- On `RateLimiterRes` rejection, return a structured MCP error using `msBeforeNext` as the retry hint
- Module-level singleton map (`Map<string, RateLimiterMemory>`) survives across tool invocations within a session

**Alternatives considered:**

| Package | Downloads/wk | Why Not |
|---------|-------------|---------|
| `limiter` (node-rate-limiter) | ~100K | Lacks native TypeScript types, token bucket API requires manual async serialization |
| `rolling-rate-limiter` | ~50K | Lower adoption, similar API surface — no advantage over rate-limiter-flexible |
| Hand-rolled `Map<string, number[]>` | — | Viable but adds maintenance burden and testing overhead for zero benefit |
| `express-rate-limit` | — | Express middleware, not applicable to an MCP server |

```bash
npm install rate-limiter-flexible
```

---

## New Capability: Integration Testing (SMTP)

**Recommendation:** `smtp-server` (devDependency) from the Nodemailer ecosystem

**Version:** `smtp-server@^3.18.1` (latest as of 2026-03-22, published ~2 months prior)
**Types:** `@types/smtp-server@^3.5.x` (separate devDependency — smtp-server ships CJS without bundled types)
**Confidence:** MEDIUM (npm search confirmed version and Nodemailer team authorship)

**Why:** Same team maintains `smtp-server` and `nodemailer`, guaranteeing protocol compatibility. Runs entirely in-process — no Docker, no external services, no Java. Tests can assert on every SMTP event (`onData`, `onRcptTo`, `onAuth`) synchronously within vitest.

**ESM/CJS interop note:** `smtp-server` ships CommonJS. The project uses `"type": "module"`. Node.js allows `import()` of CJS from ESM contexts, and vitest's globalSetup runs in Node.js — the interop is transparent. Use `import SmtpServer from 'smtp-server'` (default import) in `.ts` files with `allowSyntheticDefaultImports: true` (already standard in strict tsconfig).

**How it integrates:**
- `vitest.integration.config.ts` registers a `globalSetup` file
- `globalSetup` starts `smtp-server` on port 0 (OS-assigned) and returns the port via `provide()`
- Tests retrieve port via `inject()`, point `nodemailer` transports at `localhost:<port>`
- `onData` callback in test setup captures raw messages for assertion
- `teardown` closes the server

```bash
npm install -D smtp-server @types/smtp-server
```

---

## New Capability: Integration Testing (IMAP)

**Recommendation:** No npm package — real account via environment variables

**Why:** There is no actively-maintained, in-process IMAP server suitable for testing `imapflow` in 2026:

| Option | Status | Problem |
|--------|--------|---------|
| `hoodiecrow` | Abandoned ~8 years | Zero dependents, unmaintained |
| `imapseagull` | Community fork | Also unmaintained |
| `wildduck` | Active, production server | Requires MongoDB — not a test double |
| GreenMail (Docker) | Active, Java | 500MB+ image, Java 11+, testcontainers-node needed |
| `testcontainers` + Mailpit | Viable | Mailpit has SMTP + basic IMAP; official Node.js testcontainers module exists (`testcontainers` npm), but adds Docker requirement to CI and complicates vitest parallel-suite isolation |

**What to do instead:** IMAP integration tests use a real account via environment variables. Tests are skipped when env vars are absent via `describe.skipIf`. This is the pattern used by the imapflow test suite itself.

**Why env-var approach wins for this project:**
- Zero new dependencies
- Tests verify real TLS negotiation, folder semantics, threading quirks — mocks cannot
- CI can inject secrets for optional full-coverage runs
- Developers without a test account get clean skip output, not failures

**Test file convention:**
```typescript
// src/protocol/imap.integration.test.ts
describe.skipIf(!process.env.TEST_IMAP_HOST)('IMAP integration', () => {
  // Real account operations
});
```

**Required env vars:** `TEST_IMAP_HOST`, `TEST_IMAP_PORT`, `TEST_IMAP_USER`, `TEST_IMAP_PASSWORD`

**CI integration:** Add `test:integration` npm script using `vitest.integration.config.ts`. Standard `npm test` stays unchanged — unit tests only.

**Confidence:** HIGH (reasoning from first principles; hoodiecrow/imapseagull abandonment confirmed; env-var skip pattern is standard vitest practice)

---

## New Capability: Account Config Validation (Zod)

**Recommendation:** Extend existing `zod@^4.3.6` — zero new dependencies

**Why:** Zod is already installed. `getAccounts()` loads raw JSON without schema validation. The fix is adding a Zod schema for `EmailAccount` applied at parse time in `getAccounts()`.

**Zod v4 email validation API (important change from v3):**

Zod 4.x promotes email validation from a string refinement to a standalone type:

```typescript
// Zod 4.x — preferred standalone validator
z.email()                                         // Default regex
z.email({ pattern: z.regexes.rfc5322Email })      // RFC 5322 (stricter)
z.email({ pattern: z.regexes.html5Email })         // Browser HTML5 validation

// Zod 4.x — still works for now, but deprecated
z.string().email()
```

Use `z.email({ pattern: z.regexes.rfc5322Email })` for SMTP recipient validation. RFC 5322 covers the full allowed email address syntax and is appropriate for a mail client that needs to reject malformed addresses before attempting delivery.

**Account schema addition:**

```typescript
// Schema to validate EmailAccount on load in getAccounts()
const EmailAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  user: z.email(),
  authType: z.enum(['login', 'oauth2']),
  useTLS: z.boolean(),
});
```

**No new package needed.**

**Confidence:** MEDIUM (Zod 4.x API confirmed via search citing official Zod docs; `z.regexes.rfc5322Email` confirmed available in Zod 4)

---

## New Capability: SMTP Port-Aware TLS

**Recommendation:** Pure logic change in `src/protocol/smtp.ts` — no new dependencies

`SmtpClient.connect()` already contains the seed of this logic:
```typescript
secure: smtpPort === 465,  // current: implicit
```

Expand to explicit port-to-TLS mapping:

| Port | Protocol | `secure` | `requireTLS` |
|------|----------|----------|-------------|
| 465 | SMTPS (implicit TLS) | `true` | not set |
| 587 | Submission (STARTTLS) | `false` | `true` |
| 25 | SMTP (plain or STARTTLS) | `false` | `false` |
| other | Respect `useTLS` flag | per config | per config |

`nodemailer` supports both `secure: true` (implicit TLS on connect) and `requireTLS: true` (STARTTLS required). No new library needed.

**Confidence:** HIGH (nodemailer official docs confirm `requireTLS` option; port conventions are standards-defined)

---

## New Capability: Attachment Size Limits

**Recommendation:** Pure logic — no new dependencies

Validate attachment size at the tool-dispatch layer before passing to `nodemailer`. Check `Buffer.byteLength(content)` against a configurable `MAX_ATTACHMENT_BYTES` constant (default: 25MB, matching Gmail's limit). Return a `MailMCPError` with code `ATTACHMENT_TOO_LARGE` before attempting SMTP connection.

**Confidence:** HIGH (Node.js built-in Buffer API)

---

## New Capability: Structured Error Handling

**Recommendation:** Typed error classes in `src/errors.ts` — no new dependencies

`ts-custom-error` (most popular npm package for typed errors) adds no value over native TypeScript class extension in ES2022+ targets where `Error.captureStackTrace` is available on Node.js.

**Error class structure:**

```typescript
// src/errors.ts
export enum MailErrorCode {
  AUTH_FAILED          = 'AUTH_FAILED',
  CONNECTION_REFUSED   = 'CONNECTION_REFUSED',
  CONNECTION_LOST      = 'CONNECTION_LOST',
  RATE_LIMIT_EXCEEDED  = 'RATE_LIMIT_EXCEEDED',
  INVALID_ADDRESS      = 'INVALID_ADDRESS',
  ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE',
  FOLDER_NOT_FOUND     = 'FOLDER_NOT_FOUND',
  CREDENTIAL_ERROR     = 'CREDENTIAL_ERROR',
  VALIDATION_ERROR     = 'VALIDATION_ERROR',
}

export class MailMCPError extends Error {
  constructor(
    message: string,
    public readonly code: MailErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MailMCPError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MailMCPError);
    }
  }
}
```

The MCP tool handler maps `MailErrorCode` values to `McpError` / `ErrorCode` variants for the MCP response. The `cause` field preserves the original error for logging without leaking internals to the MCP caller.

**Confidence:** HIGH (standard TypeScript/Node.js patterns, no library verification needed)

---

## New Capability: Connection Lifecycle Management

**Recommendation:** Node.js built-ins only — `process.on('SIGTERM')`, `process.on('SIGINT')`, `setInterval`

**Why:** ImapFlow does not auto-reconnect. Whenever a `'close'` event fires, the caller must create a new connection. The `MailMCPServer.services` map (or equivalent) already holds all active clients. The fix is:

1. **Graceful shutdown:** POSIX signal handlers iterate all active IMAP/SMTP connections, call `imapClient.logout()` / `transporter.close()`, then `process.exit(0)`
2. **Health check:** `setInterval(() => imapClient.noop(), interval)` keeps the connection alive and detects dead connections via the `'close'` event
3. **Reconnection on close:** Attach a listener to the ImapFlow `'close'` event; re-initialize the client from scratch (create new `ImapFlow` instance, reconnect) with exponential backoff

**Backoff:** Use `setTimeout` with doubling delay (100ms → 200ms → 400ms, cap at 30s). No external retry library needed for a simple connection loop.

**Confidence:** HIGH (ImapFlow `'close'` event and manual reconnect requirement confirmed from official ImapFlow docs and GitHub issues; Node.js signal handling is standard)

---

## New Capability: Pagination

**Recommendation:** Cursor-based offset in `src/protocol/imap.ts` — no new dependencies

ImapFlow's existing `range` parameter already supports arbitrary UID ranges. Add `offset` and `limit` parameters to `listMessages()` and `searchMessages()`, returning a `{ messages, nextOffset, total }` response shape. Pure logic, no library.

**Confidence:** HIGH (imapflow `fetch` range API already in use)

---

## Summary: What to Install

| Package | Type | Version | Capability |
|---------|------|---------|-----------|
| `rate-limiter-flexible` | `dependency` | `^10.0.1` | Per-account IMAP/SMTP rate limiting |
| `smtp-server` | `devDependency` | `^3.18.1` | In-process SMTP server for integration tests |
| `@types/smtp-server` | `devDependency` | `^3.5.x` | TypeScript types for smtp-server |

Everything else — structured errors, Zod validation, connection lifecycle, IMAP integration tests, pagination, attachment limits, SMTP TLS — uses existing packages or Node.js built-ins.

```bash
# Production
npm install rate-limiter-flexible

# Dev only
npm install -D smtp-server @types/smtp-server
```

---

## What NOT to Add

| Package | Why Not |
|---------|---------|
| `ts-custom-error` | ES2022 class extension + `captureStackTrace` is sufficient |
| `hoodiecrow` / `imapseagull` | Abandoned 8+ years, zero dependents |
| GreenMail + `testcontainers` | Docker dependency, Java image overhead, vitest parallel isolation complexity |
| `rolling-rate-limiter` | Lower adoption (~50K/wk) vs rate-limiter-flexible (416K/wk); no advantage |
| `express-rate-limit` | Express middleware, inapplicable |
| `p-queue` | ESM-only, concurrency control is overkill for single-account MCP session |
| SQLite / persistence layer | Out of scope for v1.1.0 — deferred to v2 |
| `limiter` (node-rate-limiter) | Lacks native types; manual token bucket serialization required |

---

## Vitest Config Changes

The current vitest config includes `src/**/*.test.ts`. Integration tests require a separate config to avoid connecting to live servers during standard `npm test`:

```typescript
// vitest.integration.config.ts (new file)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./test/setup/smtp-server.ts'],
  },
});
```

Add to `package.json` scripts:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

Standard `npm test` stays unchanged — unit tests only. CI adds `npm run test:integration` with injected env vars.

---

## Sources

- [rate-limiter-flexible on npm](https://www.npmjs.com/package/rate-limiter-flexible) — v10.0.1, 416K weekly downloads, TypeScript bundled (MEDIUM confidence)
- [node-rate-limiter-flexible GitHub](https://github.com/animir/node-rate-limiter-flexible) — `RateLimiterMemory` API and in-process usage (MEDIUM confidence)
- [smtp-server on npm](https://www.npmjs.com/package/smtp-server) — v3.18.1, maintained by Nodemailer team (MEDIUM confidence)
- [smtp-server GitHub](https://github.com/nodemailer/smtp-server) — CJS package, `onData`/`onRcptTo` event API (MEDIUM confidence)
- [Zod v4 migration guide](https://zod.dev/v4/changelog) — `z.email()` standalone, `z.regexes.rfc5322Email` available (MEDIUM confidence)
- [Zod API docs](https://zod.dev/api) — string format validators in v4 (MEDIUM confidence)
- [ImapFlow connection management docs](https://imapflow.com/module-imapflow-ImapFlow.html) — no auto-reconnect, `'close'` event, `logout()` API (HIGH confidence)
- [ImapFlow reconnect issue #63](https://github.com/postalsys/imapflow/issues/63) — confirms manual reconnect requirement (HIGH confidence)
- [Vitest globalSetup docs](https://vitest.dev/config/) — `provide`/`inject` for cross-thread data, `globalSetup`/`teardown` pattern (HIGH confidence)
- [nodemailer SMTP transport docs](https://nodemailer.com/smtp) — `secure` and `requireTLS` option semantics (HIGH confidence)
- [Testcontainers Node.js docs](https://node.testcontainers.org/) — `GenericContainer` API, Vitest integration patterns (MEDIUM confidence)
- [Mailpit](https://mailpit.axllent.org/) — Docker-based SMTP+IMAP test server, considered and rejected for v1.1.0 (MEDIUM confidence)
