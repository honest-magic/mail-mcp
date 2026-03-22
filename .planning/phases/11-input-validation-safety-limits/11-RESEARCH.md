# Phase 11: Input Validation & Safety Limits - Research

**Researched:** 2026-03-22
**Domain:** Input validation, attachment size guarding, in-memory rate limiting (Node.js/TypeScript)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and Phase 10 context:
- Phase 10 delivered typed error classes in `src/errors.ts` — use `ValidationError` for email/attachment rejections, `QuotaError` for rate limiting
- Email validation: RFC 5322 format check on to/cc/bcc before SMTP send (zero-dependency regex sufficient)
- Attachment size: Check BODYSTRUCTURE size before content download, reject with clear error if > 50MB default
- Rate limiting: In-memory sliding window per account ID (100 req/60s default), no external dependencies
- All guards must return `{ content, isError: true }` not throw `McpError` (H-14 pitfall from research)
- Validation happens at tool dispatch level in `src/index.ts` before service method calls

### Claude's Discretion

All implementation choices are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VAL-02 | Email addresses (to/cc/bcc) are validated as RFC 5322 format before SMTP send | Safe regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — ReDoS-safe; applied in `send_email` and `create_draft` handlers before `getService()` call |
| SAFE-01 | Attachment download is rejected with clear error when BODYSTRUCTURE size exceeds configurable limit (default 50MB) | imapflow `fetchOne(..., { bodyStructure: true })` returns `MessageStructureObject` with `size` field; walk `childNodes` tree to find part by name before downloading |
| SAFE-03 | Per-account in-memory rate limiter enforces a sliding window limit (default 100 req/60s) | `rate-limiter-flexible ^10.0.1` `RateLimiterMemory` — `consume(accountId)` rejects with `RateLimiterRes` on limit; instantiate per `MailMCPServer` constructor, not as a singleton |
</phase_requirements>

---

## Summary

Phase 11 adds three independent protective guards between MCP tool dispatch and network I/O: email address validation (VAL-02), attachment size pre-flight checks (SAFE-01), and per-account rate limiting (SAFE-03). All three operate entirely before any SMTP or IMAP connection work occurs — they are pure, fast, synchronous or in-memory checks.

The Phase 10 typed error infrastructure (`ValidationError`, `QuotaError` from `src/errors.ts`) is already in place and already handled by the catch block in `src/index.ts`. The `dispatchTool` catch block formats `MailMCPError` subclasses as `[ErrorCode] message` and returns `{ content, isError: true }` — which is exactly the pattern all three new guards must use.

The critical insight for SAFE-01 is that the current `downloadAttachment` path in `src/services/mail.ts` fetches the entire message source via `simpleParser` before inspecting attachment sizes. The size check must happen _before_ this call using a lightweight `fetchOne(..., { bodyStructure: true })` lookup, which returns IMAP-reported byte sizes for each body part without transferring any content.

**Primary recommendation:** Implement the three guards in order — email validation (simplest, zero deps), rate limiter (new dependency, add to package.json), attachment size check (requires understanding imapflow BODYSTRUCTURE tree traversal). All three plug into `src/index.ts` at the tool dispatch level.

---

## Standard Stack

### Core (no changes from existing stack)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `imapflow` | `^1.2.16` (installed) | BODYSTRUCTURE fetch for size check | Already in codebase; `fetchOne` with `bodyStructure: true` option returns parsed `MessageStructureObject` tree |
| `zod` | `^4.3.6` (installed) | Already used for config validation | Consistent with existing validation layer |

### New Production Dependency

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `rate-limiter-flexible` | `^10.0.1` | In-memory sliding window rate limiter | 416K weekly downloads; TypeScript types bundled; zero external storage deps; confirmed MEDIUM-HIGH confidence |

**Version verification:** `npm view rate-limiter-flexible version` returns `10.0.1` (latest as of 2026-03-22).

### Supporting (zero-dependency — project-local)

| Utility | Location | Purpose | Implementation |
|---------|----------|---------|----------------|
| `validateEmailAddresses` | `src/utils/validation.ts` | RFC 5322-safe email format check | Simple regex, no npm package |
| `RateLimiter` wrapper | `src/utils/rate-limiter.ts` | Per-account rate limiter instance management | Wraps `RateLimiterMemory`, exported as class |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple safe regex | `validator` npm package | `validator.isEmail()` is more thorough but adds a dep; simple regex is sufficient for format pre-flight (SMTP server provides authoritative rejection) |
| Simple safe regex | Full RFC 5322 regex | ReDoS risk — exponential worst-case on crafted input; never use |
| `rate-limiter-flexible` | Hand-rolled `Map<accountId, {count, windowStart}>` | Custom implementation misses sliding window semantics, clock drift edge cases, and reset logic; use the library |
| `rate-limiter-flexible` | Redis-backed limiter | Local single-process server; Redis adds external storage dependency for zero benefit |

**Installation:**
```bash
npm install rate-limiter-flexible
```

---

## Architecture Patterns

### Where Guards Live

All three guards are applied at the **tool dispatch level** in `src/index.ts` — _before_ `getService(accountId)` is called. This ensures zero network I/O occurs on rejected requests.

```
CallToolRequestSchema handler
  → shuttingDown guard (existing)
  → readOnly guard (existing)
  → [NEW] RateLimiter.consume(accountId)     — SAFE-03
  → [NEW] validateEmailAddresses(to,cc,bcc)  — VAL-02 (send_email/create_draft only)
  → getService(accountId)
  → service.downloadAttachment()
      → [NEW] checkAttachmentSize(uid, filename, folder, limit)  — SAFE-01
      → actual content download
```

### Recommended Project Structure (new files)

```
src/
├── utils/
│   ├── validation.ts      # validateEmailAddresses() — VAL-02
│   └── rate-limiter.ts    # RateLimiter class wrapper — SAFE-03
├── errors.ts              # Already exists (Phase 10)
├── index.ts               # Modified: add rate limiter + email validation calls
└── protocol/
    └── imap.ts            # Modified: add fetchAttachmentSize() helper — SAFE-01
```

### Pattern 1: Email Address Validation (VAL-02)

**What:** Parse comma-separated address strings from `to`, `cc`, `bcc` fields. Split on commas, trim, apply safe regex to each. Collect invalid entries. Throw `ValidationError` with all invalid addresses named.

**When to use:** In `send_email` and `create_draft` handlers, before `getService()`.

```typescript
// src/utils/validation.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailAddresses(
  ...addrFields: Array<string | undefined>
): void {
  const invalid: string[] = [];
  for (const field of addrFields) {
    if (!field) continue;
    // Simple comma split — nodemailer accepts "Name <addr>" format too,
    // but we validate the addr portion only
    for (const raw of field.split(',')) {
      const addr = raw.trim();
      // Extract angle-bracket address if present: "Name <addr@example.com>"
      const match = addr.match(/<([^>]+)>/);
      const email = match ? match[1].trim() : addr;
      if (email && !EMAIL_RE.test(email)) {
        invalid.push(email);
      }
    }
  }
  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid email address(es): ${invalid.join(', ')}`
    );
  }
}
```

**Usage in `src/index.ts`:**
```typescript
// Inside send_email handler, BEFORE getService()
validateEmailAddresses(args.to, args.cc, args.bcc);
```

### Pattern 2: Attachment Size Check (SAFE-01)

**What:** Before downloading attachment content, fetch BODYSTRUCTURE for the message using `fetchOne(..., { bodyStructure: true })`. Walk the `childNodes` tree to find the part with matching filename (via `parameters.name` or `dispositionParameters.filename`). If `size > limit`, throw `ValidationError`. If matching part is not found in BODYSTRUCTURE, allow the download to proceed (BODYSTRUCTURE missing is not a blocking condition — IMAP servers may omit it).

**imapflow `MessageStructureObject` type (confirmed from `node_modules/imapflow/lib/imap-flow.d.ts`):**
```typescript
interface MessageStructureObject {
  part?: string;         // Body part number for download
  type: string;          // MIME type e.g. "application/pdf"
  parameters?: { [key: string]: string };  // includes "name" for filename
  size?: number;         // Expected size in bytes (from BODYSTRUCTURE)
  disposition?: string;  // "attachment" | "inline"
  dispositionParameters?: { [key: string]: string }; // includes "filename"
  childNodes?: MessageStructureObject[];  // child parts for multipart
}
```

**Helper in `src/protocol/imap.ts`:**
```typescript
// Source: imapflow imap-flow.d.ts (confirmed from node_modules)
async fetchAttachmentSize(
  uid: string,
  filename: string,
  folder: string = 'INBOX'
): Promise<number | null> {
  if (!this.client) throw new Error('Not connected');
  const lock = await this.client.getMailboxLock(folder);
  try {
    const msg = await this.client.fetchOne(
      uid,
      { bodyStructure: true },
      { uid: true }
    );
    if (!msg?.bodyStructure) return null;

    // Walk tree to find matching part
    function findSize(node: MessageStructureObject): number | null {
      const name =
        node.parameters?.name ??
        node.dispositionParameters?.filename;
      if (name === filename && node.size != null) {
        return node.size;
      }
      if (node.childNodes) {
        for (const child of node.childNodes) {
          const found = findSize(child);
          if (found != null) return found;
        }
      }
      return null;
    }

    return findSize(msg.bodyStructure);
  } finally {
    lock.release();
  }
}
```

**Usage in `src/services/mail.ts` `downloadAttachment()`:**
```typescript
async downloadAttachment(
  uid: string,
  filename: string,
  folder: string = 'INBOX',
  maxBytes: number = 50 * 1024 * 1024
): Promise<{ content: Buffer; contentType: string }> {
  const size = await this.imapClient.fetchAttachmentSize(uid, filename, folder);
  if (size != null && size > maxBytes) {
    throw new ValidationError(
      `Attachment "${filename}" is ${Math.round(size / 1024 / 1024)} MB, ` +
      `which exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit. ` +
      `Use an email client to download large attachments directly.`
    );
  }
  // ... existing simpleParser download path unchanged
}
```

### Pattern 3: Per-Account Rate Limiting (SAFE-03)

**What:** `RateLimiterMemory` instance with `points: 100, duration: 60`. One instance per `MailMCPServer` (not a singleton). Per-account limiting via a `Map<accountId, RateLimiterMemory>` — each account gets its own limiter so a busy account does not starve others.

**Confirmed API from official README (verified 2026-03-22):**
- Constructor: `new RateLimiterMemory({ points: number, duration: number })`
- `consume(key: string, points?: number): Promise<RateLimiterRes>` — rejects with `RateLimiterRes` when limit exceeded
- Rejection carries `msBeforeNext`, `remainingPoints`, `consumedPoints`

```typescript
// src/utils/rate-limiter.ts
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

export const DEFAULT_RATE_LIMIT_POINTS = 100;
export const DEFAULT_RATE_LIMIT_DURATION = 60; // seconds

export class AccountRateLimiter {
  private limiters = new Map<string, RateLimiterMemory>();

  constructor(
    private readonly points = DEFAULT_RATE_LIMIT_POINTS,
    private readonly duration = DEFAULT_RATE_LIMIT_DURATION,
  ) {}

  private getLimiter(accountId: string): RateLimiterMemory {
    if (!this.limiters.has(accountId)) {
      this.limiters.set(
        accountId,
        new RateLimiterMemory({ points: this.points, duration: this.duration })
      );
    }
    return this.limiters.get(accountId)!;
  }

  async consume(accountId: string): Promise<void> {
    try {
      await this.getLimiter(accountId).consume(accountId);
    } catch (res) {
      const wait = res instanceof RateLimiterRes
        ? Math.ceil(res.msBeforeNext / 1000)
        : 60;
      throw new QuotaError(
        `Rate limit exceeded for account "${accountId}". ` +
        `Retry after ${wait} second(s).`
      );
    }
  }
}
```

**Usage in `src/index.ts`:**
```typescript
// In MailMCPServer constructor:
private readonly rateLimiter = new AccountRateLimiter();

// In CallToolRequestSchema handler, after shuttingDown guard, before readOnly guard:
const accountId = (request.params.arguments as any)?.accountId as string | undefined;
if (accountId) {
  await this.rateLimiter.consume(accountId);
}
```

**Why per-account `Map` and not one global limiter:** A single global limiter would let one high-traffic account exhaust the quota for all others. Per-account instances are fully independent. `RateLimiterMemory` is lightweight (no I/O); creating one per account is fine.

### Anti-Patterns to Avoid

- **Full RFC 5322 regex for email validation:** Has exponential worst-case backtracking on crafted input. Blocks the Node.js event loop. Use `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` instead.
- **Global singleton `RateLimiterMemory`:** Creates cross-account quota coupling. Must be per-account.
- **Throwing `McpError` from guards:** The MCP catch block in `src/index.ts` handles `MailMCPError` subclasses correctly (returns `{ content, isError: true }`). Throwing `McpError` bypasses this and leaks protocol internals to the caller.
- **Checking attachment size after downloading:** The entire point of SAFE-01 is to prevent the bytes from being transferred. Check `bodyStructure.size` before calling `fetchMessageBody`.
- **Blocking `downloadAttachment` when BODYSTRUCTURE is unavailable:** Some IMAP servers may not return BODYSTRUCTURE, or the size field may be absent. If `fetchAttachmentSize` returns `null`, allow the download — the guard is best-effort, not a hard block on missing metadata.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sliding window rate limiter | Custom `Map<accountId, {count, windowStart}>` | `rate-limiter-flexible` `RateLimiterMemory` | Sliding window vs fixed window semantics; clock drift edge cases; reset-on-limit logic; all solved by the library |
| Full RFC 5322 email validation | Complex regex | Simple safe regex + SMTP server rejection | RFC 5322 regex is ReDoS-vulnerable; SMTP server is the authoritative validator anyway |
| MIME type sniffing for size | Custom content-length header parsing | imapflow `bodyStructure.size` | BODYSTRUCTURE is the IMAP-standard way to get part sizes before download |

**Key insight:** All three validation/limiting problems have standard, well-tested solutions. The custom implementations for each (complex regex, hand-rolled rate limiter, custom MIME size parsing) all have subtle correctness issues that the standard approaches handle correctly.

---

## Common Pitfalls

### Pitfall 1: Email Regex ReDoS (H-09)

**What goes wrong:** Complex email validation regexes with nested quantifiers have exponential worst-case behavior. A crafted 50-character address can block the Node.js event loop for seconds.

**Why it happens:** Developers copy "comprehensive" RFC 5322 regexes without understanding their backtracking behavior. The full RFC 5322 grammar is actually context-free, not regular — any regex approximation either misses valid addresses or introduces ReDoS risk.

**How to avoid:** Use `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — prohibits whitespace and the `@` sign in each segment, requires exactly one `@`, and requires a `.` in the domain. This catches the common malformed cases without ReDoS risk.

**Warning signs:** Any regex with `+` or `*` inside a group that itself has `+` or `*` applied.

### Pitfall 2: Rate Limiter as Singleton (H-05)

**What goes wrong:** A module-level singleton `RateLimiterMemory` makes the rate limit apply across all accounts combined. One active account exhausts the quota for all others.

**Why it happens:** Singleton is the instinctive pattern for "one rate limiter for the server."

**How to avoid:** Instantiate `AccountRateLimiter` in `MailMCPServer` constructor (not at module level). Each account gets its own `RateLimiterMemory` via the internal `Map`. This is exactly how Phase 10's `STATE.md` decision documents it: "Per-account `Map<accountId, RateLimiter>`. Default: 100 req/60s sliding window."

**Warning signs:** `const rateLimiter = new RateLimiterMemory(...)` at module top-level or as a static property.

### Pitfall 3: Attachment Size Check After Download

**What goes wrong:** Calling `simpleParser` (which downloads the full message source) _before_ checking the size defeats the purpose of SAFE-01. The 50 MB attachment is already in memory when the error is returned.

**Why it happens:** The current `downloadAttachment()` method only has access to parsed attachments (post-download). Adding a size check there would be too late.

**How to avoid:** Add `fetchAttachmentSize()` to `ImapClient` as a _separate_ BODYSTRUCTURE-only fetch. Call it at the start of `downloadAttachment()` before `fetchMessageBody()`. The BODYSTRUCTURE fetch transfers only the metadata (typically < 1 KB) regardless of attachment size.

**Warning signs:** `const { content } = await simpleParser(...)` appearing before a size check.

### Pitfall 4: Mailbox Lock Not Released in Finally

**What goes wrong:** `fetchAttachmentSize()` acquires a mailbox lock via `getMailboxLock()`. If the lock is released in a `catch` block only (not `finally`), an exception before the `catch` leaves the lock held. All subsequent IMAP operations for that folder hang silently for 15+ minutes (imapflow issue #48).

**Why it happens:** `try/catch` instead of `try/finally` for lock release.

**How to avoid:** Always use `try { ... } finally { lock.release(); }`. Never release in `catch` only. This pattern is already established throughout `src/protocol/imap.ts`.

**Warning signs:** `lock.release()` appearing only inside a `catch` block.

### Pitfall 5: Missing Rate Limit Guard for `list_accounts` Tool

**What goes wrong:** `list_accounts` has no `accountId` in its arguments. If rate limiting is applied unconditionally as `rateLimiter.consume(args.accountId)`, it silently passes `undefined` as the key — all `list_accounts` calls share a single rate limit bucket, which may not be intended.

**Why it happens:** The guard logic doesn't account for tools that have no `accountId`.

**How to avoid:** Only apply rate limiting when `accountId` is present in the arguments. `list_accounts` is a cheap metadata-only call and does not interact with IMAP/SMTP at all.

---

## Code Examples

### RateLimiterMemory — consume and error handling

```typescript
// Source: rate-limiter-flexible official README (verified 2026-03-22)
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

const limiter = new RateLimiterMemory({
  points: 100,    // max consume points per window
  duration: 60,   // window duration in seconds
});

try {
  await limiter.consume('user-account-id');  // consumes 1 point
  // proceed with operation
} catch (res) {
  if (res instanceof RateLimiterRes) {
    const retryAfter = Math.ceil(res.msBeforeNext / 1000);
    console.error(`Rate limited. Retry after ${retryAfter}s`);
    // res.consumedPoints, res.remainingPoints also available
  }
}
```

### imapflow BODYSTRUCTURE fetch

```typescript
// Source: imapflow imap-flow.d.ts in node_modules (confirmed: size field exists)
const msg = await this.client.fetchOne(
  uid,
  { bodyStructure: true },
  { uid: true }
);
// msg.bodyStructure is MessageStructureObject | undefined
// MessageStructureObject.size = Expected size in bytes
// MessageStructureObject.parameters.name = filename for leaf parts
// MessageStructureObject.dispositionParameters.filename = alt filename
// MessageStructureObject.childNodes = child parts for multipart messages
```

### Dispatching through all guards (src/index.ts order)

```typescript
// In CallToolRequestSchema handler:
if (this.shuttingDown) { /* return error */ }
this.inFlightCount++;
try {
  // 1. Read-only guard (existing)
  if (this.readOnly && WRITE_TOOLS.has(toolName)) { /* return error */ }

  // 2. Rate limit guard (new — SAFE-03)
  const accountId = (request.params.arguments as any)?.accountId as string | undefined;
  if (accountId) {
    await this.rateLimiter.consume(accountId);  // throws QuotaError on limit
  }

  // 3. Email validation (new — VAL-02, in send_email/create_draft handlers only)
  if (toolName === 'send_email' || toolName === 'create_draft') {
    validateEmailAddresses(args.to, args.cc, args.bcc);  // throws ValidationError
  }

  // 4. Service call (existing)
  const service = await this.getService(accountId!);
  // ... tool-specific logic
  // 5. Attachment size check fires inside service.downloadAttachment() — SAFE-01
} catch (error) {
  // Existing catch block handles MailMCPError → { content, isError: true }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No email validation before SMTP send | `validateEmailAddresses()` at dispatch level | Phase 11 | SMTP connection is never opened for malformed recipients |
| Full attachment download before size check | BODYSTRUCTURE fetch + size guard before download | Phase 11 | 50 MB+ attachments rejected without consuming bandwidth |
| No rate limiting | Per-account `RateLimiterMemory` at dispatch level | Phase 11 | Runaway AI agents get `QuotaError` before any IMAP I/O |

**Deprecated/outdated:**
- `throw new Error(...)` in tool handlers for validation failures: Phase 10 established `ValidationError` / `QuotaError`. All new guards must use typed errors, not plain `Error`.

---

## Open Questions

1. **`rate-limiter-flexible` TypeScript import style**
   - What we know: The package bundles its own types (`types/index.d.ts`). `RateLimiterRes` is a class, not just an interface.
   - What's unclear: Whether `import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'` works in the ESM project without any `moduleResolution` changes.
   - Recommendation: Verify at implementation start — run `npx tsc --noEmit` after adding the import. If the package ships only CJS types with no ESM exports field, a `type: "module"` project may need `import type` or a tsconfig `moduleResolution: "bundler"` setting. The project already uses `"moduleResolution": "node16"` or similar (check `tsconfig.json`).

2. **Attachment filename matching — `parameters.name` vs `dispositionParameters.filename`**
   - What we know: The `MessageStructureObject` type has both `parameters` (Content-Type params, includes `name`) and `dispositionParameters` (Content-Disposition params, includes `filename`). Either or both may be present depending on the server/message.
   - What's unclear: Which is populated for a given message depends on how the email was composed.
   - Recommendation: Check both — `node.parameters?.name ?? node.dispositionParameters?.filename`. The existing `downloadAttachment` in `mail.ts` matches on `a.filename` from `mailparser`, which normalizes both. Use the same "check both" logic in the BODYSTRUCTURE walker.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists, includes `src/**/*.test.ts`) |
| Quick run command | `npm test -- --reporter=verbose src/utils/validation.test.ts src/utils/rate-limiter.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VAL-02 | `validateEmailAddresses` rejects `"notanemail"` with `ValidationError` | unit | `npm test -- src/utils/validation.test.ts` | Wave 0 |
| VAL-02 | `validateEmailAddresses` accepts `"user@example.com"` without throwing | unit | `npm test -- src/utils/validation.test.ts` | Wave 0 |
| VAL-02 | `validateEmailAddresses` handles comma-separated addresses | unit | `npm test -- src/utils/validation.test.ts` | Wave 0 |
| VAL-02 | `send_email` handler returns `isError: true` for invalid `to` (no SMTP call) | unit | `npm test -- src/index.test.ts` | ❌ Wave 0 |
| SAFE-01 | `fetchAttachmentSize` returns `null` when bodyStructure is absent | unit | `npm test -- src/protocol/imap.test.ts` | ❌ Wave 0 |
| SAFE-01 | `downloadAttachment` throws `ValidationError` when size > limit | unit | `npm test -- src/services/mail.test.ts` | ❌ Wave 0 |
| SAFE-01 | `downloadAttachment` proceeds when size <= limit | unit | `npm test -- src/services/mail.test.ts` | ❌ Wave 0 |
| SAFE-03 | `AccountRateLimiter.consume()` resolves under limit | unit | `npm test -- src/utils/rate-limiter.test.ts` | Wave 0 |
| SAFE-03 | `AccountRateLimiter.consume()` throws `QuotaError` after limit exceeded | unit | `npm test -- src/utils/rate-limiter.test.ts` | Wave 0 |
| SAFE-03 | Rate limit is per-account (account A exhausted does not block account B) | unit | `npm test -- src/utils/rate-limiter.test.ts` | Wave 0 |
| SAFE-03 | Tool handler returns `[QuotaError]` message on rate limit | unit | `npm test -- src/index.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=verbose src/utils/validation.test.ts src/utils/rate-limiter.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/utils/validation.test.ts` — unit tests for `validateEmailAddresses()` (VAL-02)
- [ ] `src/utils/rate-limiter.test.ts` — unit tests for `AccountRateLimiter` (SAFE-03)
- [ ] Additions to `src/index.test.ts` — dispatch-level tests for VAL-02 and SAFE-03 guards
- [ ] Additions to `src/protocol/imap.test.ts` — `fetchAttachmentSize()` mock tests (SAFE-01)
- [ ] Additions to `src/services/mail.test.ts` — `downloadAttachment()` size-guard tests (SAFE-01)

*(Framework and existing test files all present — no new framework install needed)*

---

## Sources

### Primary (HIGH confidence)

- `node_modules/imapflow/lib/imap-flow.d.ts` — `MessageStructureObject` interface confirmed: `size?: number`, `parameters?: {name}`, `dispositionParameters?: {filename}`, `childNodes?`, `bodyStructure: true` fetch option exists
- `src/errors.ts` — `ValidationError` and `QuotaError` classes confirmed as already implemented (Phase 10)
- `src/index.ts` — dispatch order and catch-block pattern confirmed by direct source read
- `src/services/mail.ts` — `downloadAttachment()` current path (full source download) confirmed; `maxBytes` parameter absent, must be added
- `src/protocol/imap.ts` — `try/finally` lock pattern confirmed throughout; no `fetchAttachmentSize` exists yet
- `.planning/research/SUMMARY.md` — project research H-05 (singleton rate limiter), H-09 (ReDoS) pitfall documentation

### Secondary (MEDIUM confidence)

- [rate-limiter-flexible npm](https://www.npmjs.com/package/rate-limiter-flexible) — version 10.0.1 confirmed latest; `RateLimiterMemory`, `consume()`, `RateLimiterRes` API confirmed from official README
- `npm view rate-limiter-flexible version` — returns `10.0.1` (verified 2026-03-22)

### Tertiary (LOW confidence)

- TypeScript ESM import compatibility for `rate-limiter-flexible` — assume works, but verify `npx tsc --noEmit` at implementation time before proceeding

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — imapflow and zod are in codebase; rate-limiter-flexible version confirmed from npm registry
- Architecture: HIGH — all integration points confirmed by direct source read; no speculative connections
- Pitfalls: HIGH — ReDoS and singleton pitfalls sourced from project research; lock-in-finally confirmed from existing codebase pattern; BODYSTRUCTURE-before-download confirmed from imapflow type definitions

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (rate-limiter-flexible API stable; imapflow API stable)
