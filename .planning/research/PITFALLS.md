# Domain Pitfalls: Mail MCP Server (IMAP/SMTP)

**Domain:** Email Integration via IMAP/SMTP + MCP Server Hardening
**Researched:** 2026-03-22 (updated)
**Confidence:** HIGH (codebase-specific, based on direct analysis of src/ and domain research)

---

## Part A: Read-Only Mode Pitfalls (Milestone v1.0.0 — Shipped)

These pitfalls were addressed in v1.0.0 and remain as reference.

---

### Pitfall R-01: Incomplete Write Tool Enumeration

**What goes wrong:**
One or more write tools are not included in the read-only block list. The most common victim is
`register_oauth2_account`, which writes to the macOS Keychain, and `modify_labels`, which mutates
IMAP flags on the server. Because these tools do not "send" email, developers mentally categorize
them as "safe" and forget to block them.

**Why it happens:**
Write-tool enumeration is done by mental model, not by code analysis. The developer thinks
"send and move are writes," forgets that anything mutating external state is a write.

**How to avoid:**
Define the complete write-tool set explicitly in a typed constant before implementing the block.
In this codebase: `send_email`, `create_draft`, `move_email`, `modify_labels`,
`batch_operations`, and `register_oauth2_account` are all writes. Make this list the
single source of truth — used by both the guard check and the `ListTools` filter (if any).

**Warning signs:**
- Tests only cover `send_email` and `create_draft` but not `modify_labels` or `batch_operations`
- The word "write" does not appear in any constant or type definition

**Phase to address:** Phase 1 (flag parsing and tool guard) — must define the list before any
guard implementation begins

---

### Pitfall R-02: Checking Read-Only Flag at Call Time via Module-Level Variable

**What goes wrong:**
The read-only flag is stored in a `let` variable at module scope and read inside `CallToolRequestSchema`
handler. If any async path can mutate this variable (e.g., a future config-reload feature or test
utility), the guard becomes unreliable.

**Why it happens:**
Using a mutable variable feels natural; Node.js developers reach for `let isReadOnly = false`
without considering that the startup flag should be immutable for the server's lifetime.

**How to avoid:**
Parse `--read-only` from `process.argv` exactly once at startup and store it as a `const`.
Pass it into the `MailMCPServer` constructor so it is sealed at construction time, not injected
later. Mark the property `readonly` in TypeScript: `private readonly readOnlyMode: boolean`.

**Warning signs:**
- Flag is stored as `let` anywhere in the call chain
- Flag is read from environment variable at call time (allows mutation via `process.env`)
- No TypeScript `readonly` qualifier on the server property

**Phase to address:** Phase 1 (flag parsing) — parse once, freeze immediately

---

### Pitfall R-03: Returning a Generic Error Instead of a Descriptive Refusal

**What goes wrong:**
The read-only guard throws a generic `Error` or `McpError(ErrorCode.InternalError, ...)` that
the client sees as a server malfunction rather than an intentional policy refusal. The LLM
re-attempts the tool call or escalates unnecessarily.

**Why it happens:**
The existing error path in `src/index.ts` catches everything and wraps it in a generic
`{ content: [{type: 'text', text: 'Error: ...'}], isError: true }`. Developers just throw
an `Error` and assume the message is enough.

**How to avoid:**
Use a message pattern that is unambiguous for both humans and LLMs: include the tool name,
the mode, and what to do instead. Example:
`"Tool 'send_email' is not available: server is running in read-only mode. Use a server without
--read-only to perform write operations."` Keep `isError: true` so clients know it is a hard
refusal, not partial success.

**Warning signs:**
- Refusal message is "read-only mode" with no tool name
- Error uses `ErrorCode.MethodNotFound` (implies the tool doesn't exist, not that it's blocked)
- No mention of what the user should do differently

**Phase to address:** Phase 1 (tool blocking) — write the exact message before wiring the check

---

### Pitfall R-04: Tool List Still Shows Write Tools When Read-Only Is Active

**What goes wrong:**
`ListToolsRequestSchema` returns the full tool list regardless of mode. The LLM sees
`send_email` as available, calls it, receives a refusal error, and enters a confused loop
trying alternate phrasings because it believes the tool exists but is failing.

**Why it happens:**
Blocking at call-time and filtering at list-time are treated as separate concerns. The developer
blocks calls correctly but forgets that the tool listing informs LLM planning. MCP clients
(Claude Desktop, etc.) prefetch the tool list on connect and cache it.

**How to avoid:**
If read-only mode is active, omit write tools from `ListToolsRequestSchema` entirely. The
recommended pattern: build the full tool array, then filter it through the write-tool set
before returning. This is the preferred MCP pattern because it prevents the LLM from planning
actions that cannot succeed. Keep the call-time guard as a defense-in-depth layer.

**Warning signs:**
- `ListToolsRequestSchema` handler has no reference to the read-only flag
- Manual testing shows `send_email` in the tool list when server starts with `--read-only`

**Phase to address:** Phase 1 (tool listing) — filter happens in the same handler pass as the
tool-list construction

---

### Pitfall R-05: Mode Not Discoverable by MCP Clients (ROM-04 Missed)

**What goes wrong:**
The server correctly blocks writes but exposes no structured way for a client to know it is
in read-only mode before calling a tool. Clients that want to adapt their UI (e.g., disable
a "compose" button, add a status badge) have no programmatic signal.

**Why it happens:**
ROM-04 is easy to skip because the functional behavior (blocking) appears complete. Mode
exposure feels like a "nice to have" and gets deferred until there is no phase left to do it.

**How to avoid:**
Use one of two MCP-native mechanisms (not both):

1. **`instructions` field on `InitializeResult`** — set in the `Server` constructor's second
   argument. Example: append `"NOTE: Server is running in read-only mode. Write tools are
   unavailable."` to the instructions string when the flag is active. This is visible to any
   MCP client and is injected into the LLM system prompt by most clients.

2. **Dedicated `get_server_info` tool** — returns a JSON object with `{ readOnly: boolean }`.
   This is queryable without an out-of-band protocol mechanism.

The `instructions` approach (option 1) is preferred because it costs nothing extra and reaches
the LLM immediately at session start without requiring a tool call.

**Warning signs:**
- `new Server({name, version}, {capabilities})` has no `instructions` field
- There is no tool or resource exposing `{ readOnly: true }`
- ROM-04 requirement checked off but there is no test verifying client discovery

**Phase to address:** Phase 2 (client discoverability) — this is a separate deliverable from
blocking; ROM-04 should be a distinct implementation step

---

### Pitfall R-06: `modify_labels` Classification Ambiguity — The Grey-Area Tool

**What goes wrong:**
`modify_labels` is treated as a read operation because it "just changes flags." However, setting
`\Seen` (marking as read) or `\Deleted` via this tool are server-side mutations. In read-only
mode, marking an email as read via `modify_labels` is a write — it changes state on the IMAP
server that other clients observe.

**Why it happens:**
The mental model of "read-only" focuses on outbound SMTP operations (send) and folder mutations
(move, delete). Flag mutations feel lighter-weight but are IMAP `STORE` commands that mutate
server state.

**How to avoid:**
Define read-only as: "no mutations to server state via IMAP or SMTP." This explicitly includes
`modify_labels` and `batch_operations` with `action: 'label'`. The IMAP `EXAMINE` command (as
opposed to `SELECT`) demonstrates this philosophy: EXAMINE opens a mailbox read-only and
refuses to set `\Seen` on fetched messages. Mirror that philosophy.

**Warning signs:**
- `modify_labels` is omitted from the write-tool block list
- A test for read-only mode does not include a `modify_labels` call

**Phase to address:** Phase 1 (write tool enumeration) — the write-tool constant must include
`modify_labels`

---

### Pitfall R-07: SMTP Connection Still Established in Read-Only Mode

**What goes wrong:**
`MailService.connect()` in `src/services/mail.ts` calls `await this.smtpClient.connect()` even
when the server is in read-only mode. This opens an unnecessary SMTP connection (consuming
resources, triggering server-side auth, and potentially failing in firewalled environments)
for a session that will never send email.

**Why it happens:**
The service layer has no awareness of read-only mode. The connection is made eagerly on first
`getService()` call without consulting server mode.

**How to avoid:**
Either (a) skip `smtpClient.connect()` in `MailService` when a `readOnly` flag is passed to
the constructor, or (b) lazily instantiate the SMTP client only when a send operation is
actually called. Option (a) is simpler and more explicit for this milestone. Pass
`readOnly: boolean` to `MailService` constructor; if true, skip the SMTP connect entirely.

**Warning signs:**
- Telemetry shows SMTP auth events when server runs with `--read-only`
- SMTP connection failures surface as errors in read-only sessions that should never touch SMTP

**Phase to address:** Phase 1 (optional refinement) or Phase 2 — this is a quality-of-life
improvement, not strictly required for correctness if the call-time guard is reliable

---

## Part B: v1.1.0 Hardening Pitfalls — Connection Lifecycle, Validation, Rate Limiting, Integration Tests

These pitfalls are specific to adding the v1.1.0 hardening features to the **existing** system.
They are ordered within each category by severity.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or production outages.

---

### Pitfall H-01: ImapFlow Does Not Auto-Reconnect — Manual Logic Required

**What goes wrong:**
Developers assume ImapFlow will silently reconnect after a `close` event (network drop, server
timeout, OAuth2 token expiry). It does not. The existing `MailService.services` map caches the
original `MailService` instance forever. After the underlying IMAP socket drops, every subsequent
tool call throws `Connection not available` or hangs indefinitely until the process is restarted.

**Why it happens:**
ImapFlow's API looks like it manages connection state internally. The `connect()` call and the
`client.authenticated` property suggest a stateful lifecycle, but ImapFlow explicitly states:
"does not handle reconnects automatically — when a `close` event occurs you must create a new
connection yourself."

**Consequences:**
- Silent failure: server stays running, tools return errors, users restart the whole process
- Zombie entries in `MailMCPServer.services` Map: the dead service is re-used on every call
- No reconnect = no recovery from transient network blips

**Prevention:**
1. Register a `'close'` event listener on the ImapFlow client at connection time.
2. On `close`, remove the dead entry from `this.services` so the next `getService()` call creates
   a fresh connection.
3. Implement exponential backoff (start: 1s, cap: 60s, max attempts: 5) before logging "account
   unavailable."
4. Never re-use a `MailService` instance after its IMAP client has emitted `close`.

**Detection / Warning signs:**
- Tool calls return "Connection not available" without any reconnect attempt in logs
- `this.services.has(accountId)` returns `true` for an account with a dead socket
- No `close` event handler registered anywhere in `src/services/mail.ts` or `src/index.ts`

**Phase to address:** Phase 1 (Connection Lifecycle) — must be the first hardening feature.
Every other feature (rate limiting, health checks) depends on knowing whether the connection is alive.

---

### Pitfall H-02: Mailbox Lock Not Released on Error — Deadlock

**What goes wrong:**
ImapFlow's `getMailboxLock()` must be released in a `finally` block. If any IMAP operation inside
the lock throws and the lock release is in a non-finally `catch`, the lock is never released.
Subsequent operations on the same connection hang indefinitely (confirmed deadlock in imapflow
issue #48: lock blocks for 15+ minutes before surfacing as ENETUNREACH).

There is a related deadlock documented in imapflow issue #110: using `fetch()` in a streaming
loop and then calling `messageFlagsAdd()` inside that loop deadlocks because both compete for the
same connection slot. The fix is to call `fetchAll()` and process results after the fetch is complete.

**Why it happens:**
The pattern `const lock = await client.getMailboxLock()` followed by `try/catch/lock.release()` in
catch is tempting but wrong. Any throw path that bypasses the catch (e.g., a second async operation
rejecting) leaves the lock held.

**Consequences:**
- All subsequent IMAP calls on that connection hang silently until process restart
- Batch operations are most at risk: they iterate through UIDs and can throw mid-loop

**Prevention:**
Always use:
```typescript
const lock = await client.getMailboxLock(folder);
try {
  // all IMAP operations
} finally {
  lock.release();
}
```
Never put `lock.release()` only in the catch block. Audit every existing IMAP operation in
`src/protocol/imap.ts` for this pattern before adding new ones.

**Detection / Warning signs:**
- An IMAP operation that previously returned in <1s now hangs for >30s with no error
- `lock.release()` appears in a `catch` block but not in `finally`
- `fetchAll()` is not used but `fetch()` results are processed alongside other IMAP commands

**Phase to address:** Phase 1 (Connection Lifecycle) — audit existing lock usage before adding
reconnect logic, as reconnect will interact with outstanding locks.

---

### Pitfall H-03: SIGTERM Handler Races with In-Flight IMAP Operations

**What goes wrong:**
A naive SIGTERM handler calls `service.disconnect()` (which calls `imapClient.disconnect()`)
immediately. If an IMAP operation is mid-flight (e.g., a `batch_operations` iterating 100 UIDs),
`disconnect()` tears down the socket while the operation holds a mailbox lock. This causes the
in-flight operation to throw an unhandled error, potentially corrupting IMAP server state (e.g.,
half-applied flag changes).

**Why it happens:**
SIGTERM arrives asynchronously relative to active tool calls. The MCP SDK's stdio transport does
not expose a "drain and stop accepting new requests" mechanism, so developers just call
`process.exit()` or `disconnect()` directly.

**Consequences:**
- Batch flag operations applied to a partial UID set (50 of 100 completed, server state is
  inconsistent with what the caller expected)
- Unhandled promise rejection at process exit pollutes logs
- If running as a system daemon, OS may send SIGKILL after grace period, making the problem worse

**Prevention:**
1. On SIGTERM: set a `shuttingDown` flag that causes `getService()` to reject new connections.
2. Drain: wait for all active tool calls to complete (track in-flight count with a counter).
3. Then call `disconnect()` on all services.
4. Then call `process.exit(0)`.
5. Set a hard deadline (e.g., 10s) after which force-exit regardless.

**Detection / Warning signs:**
- `process.on('SIGTERM', () => process.exit(0))` — no drain
- No in-flight request counter exists anywhere in the codebase
- Disconnect is called without checking `imapClient.usable`

**Phase to address:** Phase 1 (Connection Lifecycle) — SIGTERM handling is part of lifecycle
management, not a separate concern.

---

### Pitfall H-04: Zod Account Validation Fails Open — Silent Bad State

**What goes wrong:**
Adding Zod validation to `getAccounts()` but using `.safeParse()` and logging the error instead of
throwing. The function returns the invalid account data anyway (or `[]`), and the server continues
to operate with an account that is missing `host`, `port`, or `authType`. The first tool call
against that account produces a cryptic connection error rather than a clear config error.

**Why it happens:**
`getAccounts()` currently returns `[]` on parse errors (silent failure). When adding Zod, it is
tempting to preserve this "never crash" behavior by wrapping `.parse()` in a try-catch that logs
and returns `[]`. This hides the config problem from the operator.

**Consequences:**
- Account silently disappears from `list_accounts` with no explanation
- Operators spend time debugging "account not found" errors instead of a clear "invalid config" message
- If the schema rejects the entire array because one account is malformed, all accounts disappear

**Prevention:**
Fail-fast on config load: if Zod validation fails, throw with a structured error message that
includes the account `id` (or array index), the failed field, and the expected type. Use
`.safeParse()` only if you intend to report individual account errors while keeping valid accounts
functional — but this requires per-item validation, not per-array validation.

Recommended approach:
```typescript
const result = EmailAccountSchema.array().safeParse(parsed);
if (!result.success) {
  const issues = result.error.issues.map(i => `  [${i.path.join('.')}]: ${i.message}`).join('\n');
  throw new Error(`Invalid accounts.json:\n${issues}`);
}
return result.data;
```

**Detection / Warning signs:**
- `getAccounts()` returns `[]` but `accounts.json` is present and non-empty
- Zod error is logged to `console.error` but function continues and returns data
- No test verifies behavior when a required field (e.g., `host`) is missing

**Phase to address:** Phase 1 (Config Validation) — must happen before connection lifecycle work
so reconnect logic operates on validated account data.

---

## Moderate Pitfalls

Mistakes that cause degraded reliability, user confusion, or hard-to-debug failures.

---

### Pitfall H-05: Rate Limiter Applied at Wrong Granularity

**What goes wrong:**
Rate limiting is applied per-process (global across all accounts) instead of per-account.
A single heavy account triggers the global limit and blocks operations for all other accounts.
Alternatively, the limiter is applied per-tool-call at the MCP layer but not at the IMAP
command layer — so a single tool call (e.g., `batch_operations` with 100 UIDs) fires 100 IMAP
`STORE` commands without rate pressure, then the next tool call is throttled even though the
account is already quiet.

**Why it happens:**
Rate limiting is added as middleware in `getService()` or at the top of the CallToolRequest
handler — a single enforcement point that is easy to wire but too coarse for IMAP semantics.

**Consequences:**
- Multi-account setups where one account monopolizes the server
- Gmail's 15 simultaneous connection limit hit by concurrent batch operations on one account
- Provider-side rate limit errors (Gmail: 2.5GB/day bandwidth, Outlook: similar) not surfaced
  until after the limit is breached

**Prevention:**
- Rate limit per account ID, not globally. Use a `Map<accountId, RateLimiter>` structure.
- Apply at the service layer (inside `MailService`), not at the MCP handler layer.
- For IMAP batch operations, apply the rate limit to each UID operation within the batch, not
  just to the tool invocation.
- Sliding window is appropriate for IMAP: Gmail allows bursts but throttles sustained load.
  Token bucket with a 15-connection cap per account is a reasonable starting model.

**Detection / Warning signs:**
- Rate limiter is a single module-level counter, not a per-account Map
- `batch_operations` is not intercepted by the rate limiter despite firing N IMAP commands
- Rate limit tests use only one account

**Phase to address:** Phase 2 (Rate Limiting) — after connection lifecycle is stable.

---

### Pitfall H-06: SMTP Port/TLS Mismatch Treated as Auth Failure

**What goes wrong:**
Port 465 requires `secure: true` (implicit TLS). Port 587 requires `secure: false` with STARTTLS.
When `accounts.json` specifies port 587 but the `secure` flag is `true` (or vice versa), Nodemailer
silently negotiates TLS incorrectly. The resulting error looks like an authentication failure
("535 Authentication failed"), not a TLS mismatch, because the connection succeeds but the
encrypted handshake produces garbage that the server rejects as bad credentials.

**Why it happens:**
Adding SMTP port-aware TLS handling as a simple conditional (`if port === 465, secure = true`)
without validating existing account configs leaves previously-working accounts in an undefined
state when the schema is tightened.

**Consequences:**
- Sends fail with misleading auth errors
- Users change their password (correct behavior) instead of their port (root cause)
- OAuth2 accounts are especially prone: token refresh succeeds but SMTP handshake fails silently

**Prevention:**
- Zod schema for `EmailAccount` should enforce the relationship: if `smtpPort` is 465, `smtpSecure`
  must be `true`; if 587 or 25, `smtpSecure` must be `false`. Use a Zod `.refine()` for this.
- Log the TLS mode alongside port on every SMTP connection attempt: `"Connecting SMTP: host=smtp.gmail.com port=587 secure=false starttls=required"`
- Provide a migration that sets `smtpSecure` correctly for existing accounts when the schema is applied.

**Detection / Warning signs:**
- SMTP error messages mention "authentication" but credentials are verified correct
- No Zod `.refine()` cross-validates port and TLS settings
- Integration test only covers port 587; port 465 path is untested

**Phase to address:** Phase 1 (Config Validation + SMTP TLS) — schema enforcement prevents
bad state before it reaches the connection layer.

---

### Pitfall H-07: Health Check Command Sent While IDLE Is Active

**What goes wrong:**
An IMAP NOOP command (used as a health check) is sent while the connection is in IDLE mode.
Per IMAP RFC 2177, the only valid command during IDLE is `DONE` to terminate the IDLE state.
Sending NOOP during IDLE causes a protocol error that some servers handle gracefully (send
`BAD` response) and others handle by silently closing the connection, causing the health check
itself to break the connection it was testing.

**Why it happens:**
Implementing a periodic health-check timer without checking `client.idling` state first. The
timer fires independently of the IMAP client's current state.

**Consequences:**
- Health check kills the connection it is meant to monitor
- The server detects the connection as "dead" and reconnects, creating a reconnect loop
- Server-side audit logs show repeated reconnects that look like unstable clients

**Prevention:**
Before sending a health check command, verify the client is not in IDLE state. If IDLE is
active, the connection is by definition healthy (IDLE is only valid on an authenticated,
connected session). Skip the NOOP if `client.idling === true`.
Since this project currently defers IDLE to v2, health checks via NOOP are safe for now —
but document this constraint so the IDLE implementation in v2 does not add NOOP timers naively.

**Detection / Warning signs:**
- Health check timer fires on a fixed interval without checking connection state
- Reconnect events immediately follow health check attempts
- Server logs show `BAD` responses correlated with NOOP commands

**Phase to address:** Phase 2 (Connection Health Checks) — implement health check after
connection lifecycle (Phase 1) is stable.

---

### Pitfall H-08: Account Config Cached Stale After `accounts.json` Edit

**What goes wrong:**
`getAccounts()` reads `accounts.json` from disk on every call (current behavior) — this is
actually the correct behavior for picking up changes. But if a memory cache is added (a natural
optimization during the hardening milestone), edits to `accounts.json` don't take effect until
restart. Users who add a new account via the CLI and immediately try to use it get "account not
found."

**Why it happens:**
Adding an in-memory cache to fix the "synchronous I/O on every request" performance concern
(noted in CONCERNS.md) without adding cache invalidation. A file watcher solves this but adds
complexity; the simpler mistake is to cache on first read and never invalidate.

**Consequences:**
- New accounts added via `mail-mcp accounts add` are invisible until restart
- Config edits made while the server is running are silently ignored
- Hard to debug: `list_accounts` shows stale data, CLI shows correct data

**Prevention:**
If caching is added, invalidate on file modification using `fs.watch()` or `chokidar`. The
simplest correct approach: keep the current read-every-call behavior but make it async
(`fs.promises.readFile`). This avoids blocking the event loop without introducing cache
invalidation complexity.

**Detection / Warning signs:**
- `getAccounts()` stores result in a module-level `let accounts = null` variable
- No `fs.watch` or file watcher exists near the cache
- Test for "account added after server start" does not exist

**Phase to address:** Phase 1 (Config Validation) — if caching is added as part of validation
refactor, invalidation must be addressed in the same phase.

---

### Pitfall H-09: Email Address Validation Rejects Valid Addresses (ReDoS Risk)

**What goes wrong:**
Adding RFC 5322-compliant email validation via a complex regex causes two separate problems:
(1) Valid but unusual addresses (e.g., `user+tag@subdomain.example.co.uk`, quoted local parts,
IP literal domains) are rejected, causing send failures for valid recipients.
(2) Pathological input (very long strings with special characters) triggers catastrophic
backtracking in the regex, causing a ReDoS (Regular Expression Denial of Service) where a
single validation call blocks the Node.js event loop for seconds.

**Why it happens:**
Developers copy a "comprehensive" RFC 5322 email regex from Stack Overflow or a blog post.
These regexes are designed to be correct, not safe — they have exponential worst-case behavior.

**Consequences:**
- Legitimate sends fail (false negatives degrade user trust)
- A malicious or buggy AI agent passing a crafted email address hangs the entire MCP server
- Errors surface as send failures, not validation errors, making the root cause obscure

**Prevention:**
Use a simple, safe regex that catches obvious invalidity (no `@`, no domain, empty string)
rather than full RFC 5322 compliance. The practical approach:
```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```
For stricter validation, use the `validator` npm package (`isEmail()`) which is maintained,
ReDoS-safe, and handles the 99.99% of real-world addresses correctly. Do not write custom
RFC 5322 regex.

**Detection / Warning signs:**
- Custom regex longer than ~100 characters for email validation
- No test for addresses like `user+tag@example.com`, `"quoted local"@example.com`
- No ReDoS test with a long string of special characters

**Phase to address:** Phase 1 (Email Address Validation) — add alongside Zod schema validation.

---

## Minor Pitfalls

Mistakes that cause developer friction, test flakiness, or minor feature gaps.

---

### Pitfall H-10: Integration Tests Sharing State Between Test Cases

**What goes wrong:**
Integration tests against a real or local IMAP/SMTP server (e.g., Mailpit via Docker) share a
single mailbox. Test A sends a message; Test B lists emails and finds Test A's message, causing
false positives (message count off by one) or false negatives (subject assertions match wrong
message). Tests pass in isolation but fail when run in parallel or in sequence after prior failures.

**Why it happens:**
Integration tests are treated like unit tests with a shared fixture. There is no per-test
mailbox reset or per-test unique message identifier.

**Consequences:**
- Flaky CI: tests pass locally (clean state) but fail in CI (accumulated state)
- Hard to debug: failure manifests as wrong message count, not a clear assertion error
- `vitest --watch` loops: a failed test leaves state that breaks subsequent runs

**Prevention:**
- Use a unique subject or `X-Test-ID` header per test run (include timestamp + random suffix)
- Always clean up sent messages in `afterEach`: move to Trash or delete
- Run integration tests in a dedicated mailbox (not INBOX) that is purged in `beforeAll`
- Use Mailpit's REST API (`DELETE /api/messages`) to clear state between tests

**Detection / Warning signs:**
- Integration test uses `list_emails` without filtering by a test-specific identifier
- No `afterEach` or `afterAll` cleanup in integration test files
- Tests fail intermittently when run multiple times in sequence

**Phase to address:** Phase 3 (Integration Tests) — establish isolation pattern before writing
any integration test cases.

---

### Pitfall H-11: Integration Test Infrastructure Checked Into CI Without Environment Guard

**What goes wrong:**
Integration tests that require a running Mailpit instance (Docker) are added to the default
`vitest` run without a guard. CI runs `npm test`, Mailpit is not running, all integration tests
fail with connection errors, and the entire CI build fails. Unit tests (which use mocks and pass)
are indistinguishable from the failing integration tests in the error output.

**Why it happens:**
Integration tests are placed in the same test configuration as unit tests. The natural reflex is
`npm test` running everything.

**Consequences:**
- CI becomes unreliable immediately after integration tests are added
- Developers disable tests locally rather than fixing the CI setup
- The entire test suite must pass for a PR to merge, so integration test failures block unrelated PRs

**Prevention:**
- Separate integration tests into a distinct Vitest project or use a custom test script:
  `npm run test:integration` vs `npm test` (unit only)
- Guard integration tests with an environment variable: `if (!process.env.INTEGRATION_TEST_HOST) { test.skip(...) }`
- In CI, add a separate job that starts Mailpit via Docker Compose and runs `npm run test:integration`
- Unit test job should have zero external dependencies and run in the default CI step

**Detection / Warning signs:**
- Integration test files exist in the same `test` directory as unit tests with no naming distinction
- `vitest.config.ts` has a single project with no exclude pattern for `*.integration.test.ts`
- No `docker-compose.yml` or CI job for integration test infrastructure

**Phase to address:** Phase 3 (Integration Tests) — set up the infrastructure separation before
writing a single integration test.

---

### Pitfall H-12: OAuth2 Token Expiry During Long IMAP Operation

**What goes wrong:**
A long IMAP operation (batch fetch of 100 messages, large attachment download) holds the connection
open for longer than the OAuth2 access token's validity (typically 1 hour, but can be as short as
5 minutes under some provider policies). Mid-operation, the server sends an `* BYE` or authentication
error. ImapFlow emits `close`, the operation fails without a clear "token expired" message.

**Why it happens:**
The current codebase checks token expiry with a 60-second buffer at connection time (`src/security/oauth2.ts`
line 32). This check is not re-run during an active operation. Long operations can outlive a freshly
issued token if the token was already near expiry at operation start.

**Consequences:**
- Batch operations fail halfway through with a misleading error
- User must retry, which may cause duplicate IMAP flag mutations if not idempotent
- Token refresh is not triggered because the error is a connection close, not an auth request

**Prevention:**
- Increase the token refresh buffer from 60s to 5 minutes to reduce the window of risk
- For batch operations, check token validity before each batch chunk (e.g., every 25 UIDs)
- When the reconnect handler (see H-01) fires, attempt token refresh before reconnecting
- Log the token expiry time at connection start so operators can correlate connection drops
  with token events

**Detection / Warning signs:**
- OAuth2 buffer is exactly 60 seconds (`oauth2.ts` line 32)
- Token validity is not re-checked inside `batchOperations()` in `src/services/mail.ts`
- No test for token expiry during a multi-step IMAP operation

**Phase to address:** Phase 1 (Connection Lifecycle) — reconnect logic should include token
refresh; token-aware reconnect prevents this failure mode.

---

### Pitfall H-13: Pagination Using `1:*` UID Range Causes Out-of-Memory Crash

**What goes wrong:**
When implementing pagination for `list_emails` and `search_emails`, it is tempting to fetch all
messages with a `1:*` sequence range and then slice the results in JavaScript. On a mailbox with
50,000+ messages, ImapFlow buffers all message data in memory before returning. A single
`list_emails` call against a large INBOX can exhaust available memory and crash the Node.js process.

A second variant of this pitfall: implementing "page N" by fetching all messages up to that page
(messages 1 through N×pageSize) and discarding earlier ones. This fetches quadratically more data
as page number increases.

**Why it happens:**
The existing `listMessages` in `src/protocol/imap.ts` uses sequence arithmetic
(`Math.max(1, total - count + 1)`) to fetch only the tail of the mailbox. Pagination seems like
a natural extension of this — developers add an `offset` parameter and adjust the range calculation
without verifying that the range stays bounded.

**Consequences:**
- Process crash with ENOMEM on large mailboxes
- Slow responses even before OOM: fetching 10,000 messages to return page 100 of 10
- IMAP server may disconnect for exceeding per-connection data transfer limits (Gmail: 2.5 GB/day)

**Prevention:**
- Always compute a bounded range: `Math.max(1, total - (page * pageSize))` to `Math.max(1, total - ((page - 1) * pageSize))` using the mailbox `total` count.
- Never fetch more UIDs than `pageSize` in a single range expression.
- For cursor-based pagination (preferred over offset): record the lowest UID seen on each page as the cursor; next page fetches `1:(cursor - 1)` from the tail end.
- ImapFlow's documentation warns explicitly: "Do not use large ranges like `1:*` as this might exhaust all available memory."
- Use `fetchAll()` only for ranges you know are small (< 100 messages); use the async `fetch()` generator with an early `break` for bounded iteration.

**Detection / Warning signs:**
- Pagination offset parameter is passed directly into a `1:N` range without checking against mailbox size
- `fetchAll()` called with `'1:*'` or an unbounded sequence
- No test with a simulated large mailbox (mock returning `mailbox.exists = 10000`)

**Phase to address:** Phase 2 (Pagination) — implement bounded range arithmetic before any
pagination feature lands.

---

### Pitfall H-14: MCP Protocol-Level Error vs Tool-Level `isError: true` Confusion

**What goes wrong:**
When adding structured error types, developers throw `McpError` (or an unhandled `Error`) inside
a tool handler for domain errors like "account not found" or "rate limit exceeded." This surfaces
as a JSON-RPC protocol error — the client sees a failed RPC call, not a tool execution result.
MCP clients (Claude Desktop) treat protocol errors as server malfunctions and may disconnect,
show a generic error UI, or suppress the error from the LLM context entirely.

The correct behavior is: tool execution errors (including "account not found," "rate limit
exceeded," "invalid email address") should be returned as a **successful JSON-RPC response**
with `{ content: [{type: 'text', text: '...'}], isError: true }`. Only true protocol-layer
failures (malformed request, server crash, unrecognized method) should be `McpError` throws.

**Why it happens:**
The distinction between "the tool ran and reported an error" vs "the RPC mechanism failed" is
subtle. The existing `src/index.ts` catch block does the right thing for generic `Error` throws
(wraps in `isError: true`) but the pattern is implicit — adding explicit `throw new McpError(...)`
for domain errors bypasses this wrapper.

**Consequences:**
- LLM never sees the error message; it cannot reason about or recover from the failure
- Claude Desktop shows "MCP Error" banner instead of feeding the error back to the model
- Operators see protocol errors in logs for what are actually normal operational conditions
  (e.g., "account not found" during a misconfigured session)

**Prevention:**
- Reserve `throw new McpError(ErrorCode.X, ...)` exclusively for: `MethodNotFound` (unknown tool),
  `InvalidParams` (schema parse failure before any domain logic runs), and `InternalError`
  (truly unexpected server exceptions like uncaught promise rejections).
- For all domain errors (auth failure, rate limit, account not found, invalid email, IMAP error),
  return `{ content: [{type: 'text', text: 'Error: ...'}], isError: true }`.
- When adding structured error types (e.g., `class RateLimitError extends Error`), ensure the
  catch block in the CallTool handler maps each error class to an `isError: true` response, not a
  re-throw.
- A structured error class hierarchy is still valuable — use it to compose the `text` message,
  not to select between protocol-level vs tool-level error paths.

**Detection / Warning signs:**
- `throw new McpError(...)` appears inside domain logic handlers (after `getService()` is called)
- No test verifies that a "rate limit exceeded" error returns `isError: true` in the response body
- MCP client logs show `"code": -32603` (InternalError) for normal operational conditions

**Phase to address:** Phase 2 (Structured Error Types) — establish the error response contract
before wiring error classes into handlers; one wrong `throw McpError` buries errors from the LLM.

---

### Pitfall H-15: Installing Zod v4 When Schema Uses v3 API

**What goes wrong:**
Zod v4 was released in 2025 and ships as the default `npm install zod` result. It contains
breaking changes that silently produce runtime failures when using v3-style schema definitions:

1. `z.string().email()` no longer exists — it moved to `z.email()` (top-level function). Code
   using the chained form compiles in TypeScript but the `.email()` method is undefined at runtime.
2. `z.record(valueSchema)` now requires two arguments `(keySchema, valueSchema)`. The one-argument
   form accepted in v3 is a type error in v4.
3. The `message` param on validators (`z.string({ message: '...' })`) is replaced by `error`. Using
   `message` silently falls back to the default error text with no TypeScript error in some editor
   setups.
4. `z.string().uuid()` behavior changed: v4 enforces RFC 4122 strictly; v3 accepted some non-standard
   UUIDs. Existing test data with non-RFC-4122 UUIDs will fail validation silently (schema returns
   no error for types that changed parsing behavior).

**Why it happens:**
The `zod` npm package defaulted to v3 for years. Documentation and Stack Overflow examples
predominantly show v3 syntax. Developers install fresh and write v3-style schemas without checking
the installed version.

**Consequences:**
- Config validation fails to reject invalid accounts because `.email()` is not called (silently skipped)
- Schema code appears to work in unit tests using `zod` mocks but fails at runtime with real input
- Runtime error: `TypeError: z.string(...).email is not a function` — confusing because it looks
  like a type system issue, not a version mismatch

**Prevention:**
- After `npm install zod`, check `package.json` to confirm whether v3 (`^3.x`) or v4 (`^4.x`) is installed.
- If using v4: use `z.email()`, `z.url()`, `z.uuid()` as top-level functions.
- If using v3 (pinned for compatibility): add `"zod": "^3.23"` explicitly to `package.json` to
  prevent v4 from being installed transitively.
- Zod v4 exports at subpath `"zod/v4"` alongside v3 for incremental migration — useful if
  other project dependencies pin v3.
- Add a test that instantiates the Zod schema and confirms a known-invalid email is rejected;
  this catches silent validation bypass immediately.

**Detection / Warning signs:**
- `package.json` lists `"zod": "^4.x"` or `"zod": "latest"` but schemas use `.email()` chained form
- No pinned Zod version; `npm outdated` shows Zod at v4 when schemas were written against v3 docs
- Schema test for `host` field passes even when `host` is `"not-an-email"` (validation silently no-ops)

**Phase to address:** Phase 1 (Config Validation) — pin the Zod version or migrate to v4 API
before writing any schemas. Discovering the version mismatch after 10 schemas are written is expensive.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Connection Lifecycle | Reconnect re-uses dead `MailService` from cache (H-01) | Remove from `services` Map on `close` event, not on error |
| Connection Lifecycle | SIGTERM races with in-flight batch ops (H-03) | Track in-flight count; drain before disconnect |
| Config Validation | Zod fails open, returns empty array silently (H-04) | Throw on validation failure; per-account error reporting |
| Config Validation | SMTP port/TLS mismatch masked as auth failure (H-06) | Zod `.refine()` cross-validates port and `secure` flag |
| Config Validation | Memory cache added without invalidation (H-08) | Keep sync reads or add `fs.watch()` in same PR |
| Config Validation | Zod v4 API installed when using v3 syntax (H-15) | Pin `"zod": "^3.23"` or migrate fully to v4 top-level functions |
| Rate Limiting | Global limiter blocks all accounts (H-05) | Per-account `Map<id, RateLimiter>` in service layer |
| Email Validation | RFC 5322 regex causes ReDoS (H-09) | Use `validator` npm package or simple safe regex |
| Connection Health | NOOP during IDLE kills connection (H-07) | Check `client.idling` before sending NOOP |
| Structured Errors | `McpError` thrown for domain errors hides them from LLM (H-14) | Domain errors return `isError: true`; `McpError` only for protocol failures |
| Pagination | `1:*` range OOM on large mailboxes (H-13) | Always compute bounded range from `mailbox.exists`; cap at pageSize |
| Integration Tests | Shared mailbox state causes flakiness (H-10) | Per-test unique IDs + `afterEach` cleanup |
| Integration Tests | Integration tests break CI unit tests (H-11) | Separate test scripts and Vitest projects |
| OAuth2 + Lifecycle | Token expires during long batch op (H-12) | Token refresh in reconnect handler; 5-minute buffer |
| Mailbox Locking | `getMailboxLock()` not in `finally` (H-02) | Audit all IMAP ops; enforce `finally` pattern |

---

## Integration Gotchas (v1.1.0 Hardening-Specific)

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `MailMCPServer.services` Map | Never remove dead services | Register `close` listener; delete from Map on `close` |
| `getMailboxLock()` | Release in `catch`, not `finally` | Always use `finally`; audit existing callsites |
| SIGTERM handler | Call `process.exit()` immediately | Drain in-flight requests; disconnect services; then exit |
| `getAccounts()` + Zod | Return `[]` on schema failure | Throw with field-level error details |
| Nodemailer SMTP options | Set `secure` without validating port | Zod `.refine()` enforces port/secure relationship |
| Rate limiter placement | Single global counter | Per-account `Map<accountId, Limiter>` inside `MailService` |
| Tool handler errors | `throw new McpError(...)` for domain errors | Return `{ content, isError: true }` for all domain errors |
| Pagination range | `fetch('1:*')` or unbounded fetchAll | Bounded range: `(total - pageSize):*` computed from `mailbox.exists` |
| Zod version | `npm install zod` installs v4; schemas use v3 API | Pin `"zod": "^3.23"` or audit all schemas for v4 API changes |
| Integration test setup | Single shared Vitest project | Separate `*.integration.test.ts` config; env-var guard |
| Mailpit test isolation | No cleanup between tests | Purge mailbox in `beforeAll`; `afterEach` deletes test messages |
| OAuth2 buffer | 60-second refresh buffer | Increase to 5 minutes; re-check in reconnect handler |
| Email validation | Custom RFC 5322 regex | `validator.isEmail()` or minimal safe regex |

---

## "Looks Done But Isn't" Checklist (v1.1.0 Hardening)

**Connection Lifecycle:**
- [ ] `close` event listener registered on ImapFlow client at connect time
- [ ] Dead service removed from `services` Map on `close`, not just on error
- [ ] Reconnect uses exponential backoff, not immediate retry
- [ ] SIGTERM drains in-flight requests before calling `disconnect()`
- [ ] All `getMailboxLock()` calls use `finally` for release

**Config Validation:**
- [ ] Zod version pinned or v4 API migration completed before writing any schemas
- [ ] Zod schema throws (does not return `[]`) on validation failure
- [ ] Error message includes account ID/index and failing field name
- [ ] SMTP port/`secure` relationship enforced via Zod `.refine()`
- [ ] If caching added: `fs.watch()` or equivalent invalidates cache on file change

**Rate Limiting:**
- [ ] Rate limiter is per-account (Map keyed by accountId), not global
- [ ] `batch_operations` respects rate limit per-UID, not per-tool-call
- [ ] Rate limit errors return `isError: true` response body (not a `McpError` throw)

**Structured Errors:**
- [ ] Domain errors (account not found, rate limit, IMAP failure) return `isError: true`
- [ ] `throw new McpError(...)` reserved for protocol-layer failures only
- [ ] Test verifies each error class produces an `isError: true` tool response visible to LLM

**Pagination:**
- [ ] `list_emails` and `search_emails` range is always bounded by `pageSize`
- [ ] No `1:*` or unbounded `fetchAll()` in any paginated code path
- [ ] Test uses mock mailbox with `exists: 10000` to verify bounded fetch

**Integration Tests:**
- [ ] Integration tests in separate Vitest project or script (`npm run test:integration`)
- [ ] Integration tests guarded by environment variable (skipped if infra absent)
- [ ] Each test uses unique message identifier to avoid shared-state flakiness
- [ ] `afterEach` cleans up created messages

**Email Validation:**
- [ ] Validation uses `validator` package or simple safe regex (not custom RFC 5322)
- [ ] Test covers `user+tag@example.com`, missing `@`, empty string, very long string

---

## Part C: IMAP/SMTP Domain Pitfalls (Persistent Reference)

These pitfalls apply across all milestones and remain valid for the project lifetime.

---

### Pitfall 1: UIDVALIDITY Invalidation

**What goes wrong:** The client's local cache of message UIDs becomes completely out of sync with the server.

**Why it happens:** IMAP servers use `UIDVALIDITY` to signal if the UID sequence has been reset (e.g., due to a database restore, server migration, or mailbox reconstruction).

**How to avoid:** Always check the `UIDVALIDITY` value upon selecting a mailbox. If it differs from the cached value, discard the local cache for that folder and re-index.

**Warning signs:** Monitor for `UIDVALIDITY` responses in the `SELECT` or `EXAMINE` command output.

**Phase to address:** v2 (if local cache is added)

---

### Pitfall 2: The "Sent" Folder Disappearance

**What goes wrong:** Emails sent via the MCP server do not appear in the user's "Sent" folder.

**Why it happens:** SMTP only handles delivery. Most servers do not automatically copy to `Sent`.

**How to avoid:** After a successful SMTP send, manually upload the message to the IMAP `Sent` folder using `APPEND`.

**Warning signs:** "Sent" folder is empty after a test send.

**Phase to address:** v1.0.0 (shipped)

---

### Pitfall 3: Credential Exposure and Plaintext Storage

**What goes wrong:** User credentials leaked from config files or logs.

**Why it happens:** Storing credentials in `.env` files or logging config objects.

**How to avoid:** Use system keychains (macOS Keychain via `cross-keychain`). Use OAuth2/XOAUTH2 or App-Specific Passwords.

**Warning signs:** `console.log` of config objects; world-readable config files.

**Phase to address:** v1.0.0 (shipped)

---

### Pitfall 4: Gmail Label vs. Folder Paradox

**What goes wrong:** Duplicate emails visible to AI, or incorrect "move" behavior.

**Why it happens:** Gmail uses labels, not folders. Single messages appear in multiple IMAP folders.

**How to avoid:** Use `X-GM-MSGID` for deduplication. Use `X-GM-LABELS` for moves on Gmail.

**Warning signs:** Multiple UIDs for the same `Message-ID` across folders.

**Phase to address:** v1.0.0 (shipped)

---

### Pitfall 5: Connection Zombies (IDLE Timeouts)

**What goes wrong:** Server stops receiving notifications without error.

**Why it happens:** IMAP IDLE connections are silently dropped by firewalls after 15-30 minutes. NAT gateways typically time out idle TCP connections after 15 minutes.

**How to avoid:** Send `NOOP` every 10-15 minutes if not in IDLE mode. If in IDLE mode, send `DONE` then re-IDLE periodically. Never send NOOP during IDLE — it causes a protocol error on many servers.

**Warning signs:** No new email notifications after 1 hour of inactivity.

**Phase to address:** v2 (IMAP IDLE implementation)

---

### Pitfall 6: Attachment Bloat and Token Exhaustion

**What goes wrong:** Full email content with attachments causes context window errors.

**Why it happens:** Fetching entire email body and all attachments by default.

**How to avoid:** Fetch `BODYSTRUCTURE` first; provide a separate `get_attachment` tool.

**Warning signs:** High token-per-request metrics; frequent context length errors.

**Phase to address:** v1.0.0 (shipped)

---

### Pitfall 7: Folder Name Fragmentation

**What goes wrong:** Server fails to find "Sent" or "Trash" on providers with non-standard names.

**Why it happens:** Folder names vary by provider (`Sent`, `Sent Items`, `[Gmail]/Sent Mail`).

**How to avoid:** Use `SPECIAL-USE` extension (RFC 6154) to find folders by flag (`\Sent`, `\Trash`).

**Warning signs:** "Folder not found" errors on providers other than Gmail.

**Phase to address:** v1.0.0 (shipped)

---

## Sources

- Direct analysis: `src/index.ts`, `src/services/mail.ts`, `src/config.ts`, `src/protocol/imap.ts`, `src/security/oauth2.ts`
- [ImapFlow Documentation — Connection Lifecycle](https://imapflow.com/module-imapflow-ImapFlow.html) (HIGH confidence)
- [ImapFlow Fetching Messages Guide](https://imapflow.com/docs/guides/fetching-messages/) (HIGH confidence)
- [ImapFlow Issue #48 — getMailboxLock timeout on network disconnect](https://github.com/postalsys/imapflow/issues/48) (HIGH confidence)
- [ImapFlow Issue #110 — messageFlagsAdd deadlock inside fetch loop](https://github.com/postalsys/imapflow/issues/110) (HIGH confidence)
- [Mailbox Locking in ImapFlow — EmailEngine docs](https://docs.emailengine.app/mailbox-locking-in-imapflow/) (HIGH confidence)
- [Nodemailer SMTP Transport — port/TLS options](https://nodemailer.com/smtp) (HIGH confidence)
- [Gmail IMAP Rate Limits and Bandwidth](https://support.google.com/a/answer/2751577) (HIGH confidence)
- [Mailpit — SMTP/IMAP test server for integration testing](https://mailpit.axllent.org/) (HIGH confidence)
- [RFC 2177 — IMAP IDLE extension, NOOP prohibition during IDLE](https://www.rfc-editor.org/rfc/rfc2177) (HIGH confidence)
- [MCP Error Handling — protocol vs tool-level errors](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) (HIGH confidence)
- [Error Handling in MCP TypeScript SDK](https://dev.to/yigit-konur/error-handling-in-mcp-typescript-sdk-2ol7) (MEDIUM confidence)
- [Zod v4 Migration Guide — breaking changes](https://zod.dev/v4/changelog) (HIGH confidence)
- [Zod v4 Release Notes](https://zod.dev/v4) (HIGH confidence)
- [IMAP new messages since last check — UID/UIDNEXT pagination pattern](https://medium.com/@kehers/imap-new-messages-since-last-check-5cc338fd5f09) (MEDIUM confidence)
- [email-addresses — RFC 5322 parser pitfalls](https://github.com/jackbearheart/email-addresses) (MEDIUM confidence)
- [ReDoS risks in RFC 5322 email regex](https://www.regular-expressions.info/email.html) (MEDIUM confidence)

---

*Pitfalls research for: Mail MCP Server — v1.1.0 Hardening & Reliability*
*Original: 2026-03-21 | Updated: 2026-03-22*
