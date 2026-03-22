# Phase 10: Connection Lifecycle & Error Infrastructure - Research

**Researched:** 2026-03-22
**Domain:** Node.js process lifecycle, Zod v4 schema validation, TypeScript error hierarchy, fs.watch cache invalidation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and codebase analysis:
- ImapFlow has no auto-reconnect; caller must manage lifecycle via `close` event
- `MailService.disconnect()` already exists in `src/services/mail.ts` — wire signal handlers in `src/index.ts`
- Zod is already installed and used in `src/config.ts` for env vars; extend to `EmailAccount` shape
- MCP domain errors must use `{ content, isError: true }` not `throw McpError` (H-14 pitfall)
- Port 465 = `secure: true`, Port 587 = `secure: false` (STARTTLS auto-upgrade by nodemailer)
- Config caching replaces synchronous `readFileSync` in `getAccounts()` with module-level cache + `fs.watch()`

### Claude's Discretion
All implementation choices are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONN-01 | Server gracefully disconnects all IMAP/SMTP connections on SIGTERM/SIGINT with 10s forced exit timeout | Signal handler pattern in `src/index.ts`; `MailService.disconnect()` already exists; `shuttingDown` flag + in-flight counter drain; `setTimeout(..., 10_000).unref()` for forced exit |
| VAL-01 | Account config is validated against a Zod schema at load time, with actionable error messages on failure | Zod v4 `safeParse()` per-item on account array; `EmailAccount` shape already typed; extend `src/config.ts` with `emailAccountSchema`; one bad account must not block valid ones |
| VAL-03 | SMTP `secure` flag is auto-derived from port (465=TLS, 587=STARTTLS) when not explicitly set | `smtpPort === 465` already in `src/protocol/smtp.ts` line 33; lift derivation into Zod schema `.transform()` or `.default()` so it is enforced at parse time, not inlined in `SmtpClient.connect()` |
| VAL-04 | Account config is cached in memory and invalidated via file watcher instead of reading from disk per call | Replace `fs.readFileSync` in `getAccounts()` with module-level cache + `fs.watch()` invalidation; cache must survive multiple tool calls; watcher must be set up once, not re-opened on every read |
| SAFE-02 | All tool errors use typed error classes (AuthError, NetworkError, ValidationError, QuotaError) with contextual messages | New `src/errors.ts` with `MailMCPError` base + `MailErrorCode` enum; catch blocks in `src/index.ts` dispatch inspect error type; surface as `{ content, isError: true }` — never `throw McpError` from tool handlers |
</phase_requirements>

## Summary

Phase 10 is the foundation for all v1.1.0 hardening work. It addresses five requirements that every downstream phase depends on: clean process shutdown (CONN-01), schema-validated account config (VAL-01), automatic SMTP TLS derivation (VAL-03), in-memory config caching (VAL-04), and typed tool error classes (SAFE-02). None of these require new dependencies — all tooling is already installed and the integration points are precisely known from direct codebase analysis.

The existing code is close to correct in several places. `SmtpClient.connect()` already derives `secure: smtpPort === 465` at line 33 — the work is to make this derivation canonical by lifting it into the Zod account schema so it is enforced at load time and SmtpClient can trust the data it receives. `MailService.disconnect()` already exists — the work is wiring signal handlers in `src/index.ts` to call it for all cached services. `getAccounts()` already reads a JSON file — the work is replacing the per-call synchronous read with a module-level cache and `fs.watch()` invalidation.

The primary new construction is `src/errors.ts` with a `MailMCPError` base class and `MailErrorCode` enum. TypeScript ES2022 target supports native class extension of `Error` without the prototype-chain fix required in older targets. The catch block in `src/index.ts`'s `CallToolRequestSchema` handler must be updated to inspect the error type and produce typed output.

**Primary recommendation:** Build in this order: (1) `src/errors.ts` first (all other work references it), (2) Zod `emailAccountSchema` in `src/config.ts` with cache + watcher, (3) SIGTERM/SIGINT shutdown in `src/index.ts`. Each step is independently testable with unit tests that do not require live IMAP/SMTP connections.

## Standard Stack

### Core (all already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^4.3.6` (installed) | Schema validation for `EmailAccount` + env vars | Already used in `src/config.ts`; `safeParse()` + `refine()` cover all validation needs |
| `imapflow` | `^1.2.16` (installed) | IMAP client lifecycle (logout, close event) | Already used; `client.usable` confirmed as correct liveness check (see API verification below) |
| `nodemailer` | `^8.0.3` (installed) | SMTP transport; `secure` / `requireTLS` flags | Already used; port-to-TLS mapping documented in official nodemailer docs |
| `node:fs` | built-in | `fs.watch()` for config file invalidation | Node.js built-in; `fs.promises.readFile` for async cache refresh |
| `node:process` | built-in | `process.on('SIGTERM')` / `process.on('SIGINT')` | Standard Node.js signal handling |

### No New Packages Required
All phase 10 work uses existing dependencies. `src/errors.ts` uses native ES2022 class extension — no `ts-custom-error` or `custom-error-class` library needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native ES2022 `class MailMCPError extends Error` | `ts-custom-error` npm package | No benefit: ES2022 target (confirmed in `tsconfig.json`) handles prototype chain correctly; adds a dependency for zero value |
| `fs.watch()` invalidation | `chokidar` or `fs.watchFile()` | `fs.watch()` is sufficient for single-file watching with debounce; chokidar solves cross-platform glob watching (not needed here) |
| Module-level cache variable | Redis or SQLite | Single-process local server; no external storage needed |

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── errors.ts            # NEW: MailMCPError base class + MailErrorCode enum
├── config.ts            # MODIFY: add emailAccountSchema, cache, fs.watch()
├── index.ts             # MODIFY: SIGTERM/SIGINT handlers, typed error catch
├── protocol/
│   └── smtp.ts          # MINOR MODIFY: remove inline secure derivation (move to schema)
└── types/
    └── index.ts         # MODIFY: EmailAccount type regenerated from Zod schema (or keep interface, validate separately)
```

### Pattern 1: Typed Error Hierarchy (SAFE-02)

**What:** `MailMCPError` extends `Error` with a `code: MailErrorCode` field. Four concrete subtypes: `AuthError`, `NetworkError`, `ValidationError`, `QuotaError`. Existing catch block in `src/index.ts` inspects `error.code` to build the `{ content, isError: true }` response. Does not leak error internals to the MCP client.

**When to use:** Any `throw` in service or protocol layer should throw a `MailMCPError` subtype. Generic `Error` throws are allowed for programmer errors (bugs) but not for user-facing domain errors.

**Example:**
```typescript
// src/errors.ts
export enum MailErrorCode {
  AuthError = 'AuthError',
  NetworkError = 'NetworkError',
  ValidationError = 'ValidationError',
  QuotaError = 'QuotaError',
}

export class MailMCPError extends Error {
  constructor(
    public readonly code: MailErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = code;
  }
}

export class AuthError extends MailMCPError {
  constructor(message: string, options?: ErrorOptions) {
    super(MailErrorCode.AuthError, message, options);
  }
}

export class NetworkError extends MailMCPError {
  constructor(message: string, options?: ErrorOptions) {
    super(MailErrorCode.NetworkError, message, options);
  }
}

export class ValidationError extends MailMCPError {
  constructor(message: string, options?: ErrorOptions) {
    super(MailErrorCode.ValidationError, message, options);
  }
}

export class QuotaError extends MailMCPError {
  constructor(message: string, options?: ErrorOptions) {
    super(MailErrorCode.QuotaError, message, options);
  }
}
```

**Catch block update in `src/index.ts`:**
```typescript
// In the CallToolRequestSchema catch block — replace the current generic handler
} catch (error: unknown) {
  const message = error instanceof MailMCPError
    ? `[${error.code}] ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
```

### Pattern 2: Per-Item Zod Validation (VAL-01)

**What:** Define `emailAccountSchema` in `src/config.ts`. Call `emailAccountSchema.safeParse(item)` on each element of the raw JSON array. Collect valid accounts and log actionable errors for invalid ones — never fail all accounts because one is bad.

**When to use:** Inside the refreshed `getAccounts()` (or internal `loadAccountsFromDisk()`) function, after parsing JSON.

**Zod v4 API verified:**
- `z.object({...}).safeParse(value)` — returns `{ success: true, data }` or `{ success: false, error }`
- `z.string()`, `z.number()`, `z.boolean()`, `z.enum()`, `z.union()`, `z.literal()` — all confirmed available
- `.refine(fn, { message })` — confirmed available on object schemas
- `.optional()` — confirmed available

**Example:**
```typescript
// src/config.ts — emailAccountSchema
import { z } from 'zod';

const emailAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  user: z.string().min(1),
  authType: z.enum(['login', 'oauth2']),
  useTLS: z.boolean(),
  // secure is derived at SmtpClient connect time from smtpPort — not stored in config
});

// Per-item safeParse — one bad entry does not block valid entries
export async function loadAccountsFromDisk(): Promise<EmailAccount[]> {
  const raw = await fs.promises.readFile(ACCOUNTS_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error(`accounts.json must be an array`);
    return [];
  }
  const valid: EmailAccount[] = [];
  for (const item of parsed) {
    const result = emailAccountSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data as EmailAccount);
    } else {
      const id = typeof item?.id === 'string' ? item.id : '(unknown)';
      const fields = result.error.issues.map(i => i.path.join('.') || 'root').join(', ');
      console.error(`accounts.json: account "${id}" skipped — invalid fields: ${fields}`);
    }
  }
  return valid;
}
```

### Pattern 3: Config Cache with fs.watch Invalidation (VAL-04)

**What:** Module-level `let` cache variable + `boolean` dirty flag. `fs.watch()` on `ACCOUNTS_PATH` sets dirty flag on file change events. `getAccounts()` becomes async: returns cache if clean, re-reads disk if dirty.

**Critical detail:** `fs.watch()` may fire multiple events per single save (depending on editor). Use a debounce or simply set a dirty flag — lazy reload on next access avoids extra reads. The watcher must handle `ENOENT` (file deleted) gracefully.

**`fs.watch()` event types:** `'rename'` (file created, deleted, or renamed) and `'change'` (file content changed). Both must invalidate cache.

**Example:**
```typescript
// src/config.ts — cache layer
let cachedAccounts: EmailAccount[] | null = null;
let watcherStarted = false;

function startWatcher(): void {
  if (watcherStarted) return;
  watcherStarted = true;
  try {
    fs.watch(ACCOUNTS_PATH, () => {
      // Any event invalidates cache; next getAccounts() call reloads
      cachedAccounts = null;
    });
  } catch {
    // File does not exist yet — cache stays null, getAccounts() returns []
  }
}

export async function getAccounts(): Promise<EmailAccount[]> {
  if (cachedAccounts !== null) return cachedAccounts;
  startWatcher();
  try {
    const loaded = await loadAccountsFromDisk();
    cachedAccounts = loaded;
    return loaded;
  } catch {
    return [];
  }
}
```

**Note on `getAccounts()` signature change:** The current signature is synchronous (`getAccounts(): EmailAccount[]`). Making it async is the correct change — all callers in `src/index.ts` are already in `async` contexts. Update all call sites: `const accounts = await getAccounts()`.

### Pattern 4: SIGTERM/SIGINT Graceful Shutdown (CONN-01)

**What:** Register signal handlers once after `MailMCPServer` is created. On signal: set `shuttingDown` flag, wait for in-flight requests to drain (or timeout), call `disconnect()` on all cached `MailService` instances, then `process.exit(0)`. Force exit after 10 seconds using `setTimeout(..., 10_000).unref()`.

**`timer.unref()` is critical:** Without it, the 10-second timer itself prevents the process from exiting cleanly if all connections close before the deadline.

**In-flight counter:** The tool dispatch catch-all in `setupToolHandlers` wraps each tool call. Increment a counter before dispatch, decrement in `finally`. Shutdown waits for counter to reach zero (with 10-second hard limit).

**imapflow `client.usable` check:** Confirmed in imapflow type definitions (`lib/imap-flow.d.ts` line 636): `usable: boolean` indicates whether the connection is currently usable. Check `client.usable` before calling `logout()` to avoid errors disconnecting an already-dead connection.

**Example:**
```typescript
// src/index.ts — shutdown method on MailMCPServer
private shuttingDown = false;
private inFlightCount = 0;

async shutdown(): Promise<void> {
  this.shuttingDown = true;

  // Wait for in-flight requests (max 10s)
  const deadline = Date.now() + 10_000;
  while (this.inFlightCount > 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Disconnect all cached services
  const disconnects = Array.from(this.services.values()).map(svc =>
    svc.disconnect().catch(err => console.error('Disconnect error:', err))
  );
  await Promise.allSettled(disconnects);
  this.services.clear();
}

// In main() — after server construction
const shutdown = async () => {
  const timer = setTimeout(() => {
    console.error('Forced exit after 10s shutdown timeout');
    process.exit(1);
  }, 10_000);
  timer.unref();
  await server.shutdown();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

**`MailService.disconnect()` already exists** (`src/services/mail.ts` lines 30-33). It calls `imapClient.disconnect()` which calls `client.logout()`. Add a liveness check before `logout()`:

```typescript
// src/protocol/imap.ts — update disconnect()
async disconnect(): Promise<void> {
  if (this.client && this.client.usable) {
    await this.client.logout();
  }
  this.client = null;
}
```

### Pattern 5: SMTP TLS Auto-Derivation (VAL-03)

**What:** The `secure` flag for nodemailer is currently derived inline in `SmtpClient.connect()` as `secure: smtpPort === 465`. This is correct behavior but is not enforced at config load time. The Zod schema should derive/validate this relationship so SmtpClient receives data it can trust.

**Two valid approaches:**
1. Keep derivation in `SmtpClient.connect()` (current pattern) — simple, no schema change needed beyond adding schema validation for the raw fields
2. Add a `.transform()` or computed field in the Zod schema that sets a derived `smtpSecure` boolean

The simplest approach: keep the derivation in `SmtpClient.connect()` (it already works correctly), and ensure `emailAccountSchema` validates that `smtpPort` is present and is a valid number when specified. The requirement is that port 465 connects over TLS and 587 over STARTTLS without error — which the current `smtpPort === 465` logic already guarantees. The schema just needs to ensure `smtpPort` is a valid integer when provided.

**No change needed in `SmtpClient.connect()`** — the derivation logic at line 33 is already correct. The schema must validate `smtpPort` is an integer so the derivation operates on clean data.

### Anti-Patterns to Avoid

- **Throwing `McpError` from tool handlers:** The `CallToolRequestSchema` handler catch block in `src/index.ts` returns `{ content, isError: true }` — this is the correct MCP pattern for domain errors. `throw new McpError(...)` is only for protocol-level errors (unknown tool name, invalid schema), not for auth failures or network errors in the tool's domain.
- **Global singleton cache:** The config cache must be module-level (already matches existing pattern for `ACCOUNTS_PATH`), not a singleton class. Module-level `let` with watcher works correctly.
- **`safeParse()` on the whole array:** `emailAccountSchema` validates one account at a time. Wrapping the whole array in a Zod schema fails all-or-nothing. Use per-item `safeParse` in a loop.
- **`fs.watchFile()` instead of `fs.watch()`:** `fs.watchFile()` polls; `fs.watch()` uses native OS events. Prefer `fs.watch()` for immediate invalidation.
- **Not calling `timer.unref()` on the forced-exit timer:** Without `.unref()`, the 10s timer keeps the event loop alive even after all connections close, delaying clean exit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation with error messages | Custom JSON validator | `zod.safeParse()` | Already installed; produces structured issue paths; handles nested required/optional correctly |
| File change detection | `setInterval` polling `fs.stat()` | `fs.watch()` | OS-native events, immediate, zero CPU cost |
| Error hierarchy | Checking `error.message` string for type | `instanceof MailMCPError` + `error.code` enum | String matching breaks on message changes; `instanceof` is type-safe |

**Key insight:** All tools for this phase are already in the project. Zero new dependencies needed.

## Common Pitfalls

### Pitfall 1: Zod Failing Open on Array (H-04)
**What goes wrong:** `z.array(emailAccountSchema).safeParse(parsed)` fails the entire array if one item is invalid — all valid accounts are dropped with no error message naming the problem account.
**Why it happens:** Natural instinct is to validate the whole structure at once.
**How to avoid:** Loop with per-item `emailAccountSchema.safeParse(item)`; collect successes, log failures naming `item.id` and the failing field paths from `error.issues`.
**Warning signs:** A single typo in accounts.json causes all tools to return "account not found" for every accountId.

### Pitfall 2: SIGTERM Races In-Flight IMAP Operations (H-03)
**What goes wrong:** Calling `service.disconnect()` synchronously on SIGTERM tears down the socket while an IMAP batch operation is mid-execution, leaving the server-side state corrupted (messages partially moved, flags partially set).
**Why it happens:** The naive implementation is `process.on('SIGTERM', () => { services.forEach(s => s.disconnect()); process.exit(0); })`.
**How to avoid:** Set `shuttingDown = true` before any I/O; drain in-flight counter; wait with a deadline before disconnecting. The in-flight counter is incremented before each tool dispatch and decremented in `finally`.
**Warning signs:** Tests that send SIGTERM during an active batch operation observe partial state mutations.

### Pitfall 3: `getAccounts()` Signature Change Breaks Callers
**What goes wrong:** `getAccounts()` is currently synchronous. Making it `async` requires every call site to `await` it. Missing an `await` returns a `Promise<EmailAccount[]>` where an `EmailAccount[]` is expected — TypeScript may not catch this if the result is used in a `.find()` chain that type-checks `Promise.prototype.find` somehow (it won't — TypeScript will catch this, but only if strict mode is on, which it is in this project).
**Why it happens:** Forgetting to update call sites after signature change.
**How to avoid:** Use "Find All References" on `getAccounts` before changing the signature. Current call sites: `src/index.ts` lines 53, 295, 332 (three locations in `getService()` and `list_accounts` handler). All are in `async` function bodies, so `await` can be added directly.
**Warning signs:** TypeScript error "Property 'find' does not exist on type 'Promise<EmailAccount[]>'" at any call site.

### Pitfall 4: `fs.watch()` ENOENT When File Does Not Exist Yet
**What goes wrong:** `fs.watch(ACCOUNTS_PATH)` throws `ENOENT` if the file does not exist at startup (e.g., user has not run `accounts add` yet).
**Why it happens:** `fs.watch()` requires the target file or directory to exist at call time.
**How to avoid:** Wrap `fs.watch()` call in `try/catch`. On `ENOENT`, skip the watcher — `cachedAccounts` remains `null`, so the next `getAccounts()` call will attempt a fresh read. Optionally, watch the parent directory instead.
**Warning signs:** Process crashes at startup with `ENOENT` error before any tool is called.

### Pitfall 5: `imapflow.logout()` on Already-Dead Connection
**What goes wrong:** Calling `client.logout()` on a connection that is already closed (e.g., due to a network drop or prior error) throws, causing the shutdown sequence to abort with an unhandled rejection.
**Why it happens:** `disconnect()` in `ImapClient` checks `if (this.client)` but not `if (this.client.usable)`. A client object can exist but be unusable after the connection drops.
**How to avoid:** Check `this.client.usable` before calling `this.client.logout()`. Verified: `usable: boolean` is defined in imapflow TypeScript types (`lib/imap-flow.d.ts` line 636).
**Warning signs:** Unhandled promise rejection during shutdown containing "Connection not available" or "Socket closed".

### Pitfall 6: Doubled Signal Handlers
**What goes wrong:** `process.on('SIGTERM', shutdown)` is called inside `MailMCPServer` constructor or `run()` method — if the server is instantiated multiple times in tests, handlers accumulate and trigger multiple shutdown sequences.
**Why it happens:** Placing signal registration inside a class method that may be called repeatedly.
**How to avoid:** Register signal handlers exactly once, in `main()`, after constructing the single `MailMCPServer` instance. Never register them in the constructor or `run()`.
**Warning signs:** Test output shows "signal handler called twice" or `process.exit` called multiple times.

## Code Examples

### Verified Zod v4 API (confirmed against installed `zod ^4.3.6`)
```typescript
// All verified by direct node execution against installed package
import { z } from 'zod';

// Available: z.object, z.string, z.number, z.boolean, z.enum, z.literal, z.union, z.optional
// Available: .safeParse(), .refine()
// Available: z.email (standalone validator)

const schema = z.object({
  id: z.string().min(1),
  port: z.number().int().positive(),
  authType: z.enum(['login', 'oauth2']),
}).refine(d => d.port === 465 || d.port === 587, {
  message: 'smtpPort must be 465 (TLS) or 587 (STARTTLS)',
  path: ['smtpPort'],
});

const result = schema.safeParse(input);
if (!result.success) {
  const fields = result.error.issues.map(i => i.path.join('.') || 'root').join(', ');
  // => "smtpPort" (for the refine failure path)
}
```

### Verified imapflow `client.usable` (confirmed from TypeScript definitions)
```typescript
// lib/imap-flow.d.ts line 635-636:
// /** Is the connection currently usable or not */
// usable: boolean;

async disconnect(): Promise<void> {
  if (this.client && this.client.usable) {
    await this.client.logout();
  }
  this.client = null;
}
```

### Verified `timer.unref()` pattern (confirmed by execution)
```typescript
// Node.js built-in — timer.unref() allows process to exit even with pending timer
const timer = setTimeout(() => {
  console.error('Forced exit after 10s shutdown timeout');
  process.exit(1);
}, 10_000);
timer.unref(); // critical — without this, the timer prevents clean exit
```

### Verified `process.on` signal handler (confirmed by execution)
```typescript
// Standard Node.js signal handling — no library needed
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Both must point to the same handler to avoid duplicate shutdown logic
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readFileSync` per tool call | Module-level cache + `fs.watch()` invalidation | v1.1.0 | Eliminates synchronous I/O blocking event loop on every tool invocation |
| `throw new Error('...')` in service layer | `throw new NetworkError('...')` / `AuthError` etc. | v1.1.0 | Enables typed branching in catch block; callers can distinguish auth vs. network failures |
| Cast raw JSON to `EmailAccount` without validation | Per-item `emailAccountSchema.safeParse()` | v1.1.0 | Malformed config entries produce actionable errors naming bad fields and account IDs |
| No signal handlers | SIGTERM/SIGINT shutdown with in-flight drain | v1.1.0 | Eliminates IMAP connection leak on every server restart |

**No deprecated features in scope for this phase.**

## Open Questions

1. **`getAccounts()` sync-to-async migration scope**
   - What we know: Three call sites in `src/index.ts`; all in async contexts; TypeScript strict mode will flag missing `await`
   - What's unclear: Whether `saveAccounts()` in `src/config.ts` (used by CLI `accounts add`) needs corresponding treatment
   - Recommendation: `saveAccounts()` writes to disk synchronously and is CLI-only — acceptable to leave as-is for this phase; the cache-invalidation approach means the next `getAccounts()` call will reload after a `saveAccounts()` write

2. **`EmailAccount` type vs. Zod-inferred type**
   - What we know: `EmailAccount` is currently a hand-written interface in `src/types/index.ts`; `emailAccountSchema` will produce a compatible inferred type
   - What's unclear: Whether to replace the interface with `type EmailAccount = z.infer<typeof emailAccountSchema>` or keep both in sync manually
   - Recommendation: Replace the interface with `z.infer<>` — eliminates duplication risk; confirmed that Zod v4 `z.infer<>` is available and the tsconfig `ES2022` target is compatible

3. **`fs.watch()` behavior on macOS for `~/.config` directory**
   - What we know: `fs.watch()` works on macOS (uses FSEvents under the hood); `ACCOUNTS_PATH` is `~/.config/mail-mcp/accounts.json`
   - What's unclear: Whether `fs.watch()` fires correctly when the file is written by the same process (via `saveAccounts()`)
   - Recommendation: Treat as working; the watcher invalidates to `null` and the next read reloads; even if the watcher misses a self-write, the next tool call will see stale data for at most one call (acceptable)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `vitest.config.ts` (exists at repo root) |
| Quick run command | `npm run test -- --reporter=verbose src/errors.test.ts src/config.test.ts src/index.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | `shutdown()` calls `disconnect()` on all services | unit | `npm run test -- src/index.test.ts` | ✅ (extend) |
| CONN-01 | `shutdown()` resolves within 10s via forced exit timer | unit | `npm run test -- src/index.test.ts` | ✅ (extend) |
| CONN-01 | `disconnect()` skips `logout()` when `client.usable === false` | unit | `npm run test -- src/protocol/imap.test.ts` | ✅ (extend) |
| VAL-01 | Valid account parses without error | unit | `npm run test -- src/config.test.ts` | ✅ (extend) |
| VAL-01 | Invalid account field produces error naming field + account ID | unit | `npm run test -- src/config.test.ts` | ✅ (extend) |
| VAL-01 | One invalid account does not prevent valid accounts from loading | unit | `npm run test -- src/config.test.ts` | ✅ (extend) |
| VAL-03 | smtpPort 465 → `secure: true` in SmtpClient | unit | `npm run test -- src/protocol/smtp.test.ts` | ✅ (extend) |
| VAL-03 | smtpPort 587 → `secure: false` in SmtpClient | unit | `npm run test -- src/protocol/smtp.test.ts` | ✅ (extend) |
| VAL-04 | Second `getAccounts()` call returns cached result without disk read | unit | `npm run test -- src/config.test.ts` | ✅ (extend) |
| VAL-04 | Cache is null after fs.watch invalidation event | unit | `npm run test -- src/config.test.ts` | ✅ (extend) |
| SAFE-02 | `AuthError` instance has `code === 'AuthError'` | unit | `npm run test -- src/errors.test.ts` | ❌ Wave 0 |
| SAFE-02 | Catch block returns `[AuthError] message` format in tool response | unit | `npm run test -- src/index.test.ts` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `npm run test -- src/errors.test.ts src/config.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/errors.test.ts` — covers SAFE-02 error class instantiation, `instanceof` checks, `code` field values

*(All other test files exist and will be extended with new test cases)*

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/index.ts` — call sites for `getAccounts()`, current catch block pattern, `services` Map structure, `MailMCPServer` constructor
- Direct source read: `src/config.ts` — `getAccounts()` synchronous implementation, `ACCOUNTS_PATH` constant, existing Zod import
- Direct source read: `src/services/mail.ts` — `MailService.disconnect()` exists at lines 30-33
- Direct source read: `src/protocol/imap.ts` — `ImapClient.disconnect()` uses `client.logout()`; `this.client` null check
- Direct source read: `src/protocol/smtp.ts` — line 33: `secure: smtpPort === 465` already present
- Direct source read: `src/types/index.ts` — `EmailAccount` interface shape
- Direct execution: `node -e` — verified Zod v4 API: `z.object`, `z.string`, `z.number`, `z.boolean`, `z.enum`, `z.union`, `z.optional`, `.refine()`, `.safeParse()`, `z.email` standalone
- Direct read: `node_modules/imapflow/lib/imap-flow.d.ts` lines 635-636 — `usable: boolean` confirmed; line 653 `logout(): Promise<void>` confirmed; line 771 `on('close', listener)` confirmed
- Direct execution: `node -e` — verified `timer.unref()` available on `setTimeout` return value
- Direct execution: `npm run test` — all 72 existing tests pass; test infrastructure confirmed working

### Secondary (MEDIUM confidence)
- Project research file: `.planning/research/PITFALLS.md` — H-01 through H-11 pitfall catalog; H-03 (SIGTERM drain), H-04 (Zod failing open), H-06 (SMTP TLS mismatch)
- Project research file: `.planning/research/SUMMARY.md` — v1.1.0 architecture overview, confirmed integration points

### Tertiary (LOW confidence — verify at implementation time)
- None for this phase. All claims are verified from direct source reads and execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages are installed and API-verified by direct execution
- Architecture: HIGH — integration points confirmed by direct source reading; no guesswork
- Pitfalls: HIGH — sourced from prior codebase audit + direct verification of `client.usable` in imapflow types
- Validation patterns: HIGH — Zod v4 API confirmed by running against installed package

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable dependencies — imapflow, Zod, nodemailer release infrequently; re-verify if major version bumps)
