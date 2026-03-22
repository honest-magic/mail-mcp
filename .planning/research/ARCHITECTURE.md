# Architecture Patterns

**Domain:** Mail MCP Server — Hardening & Reliability (v1.1.0)
**Researched:** 2026-03-22
**Scope:** Integration of connection lifecycle management, config validation, rate limiting, and integration tests into the existing layered architecture. This supersedes the v1.0.0 read-only mode research.

---

## Existing Architecture Summary

The v1.0.0 codebase is a five-layer stack:

```
MCP Client (stdio)
      |
MailMCPServer (src/index.ts)        — MCP protocol, tool dispatch, service cache
      |
MailService (src/services/mail.ts)  — business logic, IMAP+SMTP orchestration
      |
ImapClient / SmtpClient             — protocol clients wrapping imapflow / nodemailer
      |
Keychain / OAuth2                   — credential storage and token refresh
```

Key state facts relevant to new features:

- `MailMCPServer.services: Map<string, MailService>` — one service instance per accountId, created on first tool call, never invalidated or disconnected.
- `MailService.connect()` calls only `imapClient.connect()`. SMTP is lazy via `ensureSmtp()`.
- `getAccounts()` reads `~/.config/mail-mcp/accounts.json` synchronously on every call to `getService()`.
- `EmailAccount` has no Zod schema validation at load time; it is cast from raw JSON.
- No signal handlers exist; SIGTERM/SIGINT terminate the process without closing IMAP connections.
- `MailService.disconnect()` already exists and calls `imapClient.disconnect()` → `imapflow.logout()`.
- `ImapClient.connect()` and `disconnect()` are already implemented but never called at shutdown.

---

## New Components and Their Integration Points

### 1. Account Config Validation (Modified — `src/config.ts`)

**What it is:** A Zod schema for `EmailAccount` applied at `getAccounts()` load time.

**Integration point:** `getAccounts()` in `src/config.ts`. After parsing the JSON array, apply `z.array(emailAccountSchema).safeParse(parsed)` and surface structured errors when fields are missing or wrong type. This catches malformed accounts before any connection attempt, replacing the current silent cast to `EmailAccount[]`.

**Why here:** `getAccounts()` is the single ingress for all account data. Validating at this boundary means all callers — `MailMCPServer.getService()`, `dispatchTool('list_accounts')`, and the CLI — receive clean objects or an actionable error. Zod is already installed in the project.

**Change summary:**
- Add `emailAccountSchema` (z.object) in `src/config.ts` covering: `id`, `name`, `host`, `port`, `user`, `authType` (enum 'login' | 'oauth2'), `useTLS`, optional `smtpHost`, optional `smtpPort`.
- Replace the untyped cast in `getAccounts()` with `emailAccountSchema.array().parse(parsed)` (throws on invalid) or `safeParse` with explicit error logging.
- Return only validated accounts; log and skip accounts that fail validation rather than returning raw objects.

**No other files change** for this feature. `src/types/index.ts` keeps the `EmailAccount` interface; the Zod schema colocates with the config loader that uses it.

---

### 2. Connection Lifecycle Management (Modified — `src/index.ts`, `src/services/mail.ts`)

**What it is:** SIGTERM/SIGINT handlers that iterate `MailMCPServer.services` and call `service.disconnect()` on each before exiting. An optional startup health check validates credentials before accepting tool calls.

**Shutdown integration point:** `main()` in `src/index.ts`, after `server.run()` resolves. Attach `process.on('SIGTERM', handler)` and `process.on('SIGINT', handler)` that call a new `MailMCPServer.shutdown()` method.

**`MailMCPServer.shutdown()` (new method on existing class):**

```typescript
async shutdown(): Promise<void> {
  for (const service of this.services.values()) {
    await service.disconnect().catch(() => {});
  }
  this.services.clear();
}
```

Signal handler pattern in `main()`:

```typescript
const shutdown = async () => {
  await server.shutdown();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

**Health check integration point:** Add `MailService.healthCheck()` (new method) that issues a lightweight IMAP CAPABILITY command without fetching messages, then verifies SMTP via `transporter.verify()`. Expose this via a `--validate-accounts` flag in `main()` that iterates all configured accounts, runs `healthCheck()` on each, reports results to stderr, and exits. Not wired into normal startup — on-demand only.

**Reconnect guard (optional, in `src/services/mail.ts`):** `ImapClient` throws `'Not connected'` if `this.client` is null mid-operation. Add a reconnect wrapper in `MailService` that catches this specific error, calls `this.imapClient.connect()` once, retries the operation once, then rethrows on second failure. This avoids zombie service instances after network blips.

**Touched files:**
- `src/index.ts` — add `shutdown()` method to `MailMCPServer`, add signal handlers and `--validate-accounts` parsing in `main()`.
- `src/services/mail.ts` — add `healthCheck()` method, add optional reconnect guard around IMAP operations.
- `src/protocol/imap.ts` — no changes needed; `connect()` and `disconnect()` already exist.

---

### 3. Email Address Validation (New — `src/utils/validation.ts`)

**What it is:** A standalone utility for RFC 5322 email address format, used before any SMTP send or draft creation.

**Integration point:** Inside the `send_email` and `create_draft` handlers in `src/index.ts`, before calling `getService()`. Validate `to`, `cc`, `bcc` at the MCP handler boundary and return a structured error before touching the network.

**Why in the handler, not in MailService:** The MCP layer owns input validation; `MailService` owns mail operations. Keeping validation at the handler boundary avoids layering violations and makes `MailService` testable with pre-validated inputs. The service layer should not need to know about MCP response shapes.

**Implementation:** A single regex-based function. No new dependency needed. RFC 5322 full parsing is overkill for this use case — a practical regex covering `user@domain.tld` with reasonable edge cases is sufficient.

```typescript
// src/utils/validation.ts
export function validateEmailAddresses(addresses: string[]): string[] {
  const RFC5322_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return addresses.filter(a => !RFC5322_PATTERN.test(a.trim()));
}
// returns array of invalid addresses (empty = all valid)
```

**Attachment size limit** also belongs in this phase. Add a `MAX_ATTACHMENT_BYTES` constant (default 50 MB) checked in `MailService.downloadAttachment()` after resolving `attachment.size` from `parsed.attachments`. This check lives in the service layer because attachment size is only known after the IMAP fetch.

**Touched files:**
- `src/utils/validation.ts` — new file, `validateEmailAddresses(addrs: string[]): string[]`.
- `src/index.ts` — call validator in `send_email` and `create_draft` handlers.
- `src/services/mail.ts` — add attachment size limit check in `downloadAttachment()`.

---

### 4. Rate Limiter (New — `src/utils/rate-limit.ts`)

**What it is:** A per-account sliding window counter. Rejects tool invocations that exceed a configurable request-per-minute threshold (default: 60 rpm per account).

**Integration point:** At the top of the `CallToolRequestSchema` handler in `src/index.ts`, before any service or account lookup. If the limit is exceeded, return an MCP error response immediately without touching the network.

**Why at the MCP handler, not in MailService:** Rate limiting is a server-level policy concern. Placing it at the handler boundary protects all 14 tool calls uniformly, including `list_accounts` which bypasses `getService()`. `MailService` is infrastructure; policy lives at the interface layer.

**Implementation — no external dependency:**

```typescript
// src/utils/rate-limit.ts
export class RateLimiter {
  private windows = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxRequests: number = 60,
    private readonly windowMs: number = 60_000
  ) {}

  check(key: string): boolean {
    const now = Date.now();
    const entry = this.windows.get(key);
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= this.maxRequests) return false;
    entry.count++;
    return true;
  }
}
```

Export the class, not a singleton. `MailMCPServer` instantiates it in its constructor so tests can create isolated instances.

**Wiring in `src/index.ts`:**

```typescript
// In MailMCPServer constructor
private readonly rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_RPM ?? '60', 10)
);

// At top of CallToolRequestSchema handler (before existing read-only check)
const accountId = (request.params.arguments as any)?.accountId as string | undefined;
if (accountId && !this.rateLimiter.check(accountId)) {
  return { content: [{ type: 'text', text: 'Rate limit exceeded for this account. Please slow down.' }], isError: true };
}
```

**Touched files:**
- `src/utils/rate-limit.ts` — new file, `RateLimiter` class.
- `src/index.ts` — instantiate in constructor, call `check()` in handler.

---

### 5. Integration Test Infrastructure (New — `src/integration/`)

**What it is:** A separate test suite using real IMAP/SMTP credentials loaded from environment variables, skipped automatically when credentials are absent. Does not modify any source files.

**Integration point:** Parallel to existing unit tests. Uses the existing Vitest dependency. Add a separate `vitest.integration.config.ts` at the repo root that includes only `src/integration/**/*.test.ts` and sets a 30-second test timeout.

**Directory structure:**

```
src/integration/
  helpers/
    test-account.ts      — loads TEST_IMAP_* env vars; exports skip flag
    imap-fixture.ts      — setup/teardown: creates test subfolder, seeds messages, deletes folder
    smtp-fixture.ts      — SMTP transporter for verifying sent messages
  imap.integration.test.ts      — list, search, read, thread reconstruction
  smtp.integration.test.ts      — send, append to Sent, draft creation
  oauth2.integration.test.ts    — token refresh flow (requires TEST_OAUTH2_* vars)
  lifecycle.integration.test.ts — connect, shutdown, reconnect after SIGTERM simulation
  validation.integration.test.ts — email validation and attachment size limits end-to-end
```

**Skip pattern (avoid CI failures without credentials):**

```typescript
// src/integration/helpers/test-account.ts
export const SKIP = !process.env.TEST_IMAP_HOST;
export const testAccount: EmailAccount = {
  id: 'integration-test',
  name: 'Integration Test Account',
  host: process.env.TEST_IMAP_HOST!,
  port: parseInt(process.env.TEST_IMAP_PORT ?? '993', 10),
  user: process.env.TEST_IMAP_USER!,
  authType: 'login',
  useTLS: true,
};

// In each test file:
describe.skipIf(SKIP)('IMAP integration', () => { ... });
```

**Isolation requirement:** All integration tests operate inside a dedicated IMAP subfolder (e.g., `INBOX.mail-mcp-test`) created in `beforeAll` and deleted in `afterAll`. This prevents pollution of the real mailbox.

**CI integration:** Integration tests run only in a dedicated CI job with secrets injected. The existing CI workflow runs unit tests only. Add a `test:integration` npm script; the CI job is optional for the v1.1.0 milestone scope.

**`package.json` addition:**
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

**Touched files:**
- `src/integration/` — all new files.
- `vitest.integration.config.ts` — new, at repo root.
- `package.json` — add `test:integration` script.

---

## Revised Data Flow: With New Features

**Tool call flow (v1.1.0):**

```
MCP Client → CallToolRequestSchema handler
  → RateLimiter.check(accountId)          [NEW — O(1), no I/O, fast reject]
  → readOnly guard (existing)
  → validateEmailAddresses(to, cc, bcc)   [NEW — send_email/create_draft only]
  → getService(accountId)
      → getAccounts() with Zod validation [MODIFIED — throws on bad schema]
      → create/cache MailService
      → MailService.connect() → ImapClient.connect()
  → service.operation()
      → [reconnect guard if !client]       [NEW — one retry on 'Not connected']
      → attachment size check              [NEW — in downloadAttachment()]
  → return MCP response
```

**Shutdown flow (new):**

```
SIGTERM/SIGINT → shutdown handler in main()
  → MailMCPServer.shutdown()
      → for each MailService in services Map:
          → service.disconnect()
              → ImapClient.disconnect() → imapflow.logout()
  → process.exit(0)
```

**Health check flow (new, on-demand):**

```
mail-mcp --validate-accounts
  → main() detects flag
  → for each account in getAccounts():
      → new MailService(account).healthCheck()
          → ImapClient.connect() → CAPABILITY → disconnect()
          → SmtpClient.connect() → EHLO → disconnect()
  → report results to stderr, exit
```

---

## Component Boundaries: New vs Modified

| Component | Status | Location | Depends On |
|-----------|--------|----------|------------|
| `emailAccountSchema` (Zod) | Modified | `src/config.ts` | zod (already installed) |
| `MailMCPServer.shutdown()` | New method | `src/index.ts` | existing `MailService.disconnect()` |
| Signal handlers | New code | `src/index.ts` `main()` | `MailMCPServer.shutdown()` |
| `--validate-accounts` flag | New code | `src/index.ts` `main()` | `MailService.healthCheck()` |
| `MailService.healthCheck()` | New method | `src/services/mail.ts` | existing `ImapClient`, `SmtpClient` |
| Reconnect guard | New logic | `src/services/mail.ts` | existing `ImapClient.connect()` |
| `validateEmailAddresses()` | New file | `src/utils/validation.ts` | none |
| Handler email validation | New code | `src/index.ts` (send_email, create_draft handlers) | `validateEmailAddresses()` |
| Attachment size check | New logic | `src/services/mail.ts` `downloadAttachment()` | none |
| `RateLimiter` class | New file | `src/utils/rate-limit.ts` | none |
| Rate limit wire-up | New code | `src/index.ts` (constructor + handler) | `RateLimiter` |
| Integration test helpers | New files | `src/integration/helpers/` | imapflow, env vars |
| Integration test suites | New files | `src/integration/*.test.ts` | test helpers, vitest |
| `vitest.integration.config.ts` | New file | repo root | vitest |
| `package.json` test:integration | Modified | repo root | vitest |

---

## Build Order and Dependencies

Build in this order. Each step is independently testable before moving to the next.

**Step 1 — Config validation** (no deps on other new features; immediate correctness win)
- Add `emailAccountSchema` to `src/config.ts`.
- Update `getAccounts()` to validate and skip/throw on bad accounts.
- Update `src/config.test.ts` to cover missing required fields, wrong types, empty array.
- Verified: unit tests pass, no other files touched.

**Step 2 — Input validation utilities** (no deps; pure functions, easy to test)
- Create `src/utils/validation.ts` with `validateEmailAddresses()`.
- Wire into `send_email` and `create_draft` handlers in `src/index.ts`.
- Add attachment size limit constant and check in `src/services/mail.ts`.
- Unit test the validator in isolation; test size limit in `mail.test.ts` with mocked attachment.

**Step 3 — Rate limiter** (no deps; pure class, easiest to test)
- Create `src/utils/rate-limit.ts` with `RateLimiter` class.
- Instantiate in `MailMCPServer` constructor; wire `check()` into handler.
- Unit test `RateLimiter` directly (no mocks needed — pure in-memory logic).
- Unit test that handler returns rate limit error when limiter returns false.

**Step 4 — Connection lifecycle** (depends on steps 1-3 being stable; touches shared `src/index.ts` and `src/services/mail.ts`)
- Add `MailMCPServer.shutdown()` method.
- Add signal handlers and `--validate-accounts` parsing in `main()`.
- Add `MailService.healthCheck()` method.
- Add optional reconnect guard in `MailService`.
- Unit test shutdown via `vi.spyOn(process, 'on')` and mocked service instances.
- Unit test `healthCheck()` with mocked protocol clients.

**Step 5 — Integration tests** (depends on all above being stable; provides end-to-end validation)
- Create `src/integration/helpers/` scaffolding (test-account, imap-fixture, smtp-fixture).
- Write integration test suites (imap, smtp, oauth2, lifecycle, validation).
- Add `vitest.integration.config.ts` at repo root.
- Add `test:integration` script to `package.json`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reconnect Loop Without Retry Limit
**What:** Catching `'Not connected'` and retrying indefinitely in `MailService`.
**Why bad:** A permanently down IMAP server hangs the MCP handler, blocking all tool calls for that account indefinitely.
**Instead:** One retry only. If the reconnected call fails, propagate the error as a structured response with `isError: true`.

### Anti-Pattern 2: Email Address Validation in MailService
**What:** Moving `validateEmailAddresses()` into `MailService.sendEmail()`.
**Why bad:** `MailService` would need to know about MCP error response shapes or throw MCP-specific errors. It breaks layer separation and makes the service harder to test in isolation.
**Instead:** Validate at the handler boundary in `src/index.ts`; pass only pre-validated args to the service.

### Anti-Pattern 3: Singleton RateLimiter
**What:** Exporting a shared singleton `RateLimiter` instance from `rate-limit.ts`.
**Why bad:** Unit tests for rate limiting will share state across test cases, causing flaky failures.
**Instead:** Export the class; `MailMCPServer` creates an instance in its constructor. Tests instantiate fresh instances.

### Anti-Pattern 4: Integration Tests Without Fixture Isolation
**What:** Integration tests that operate on the real INBOX without a dedicated test subfolder.
**Why bad:** Leaves test messages in the user's real mailbox; tests are non-idempotent; a test failure mid-run leaves detritus.
**Instead:** Create a dedicated test subfolder (e.g., `INBOX.mail-mcp-test`) in `beforeAll`, run all operations there, delete it in `afterAll`. Use try/finally to guarantee cleanup even on test failure.

### Anti-Pattern 5: Zod Throwing in getAccounts() Without Recovery
**What:** Using `z.array(emailAccountSchema).parse(parsed)` which throws on any validation error, crashing the server if one account is malformed.
**Why bad:** A single bad account in accounts.json makes all accounts unavailable.
**Instead:** Use `safeParse` and filter: validate each account individually, log validation errors for bad accounts, return only the valid subset. This matches the existing behavior of returning an empty array on file errors.

### Anti-Pattern 6: Blocking the Event Loop in getAccounts()
**What:** Continuing to call `getAccounts()` (with `fs.readFileSync`) on every tool invocation after adding Zod validation overhead.
**Why bad:** Validation adds CPU cost on top of already-synchronous file I/O. This blocks the event loop per call.
**Instead:** Cache parsed, validated accounts at startup in `MailMCPServer`. Expose `reloadAccounts()` for the CLI path only. `getService()` reads from the in-memory cache.

---

## Scalability Considerations

This is a local, single-user MCP server. Scalability is not a primary concern, but these limits are worth documenting.

| Concern | v1.0.0 | v1.1.0 |
|---------|--------|--------|
| Concurrent accounts | Unbounded Map; each holds one IMAP connection | Rate limiter adds per-account throttle; shutdown handler closes all |
| Memory per read | Uncapped; full attachment downloaded into Buffer | 50 MB attachment size cap reduces peak memory |
| Disk I/O per request | 1x `fs.readFileSync` per tool call via `getAccounts()` | In-memory account cache eliminates per-call I/O |
| IMAP server rate limits | No protection against agent-triggered floods | Sliding window enforces per-account ceiling (default 60 rpm) |
| Graceful shutdown | None; IMAP connections dropped on process exit | Signal handlers close all connections via `imapflow.logout()` |

---

## Sources

- Source code analysis: `src/index.ts`, `src/services/mail.ts`, `src/protocol/imap.ts`, `src/protocol/smtp.ts`, `src/config.ts`, `src/security/keychain.ts`, `src/security/oauth2.ts` (HIGH confidence — direct code reading)
- `.planning/codebase/ARCHITECTURE.md` — existing architecture documentation (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — identified gaps driving this milestone (HIGH confidence)
- `.planning/PROJECT.md` — v1.1.0 target features list (HIGH confidence)
- imapflow `logout()` behavior: graceful IMAP LOGOUT command issued before connection close (MEDIUM confidence — consistent with imapflow API design; verify against imapflow docs for edge cases on already-closed connections)
- Zod `safeParse` API: stable across Zod v3 (confirmed via node_modules inspection that project uses Zod v3 schema API already) (HIGH confidence)
- Vitest `describe.skipIf()`: available in Vitest v1+ (HIGH confidence — Vitest already used in project)
