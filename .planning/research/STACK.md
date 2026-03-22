# Technology Stack

**Project:** Mail MCP Server — v1.1.0 Hardening & Reliability
**Researched:** 2026-03-22
**Scope:** Stack additions for connection lifecycle, config validation, rate limiting, integration tests, structured error handling

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

**Why:** 416K weekly downloads, actively maintained (v10.0.1, published within the last 2 weeks as of research date), TypeScript types bundled (no `@types/` needed), supports `RateLimiterMemory` for in-process use with no external storage dependency. The MCP server is single-process local software — Redis/distributed backends are unnecessary overhead.

**What it solves:** CONCERNS.md identifies "No Rate Limiting or Quota Management" as a critical gap. A buggy AI agent could trigger thousands of IMAP commands against a real mail server. `RateLimiterMemory` lets us implement a per-account sliding-window limiter keyed on `accountId`.

**How it integrates:**
- Create a `RateLimiterMemory` instance per account on first use (or eagerly at startup)
- Wrap every tool dispatch that invokes IMAP/SMTP through a `consume(accountId)` call
- On `RateLimiterRes` rejection, return a structured MCP error with retry timing from `msBeforeNext`
- No new infrastructure: pure in-process, survives as a module-level singleton

**Alternatives considered:**
- Rolling-rate-limiter: supports true sliding window, but lower adoption (~50K weekly downloads) and less TypeScript-native
- Build from scratch: a `Map<string, number[]>` timestamp array is viable for a single process, but adds maintenance burden with no benefit over a well-tested library
- `express-rate-limit`: Express-coupled, not applicable here

```bash
npm install rate-limiter-flexible
```

**Version:** `^10.0.1`
**Confidence:** MEDIUM (npm registry data from search, TypeScript bundled confirmed, version from search result published ~5 days ago as of research)

---

## New Capability: Integration Testing (SMTP)

**Recommendation:** `smtp-server` (devDependency) from the Nodemailer ecosystem

**Why:** `smtp-server` (v3.18.1, 295K weekly downloads, maintained by the Nodemailer team — the same team behind `nodemailer` already in the stack) lets tests stand up a real in-process SMTP listener that `nodemailer` connects to. No Docker. No external services. No Java. Compatible with the ESM project structure and runs in `vitest` `globalSetup`/`globalTeardown` hooks.

**What it solves:** CONCERNS.md flags integration tests for SMTP send/append as missing. With `smtp-server`, tests can verify real `nodemailer` calls are made with correct headers, addresses, and body structure.

**`@types/smtp-server`** is a separate package — required because `smtp-server` ships CommonJS without bundled types. Add as devDependency.

**How it integrates:**
- `vitest.config.ts` adds a `globalSetup` file that starts `smtp-server` on a random port
- Port is passed to tests via `provide()` / `inject()` (vitest 4.x global setup API)
- Tests create `nodemailer` transports pointing to `localhost:<port>` and assert on `onData` callbacks
- Server is closed in the `teardown` export

```bash
npm install -D smtp-server @types/smtp-server
```

**Version:** `smtp-server@^3.18.1`, `@types/smtp-server@^3.5.x`
**Confidence:** MEDIUM (version from npm search result, Nodemailer team authorship confirmed, weekly downloads confirmed)

---

## New Capability: Integration Testing (IMAP)

**Recommendation:** No npm package — use a real IMAP account via environment variables

**Why:** There is no actively-maintained, in-process IMAP server suitable for testing imapflow in 2026:

| Option | Status | Problem |
|--------|--------|---------|
| `hoodiecrow` | Abandoned ~8 years ago | Last published 8 years ago, zero dependents |
| `imapseagull` | Community fork of hoodiecrow | Also unmaintained |
| `wildduck` | Active, but requires MongoDB | Production mail server — not for unit tests |
| GreenMail (Docker) | Active, Java-based | Requires Docker daemon, 500MB+ image, Java 11+ |
| `testcontainers` + GreenMail | Viable but complex | Adds Docker dependency to CI; Vitest parallel isolation complicates globalSetup |

**What to do instead:** Integration tests for IMAP use a real account configured via environment variables (`TEST_IMAP_HOST`, `TEST_IMAP_USER`, `TEST_IMAP_PASSWORD`, `TEST_IMAP_PORT`). Tests are skipped when env vars are absent (`describe.skipIf`). This is the pattern used by the imapflow test suite itself.

**Benefits of the env-var approach:**
- Zero new dependencies
- Tests run against real server behavior (TLS negotiation, folder semantics, threading)
- CI can optionally inject secrets for full integration coverage
- Local dev skips cleanly without Docker

**Vitest pattern:**
```typescript
// src/protocol/imap.integration.test.ts
describe.skipIf(!process.env.TEST_IMAP_HOST)('IMAP integration', () => { ... });
```

**File naming convention:** `*.integration.test.ts` — these are excluded from the default `vitest` run via a separate config or include pattern, and run explicitly in CI with `vitest run --config vitest.integration.config.ts`.

**Confidence:** HIGH (reasoning from first principles, hoodiecrow abandonment confirmed, GreenMail/wildduck complexity confirmed)

---

## New Capability: Account Config Validation

**Recommendation:** Extend existing `zod` (already installed at `^4.3.6`) — zero new dependencies

**Why:** Zod is already used throughout the project. The CONCERNS.md gap is "Account Configuration without Validation" — `getAccounts()` loads JSON without schema enforcement. The fix is a Zod schema for `EmailAccount` applied at parse time, not a new library.

**Email address validation for `send_email`:** Use `z.string().email()` which uses Zod's built-in email regex (not RFC 5322, but sufficient for SMTP recipients). For stricter validation, `z.email({ pattern: z.regexes.rfc5322Email })` is available in Zod 4.x (confirmed from Zod docs search). The RFC 5322 pattern is the right choice for SMTP recipient validation given the CONCERNS.md item.

**No new package needed.** Zod 4.3.6 already ships `z.regexes.rfc5322Email`.

**Confidence:** MEDIUM (Zod 4 API from search result confirming `z.regexes.rfc5322Email`, Zod 4.x confirmed installed)

---

## New Capability: Structured Error Handling

**Recommendation:** No new library — implement typed error classes in `src/errors.ts`

**Why:** CONCERNS.md identifies errors returned as plain `Error: ${error.message}` strings losing structured context. The fix is a shallow error hierarchy using standard TypeScript class extension with `Error.captureStackTrace`. The `McpError`/`ErrorCode` pattern is already in the codebase — extend it with domain-specific subtypes.

**Error class structure:**

```typescript
// src/errors.ts
export class MailMCPError extends Error {
  constructor(
    message: string,
    public readonly code: MailErrorCode,
    public readonly cause?: unknown,
  ) { ... }
}

export enum MailErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE',
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  CREDENTIAL_ERROR = 'CREDENTIAL_ERROR',
}
```

The MCP tool handler maps `MailErrorCode` values to appropriate `McpError` / `ErrorCode` variants before returning to the caller.

**No new package needed.** `ts-custom-error` (the most popular npm package for this) adds no value over native TypeScript class extension in ES2022 target with `Error.captureStackTrace` available.

**Confidence:** HIGH (standard TypeScript/Node.js patterns, no library verification needed)

---

## New Capability: Connection Lifecycle Management

**Recommendation:** Node.js built-ins only — `process.on('SIGTERM')`, `process.on('SIGINT')`

**Why:** The CONCERNS.md gap is explicit cleanup of cached IMAP/SMTP connections on server exit. The `MailMCPServer.services` map already holds all active connections. The fix is POSIX signal handlers that iterate the map and call `disconnect()`. No external library needed.

**What to implement:**
- Register `SIGTERM` and `SIGINT` handlers on server start
- Each handler iterates `this.services`, calls `imapClient.logout()` on each, logs result, then calls `process.exit(0)`
- Add connection health check: `imapClient.noop()` on a configurable interval (use `setInterval` + clearInterval on shutdown)

**Confidence:** HIGH (imapflow `logout()` is documented, Node.js signal handlers are standard)

---

## New Capability: Pagination

**Recommendation:** No new library — cursor-based pagination implemented in `src/protocol/imap.ts`

**Why:** CONCERNS.md identifies `listMessages()` as loading all message text into memory. The fix is an `offset` + `limit` parameter pair on existing IMAP list calls, leveraging imapflow's existing `range` parameter. No pagination library needed for a list-based API.

---

## Summary: What to Install

| Package | Type | Version | Capability |
|---------|------|---------|-----------|
| `rate-limiter-flexible` | `dependency` | `^10.0.1` | Per-account rate limiting |
| `smtp-server` | `devDependency` | `^3.18.1` | In-process SMTP for integration tests |
| `@types/smtp-server` | `devDependency` | `^3.5.x` | TypeScript types for smtp-server |

Everything else — structured errors, Zod validation, connection lifecycle, IMAP integration tests, pagination — uses existing packages or Node.js built-ins.

```bash
# Production
npm install rate-limiter-flexible

# Dev only
npm install -D smtp-server @types/smtp-server
```

---

## What NOT to Add

| Package | Why not |
|---------|---------|
| `ts-custom-error` | Standard TypeScript class extension is sufficient in ES2022 |
| `commander` / `yargs` | Already using `util.parseArgs` for CLI flags |
| GreenMail / Docker testcontainers | Too heavy; no maintained in-process IMAP server exists — use env-var real account |
| `hoodiecrow` | Abandoned 8 years ago, zero dependents |
| `rolling-rate-limiter` | Lower adoption than `rate-limiter-flexible`; `RateLimiterMemory` covers the need |
| `express-rate-limit` | Express-specific middleware, not applicable |
| SQLite cache | Deferred to v2 (persistent message cache is out of scope for v1.1.0) |

---

## Vitest Config Changes Required

The current `vitest.config.ts` includes `src/**/*.test.ts`. Integration tests need a separate config to avoid running against live servers in standard `npm test`:

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

Standard `npm test` stays unchanged — only runs `*.test.ts` (unit + mocked). CI adds `npm run test:integration` with injected env vars.

---

## Sources

- [rate-limiter-flexible on npm](https://www.npmjs.com/package/rate-limiter-flexible) — version 10.0.1, 416K weekly downloads, TypeScript bundled (MEDIUM confidence — from search result)
- [smtp-server on npm](https://www.npmjs.com/package/smtp-server) — version 3.18.1, 295K weekly downloads (MEDIUM confidence — from search result)
- [smtp-server GitHub (nodemailer org)](https://github.com/nodemailer/smtp-server) — maintained by Nodemailer team (MEDIUM confidence)
- [Zod docs — string validators](https://zod.dev/api) — `z.regexes.rfc5322Email` available in Zod 4 (MEDIUM confidence — confirmed from search result referencing Zod docs)
- [Vitest globalSetup docs](https://vitest.dev/config/globalsetup) — `provide`/`inject` for cross-thread data (HIGH confidence — official docs)
- [Vitest test lifecycle](https://vitest.dev/guide/lifecycle) — `globalSetup`/`teardown` pattern (HIGH confidence — official docs)
- [node-rate-limiter-flexible GitHub](https://github.com/animir/node-rate-limiter-flexible) — `RateLimiterMemory` API (MEDIUM confidence — from search results)
- hoodiecrow abandonment — last published 8 years ago, zero npm dependents (HIGH confidence — confirmed from npm search)
