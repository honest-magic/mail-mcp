# Phase 12: Pagination, Health Check & Reconnect - Research

**Researched:** 2026-03-22
**Domain:** ImapFlow pagination, IMAP CAPABILITY health probe, SMTP EHLO probe, ImapFlow close-event reconnect with exponential backoff
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and prior phases:
- Pagination: Add optional `offset` parameter to `list_emails` and `search_emails` tool schemas. ImapFlow `fetch()` is an async generator — pagination is a range slice over sorted UIDs.
- Health check: `--validate-accounts` CLI flag probes IMAP CAPABILITY + SMTP EHLO per account. Uses existing `handleAccountsCommand()` pattern in `src/cli/accounts.ts`.
- Reconnect: ImapFlow emits `close` event on connection drop (no auto-reconnect). Add close listener that invalidates cached `MailService` in `MailMCPServer.services`. Next tool call triggers fresh service creation with one retry attempt and exponential backoff.
- Use `NetworkError` from `src/errors.ts` when reconnect fails.
- Existing `getAccounts()` is now async with caching (Phase 10).
- All tool dispatch now has rate limiting, email validation, and typed error handling (Phases 10-11).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | User can paginate large email lists via an `offset` parameter on `list_emails` and `search_emails` | UID range slicing in `listMessages()` and `searchMessages()` supports offset without re-fetching earlier messages |
| CONN-02 | IMAP client automatically attempts one reconnect with exponential backoff when connection drops | ImapFlow emits `close` event on drop; `MailMCPServer.services` Map deletion + `getService()` retry path with backoff covers this |
| CONN-03 | User can run `--validate-accounts` to probe IMAP CAPABILITY and SMTP EHLO for all accounts at startup | `parseArgs` pattern in `main()` supports a new `--validate-accounts` flag; `ImapFlow.connect()` automatically runs CAPABILITY; `transporter.verify()` issues EHLO |
</phase_requirements>

## Summary

Phase 12 adds three orthogonal infrastructure features to a codebase that is already well-structured (Phases 10-11 complete): cursor-style pagination using UID slicing, a `--validate-accounts` health probe CLI command, and a close-event-driven IMAP reconnect guard with one retry.

The codebase has no auto-reconnect today. ImapFlow emits a `close` event when the underlying socket closes and sets `client.usable = false` before doing so. The correct recovery pattern is to register a `once('close', ...)` listener on each new `ImapFlow` instance, delete the corresponding entry from `MailMCPServer.services`, and rely on the existing `getService()` method to re-create on the next tool call. A thin wrapper in `getService()` that retries creation once (with 1-second initial backoff) satisfies CONN-02's "one reconnect" requirement.

Pagination for `list_emails` is already partially implemented — `listMessages()` uses `mailbox.exists` and computes a sequence range from the tail. Adding `offset` means slicing `count` items from position `(total - offset - count)` instead of always from the tail. For `search_emails`, the UID array is sorted ascending; `offset` is a simple `slice(-(count + offset), offset > 0 ? -offset : undefined)` on that array. Both functions need an `offset` parameter threaded through `MailService` and the `list_emails`/`search_emails` dispatch blocks in `src/index.ts`, plus schema additions to `getTools()`.

**Primary recommendation:** Implement the three features as three independent vertical slices (pagination, reconnect, health check) in separate plans; each is testable in isolation and has no dependency on the others.

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `imapflow` | `^1.2.16` (installed) | IMAP client — pagination + reconnect | Already used; `close` event and UID `fetch` range confirmed in source |
| `nodemailer` | `^8.0.3` (installed) | SMTP client — health check via `transporter.verify()` | `verify()` issues EHLO/STARTTLS and resolves on success |
| `node:util.parseArgs` | built-in | CLI flag parsing | Already used in `main()` for `--read-only`; same pattern for `--validate-accounts` |

No new packages required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `once('close', ...)` + delete from Map | Custom keepalive/ping loop | Ping loop adds complexity and can conflict with mailbox locks; event-driven is simpler |
| Retry in `getService()` | Retry inside `ImapClient.connect()` | Retry at `getService()` level is the correct boundary — it is where creation is orchestrated |

## Architecture Patterns

### Recommended Project Structure (unchanged)
```
src/
├── protocol/imap.ts     — listMessages/searchMessages get offset param
├── services/mail.ts     — listEmails/searchEmails pass offset through
├── index.ts             — tool schemas, dispatch, getService reconnect guard, --validate-accounts
└── cli/
    └── accounts.ts      — handleAccountsCommand dispatches --validate-accounts (or index.ts main())
```

### Pattern 1: UID-range Pagination in `listMessages()`

**What:** Compute the absolute sequence start from `total`, `count`, and `offset`.
**When to use:** All `list_emails` tool calls that include `offset`.

Current code selects the last `count` messages:
```
start = Math.max(1, total - count + 1)
range = `${start}:*`
```

With offset:
```
// offset = 0  → newest `count` messages (current behaviour)
// offset = 10 → skip the newest 10, return the next `count`
const end   = Math.max(0, total - offset);
const start = Math.max(1, end - count + 1);
const range = end < 1 ? null : `${start}:${end}`;
// if range is null, return []
```

This avoids fetching UIDs that were already returned in previous pages.

### Pattern 2: UID-array Pagination in `searchMessages()`

**What:** Slice the sorted UID array by offset before fetching.
**When to use:** All `search_emails` calls that include `offset`.

```typescript
// Source: existing src/protocol/imap.ts searchMessages() pattern
const uidsArray = (uids as number[]).sort((a, b) => a - b); // ascending
// newest first: take from the right end, skipping `offset` from the right
const sliced = uidsArray.slice(
  Math.max(0, uidsArray.length - offset - count),
  uidsArray.length - offset > 0 ? uidsArray.length - offset : 0
);
// if offset >= uidsArray.length, sliced is [] — correct
```

### Pattern 3: Reconnect via Close-Event + Map Deletion

**What:** Register a `once('close', ...)` listener on each `ImapFlow` instance. On fire, delete the entry from `MailMCPServer.services`. On the next tool call `getService()` re-creates with one retry.
**When to use:** Every time a new `ImapClient` is connected.

Where to register: inside `ImapClient.connect()`, on `this.client` immediately after `await this.client.connect()`. The callback must call out to a handler provided by the caller (or fire an EventEmitter event on `ImapClient`). The cleanest seam: expose an `onClose` callback property on `ImapClient`, set by `MailMCPServer.getService()` after wiring up the service.

Alternatively — simpler — have `ImapClient` extend `EventEmitter` and emit `'close'` when its inner ImapFlow fires `'close'`. `MailMCPServer.getService()` then does:

```typescript
// In getService(), after service.connect():
const imap = (service as any).imapClient as ImapClient;
imap.once('close', () => {
  this.services.delete(accountId);
});
```

**Retry in `getService()`:**
```typescript
async getService(accountId: string): Promise<MailService> {
  if (this.services.has(accountId)) {
    return this.services.get(accountId)!;
  }
  // First attempt
  try {
    return await this._createService(accountId);
  } catch (firstErr) {
    // One retry with 1-second backoff
    await new Promise(r => setTimeout(r, 1_000));
    try {
      return await this._createService(accountId);
    } catch (secondErr) {
      throw new NetworkError(
        `Could not connect to account ${accountId} after retry: ${(secondErr as Error).message}`,
        { cause: secondErr }
      );
    }
  }
}
```

`_createService()` = the existing account lookup + `new MailService()` + `service.connect()` + `services.set()` block.

### Pattern 4: `--validate-accounts` Health Check

**What:** Probe each configured account via IMAP CAPABILITY and SMTP EHLO, print pass/fail, exit.
**When to use:** When `--validate-accounts` flag is present before MCP server starts.

```typescript
// In main() — after handleAccountsCommand(), before server start:
const { values } = parseArgs({
  args,
  options: {
    'read-only':          { type: 'boolean', default: false },
    'validate-accounts':  { type: 'boolean', default: false },  // NEW
  },
  strict: false,
});

if (values['validate-accounts']) {
  await runValidateAccounts();
  process.exit(0);
}
```

`runValidateAccounts()` implementation:
```typescript
async function runValidateAccounts(): Promise<void> {
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    console.log('No accounts configured.');
    return;
  }
  for (const account of accounts) {
    // IMAP probe: connect() runs CAPABILITY internally; logout immediately
    try {
      const imap = new ImapClient(account);
      await imap.connect();
      await imap.disconnect();
      console.log(`[PASS] ${account.id} IMAP`);
    } catch (e) {
      console.log(`[FAIL] ${account.id} IMAP — ${(e as Error).message}`);
    }
    // SMTP probe: transporter.verify() issues EHLO
    if (account.smtpHost) {
      try {
        const smtp = new SmtpClient(account);
        await smtp.verify();   // NEW thin wrapper around transporter.verify()
        console.log(`[PASS] ${account.id} SMTP`);
      } catch (e) {
        console.log(`[FAIL] ${account.id} SMTP — ${(e as Error).message}`);
      }
    } else {
      console.log(`[SKIP] ${account.id} SMTP — no smtpHost configured`);
    }
  }
}
```

`SmtpClient.verify()` must be a public method that calls `this.transporter.verify()` without also calling `sendMail`. This requires building the transporter (credential load) without the existing `connect()` path that calls `verify()` internally. Simplest: add `SmtpClient.healthCheck()` that builds the transporter and calls `verify()` once, or expose `transporter.verify()` directly after `connect()`. The latter is simpler since `SmtpClient.connect()` already calls `this.transporter.verify()` and throws on failure — calling `connect()` directly works and then you call `disconnect()` if needed. Nodemailer transporters are stateless (no persistent socket), so no cleanup is needed after `verify()`.

### Anti-Patterns to Avoid

- **Re-fetching all messages to paginate:** Never re-fetch the full mailbox to skip items. Always compute the sequence range or UID slice before calling `fetch()`.
- **Permanent reconnect loop:** CONN-02 specifies exactly one retry. Do not loop indefinitely — surface `NetworkError` if the retry also fails.
- **Attaching `close` listener to a dead `ImapClient`:** Always attach the `close` listener on the fresh `ImapFlow` instance _after_ `connect()` succeeds. Attaching before `connect()` may double-fire or fire on initial auth failures.
- **Using `client.authenticated` alone as the liveness guard:** `client.usable` is set to `false` before the `close` event fires (confirmed in source: line 1777 sets `usable = false`, close event emits at line 1950). Use `client.usable` for the pre-operation liveness check. The `close` event is the signal for cache invalidation.
- **Calling `SmtpClient.connect()` for health check in read-only mode:** The existing `MailService.connect()` skips SMTP (only connects IMAP) when `readOnly === true`. The health check must bypass `MailService` and probe SMTP directly when testing SMTP.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMTP health probe | Custom TCP socket to port 587 | `nodemailer transporter.verify()` | Issues full EHLO/STARTTLS handshake; already in codebase |
| IMAP capability check | Manual `client.run('CAPABILITY')` | `ImapClient.connect()` then `disconnect()` | `ImapFlow.connect()` runs CAPABILITY automatically during session setup (confirmed line 927, 1212) |
| Exponential backoff | Custom wait formula | Single fixed 1-second wait | CONN-02 requires "one reconnect" — a single sleep(1000) between attempts satisfies the spec |

## Common Pitfalls

### Pitfall 1: Offset Past End of Mailbox
**What goes wrong:** `offset >= total` in `listMessages()` causes `end < 1` — naively computing `start` and `range` would produce an invalid sequence like `0:0` or `1:0`.
**Why it happens:** Sequence numbers start at 1; Math operations can produce zero or negative values.
**How to avoid:** Guard with `if (end < 1) return [];` before constructing the range string.
**Warning signs:** ImapFlow throws "Invalid sequence" or returns unexpected results.

### Pitfall 2: Offset Past UID Array Length in `searchMessages()`
**What goes wrong:** `uidsArray.length - offset <= 0` — the slice bounds go negative and `Array.slice(-negative, 0)` returns `[]` but for the wrong reason.
**Why it happens:** JavaScript `Array.slice(-n)` interprets negative as "from end"; `slice(-0)` is `slice(0)` which returns the whole array.
**How to avoid:** Explicitly check `if (offset >= uidsArray.length) return [];` before slicing. Use `Math.max(0, ...)` guards on slice indices.
**Warning signs:** Tests with `offset = uidsArray.length` return all messages instead of none.

### Pitfall 3: Close Listener Fires During Intentional `shutdown()`
**What goes wrong:** `server.shutdown()` calls `service.disconnect()` which calls `client.logout()` then sets `this.client = null`. But the `ImapFlow` `close` event fires when the socket closes — which also happens during logout. The listener deletes the service from the Map, which then throws in `shutdown()` when it tries to disconnect a service that's already been removed.
**Why it happens:** `shutdown()` iterates `Array.from(this.services.values())` _before_ calling disconnect, so the Map mutation mid-iteration is harmless in that path. But the listener could also call `this.services.delete()` concurrently.
**How to avoid:** In the `close` listener, check `this.shuttingDown` before deleting from the Map: `if (!this.shuttingDown) { this.services.delete(accountId); }`. This suppresses spurious reconnects during graceful shutdown.
**Warning signs:** `shutdown()` tests fail because services Map is unexpectedly empty during the disconnect loop.

### Pitfall 4: Health Check Probes Account with No `smtpHost`
**What goes wrong:** Creating an `SmtpClient` for an account where `smtpHost` is undefined causes it to fall back to `account.host` (the IMAP host). The SMTP probe then fails or hangs connecting to the IMAP port.
**Why it happens:** `SmtpClient.connect()` uses `this.account.smtpHost || this.account.host`.
**How to avoid:** Skip SMTP probe when `account.smtpHost` is undefined. Print `[SKIP] ${account.id} SMTP — no smtpHost configured`.

### Pitfall 5: `--validate-accounts` Flag Conflicts with `handleAccountsCommand()`
**What goes wrong:** `handleAccountsCommand()` checks if `args[0] === 'accounts'` and returns `true` early. If `--validate-accounts` is passed as a flag (not a positional), there is no conflict. But if someone accidentally uses `validate-accounts` as a subcommand, the accounts handler runs instead.
**Why it happens:** Two different CLI dispatch patterns exist in `main()`.
**How to avoid:** `--validate-accounts` is a boolean flag parsed by `parseArgs`, not a positional arg. `handleAccountsCommand` only fires on `args[0] === 'accounts'`. No conflict as long as the flag uses the `--` prefix. Process `--validate-accounts` after `handleAccountsCommand` returns `false`.

## Code Examples

### Sequence Range with Offset (listMessages)
```typescript
// Source: analysis of existing src/protocol/imap.ts listMessages() + pagination spec
async listMessages(folder = 'INBOX', count = 10, offset = 0): Promise<MessageMetadata[]> {
  const lock = await this.client!.getMailboxLock(folder);
  try {
    const mailbox = this.client!.mailbox;
    const total = (mailbox && typeof mailbox !== 'boolean') ? mailbox.exists : 0;
    if (total === 0) return [];

    const end   = total - offset;          // sequence number of the newest message in page
    if (end < 1) return [];               // offset past end of mailbox

    const start = Math.max(1, end - count + 1);
    const range = `${start}:${end}`;

    const messages: MessageMetadata[] = [];
    for await (const msg of this.client!.fetch(range, { envelope: true, flags: true, internalDate: true, bodyParts: ['TEXT'] })) {
      // ... same as today ...
    }
    return messages.reverse();
  } finally {
    lock.release();
  }
}
```

### UID-array Offset Slice (searchMessages)
```typescript
// Source: analysis of existing src/protocol/imap.ts searchMessages() + pagination spec
async searchMessages(criteria: any, folder = 'INBOX', count = 10, offset = 0): Promise<MessageMetadata[]> {
  const lock = await this.client!.getMailboxLock(folder);
  try {
    const uids = await this.client!.search(criteria, { uid: true });
    if (!uids || typeof uids === 'boolean' || uids.length === 0) return [];

    const uidsArray = (uids as number[]).sort((a, b) => a - b); // ascending = oldest first
    if (offset >= uidsArray.length) return [];

    // Take the last (count + offset) items, then drop the last `offset` items
    const end   = uidsArray.length - offset;               // exclusive right bound
    const start = Math.max(0, end - count);                 // inclusive left bound
    const sliced = uidsArray.slice(start, end);

    const messages: MessageMetadata[] = [];
    for await (const msg of this.client!.fetch(sliced.join(','), { envelope: true, flags: true, internalDate: true, bodyParts: ['TEXT'] }, { uid: true })) {
      // ... same as today ...
    }
    return messages.reverse();
  } finally {
    lock.release();
  }
}
```

### Close-Event Registration Pattern
```typescript
// In getService() after _createService() succeeds
// ImapClient must expose its internal ImapFlow instance or propagate the event
// Option: have ImapClient emit 'close' when its ImapFlow fires 'close'

// In ImapClient.connect():
this.client.once('close', () => {
  this.emit('close');  // ImapClient extends EventEmitter
});

// In MailMCPServer.getService():
const imap = (service as any).imapClient as ImapClient;
imap.once('close', () => {
  if (!this.shuttingDown) {
    this.services.delete(accountId);
  }
});
```

### Retry Wrapper in `getService()`
```typescript
// One retry with 1-second sleep, surfaces NetworkError on second failure
private async _createAndCacheService(accountId: string): Promise<MailService> {
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);
  const service = new MailService(account, this.readOnly);
  await service.connect();
  this.services.set(accountId, service);
  // wire close listener
  const imap = (service as any).imapClient as ImapClient;
  imap.once('close', () => {
    if (!this.shuttingDown) this.services.delete(accountId);
  });
  return service;
}

private async getService(accountId: string): Promise<MailService> {
  if (this.services.has(accountId)) return this.services.get(accountId)!;
  try {
    return await this._createAndCacheService(accountId);
  } catch (firstErr) {
    await new Promise(r => setTimeout(r, 1_000));
    try {
      return await this._createAndCacheService(accountId);
    } catch (secondErr) {
      throw new NetworkError(
        `Could not connect to account ${accountId} after reconnect attempt: ${(secondErr as Error).message}`,
        { cause: secondErr }
      );
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `listMessages()` always fetches tail `count` messages | Add `offset` param to slice the sequence range | Phase 12 | Users can page through large mailboxes |
| `getService()` throws immediately on connection drop | One-retry with backoff before surfacing `NetworkError` | Phase 12 | Server survives transient drops without user intervention |
| No startup health check | `--validate-accounts` probes IMAP + SMTP per account | Phase 12 | Operators can validate credentials before deploying |

## Open Questions

1. **Should `ImapClient` extend `EventEmitter` or use a callback property?**
   - What we know: ImapFlow extends EventEmitter already; ImapClient currently does not extend anything special.
   - What's unclear: Adding EventEmitter inheritance is the cleanest design but changes the class hierarchy. A simpler alternative is a nullable `onClose?: () => void` property.
   - Recommendation: Use `onClose` callback property — zero new base class, less test churn. Set it in `_createAndCacheService()`.

2. **Sequence vs UID for `listMessages()` pagination**
   - What we know: The existing code uses sequence numbers (`start:end` range), not UIDs. Sequence numbers can shift if messages are deleted between pages (gaps in ordering).
   - What's unclear: Whether this shift matters for the use case (AI paging through a mailbox is typically read-only listing, not concurrent delete).
   - Recommendation: Use sequence numbers as today — simpler, consistent with existing code, acceptable for the defined success criteria ("returns the correct subsequent page without re-fetching earlier messages").

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

Current baseline: 158 tests in 11 files, all passing (537ms).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | `list_emails` with `offset=10` skips newest 10 messages | unit | `npm test -- src/protocol/imap.test.ts` | ✅ (extend existing) |
| QUAL-01 | `list_emails` with `offset >= total` returns `[]` | unit | `npm test -- src/protocol/imap.test.ts` | ✅ (extend existing) |
| QUAL-01 | `search_emails` with `offset=5` skips 5 newest matching UIDs | unit | `npm test -- src/protocol/imap.test.ts` | ✅ (extend existing) |
| QUAL-01 | `search_emails` with `offset >= uids.length` returns `[]` | unit | `npm test -- src/protocol/imap.test.ts` | ✅ (extend existing) |
| QUAL-01 | `list_emails` tool schema has `offset` property | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| QUAL-01 | `search_emails` tool schema has `offset` property | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-02 | `close` event on ImapFlow causes `services` Map entry deletion | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-02 | After `close` event, next `getService()` creates a fresh service | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-02 | Two consecutive connect failures throw `NetworkError` | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-02 | `close` listener does NOT delete from Map when `shuttingDown=true` | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-03 | `--validate-accounts` prints `[PASS]` for a working IMAP connection | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-03 | `--validate-accounts` prints `[FAIL]` when IMAP connect throws | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |
| CONN-03 | `--validate-accounts` prints `[SKIP]` for accounts with no `smtpHost` | unit | `npm test -- src/index.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (158+ tests) before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. Tests should be added inline to the existing `src/protocol/imap.test.ts` and `src/index.test.ts` files following the patterns already established. No new test files are required.

## Sources

### Primary (HIGH confidence)
- `/Users/mis/dev/mail_mcp/node_modules/imapflow/lib/imap-flow.js` — confirmed `close` event at line 1950, `usable = false` at line 1777, CAPABILITY runs at lines 927/1212
- `/Users/mis/dev/mail_mcp/src/protocol/imap.ts` — verified existing `listMessages()` and `searchMessages()` sequence/UID patterns
- `/Users/mis/dev/mail_mcp/src/index.ts` — verified `getService()` structure, `services` Map, `parseArgs` usage, `shuttingDown` flag
- `/Users/mis/dev/mail_mcp/src/errors.ts` — verified `NetworkError` class exists and takes `cause` option
- `/Users/mis/dev/mail_mcp/src/protocol/smtp.ts` — verified `transporter.verify()` is called in `connect()`
- `/Users/mis/dev/mail_mcp/src/cli/accounts.ts` — verified `handleAccountsCommand()` pattern

### Secondary (MEDIUM confidence)
- ImapFlow documentation note at line 3714: "So whenever a 'close' event occurs you must create a new connection yourself" — confirms no auto-reconnect

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed; APIs verified in installed source
- Architecture: HIGH — patterns derived from codebase inspection and verified against imapflow source
- Pitfalls: HIGH — each pitfall verified against actual code paths (sequence math, close+shutdown interaction)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable, no external dependencies changing)
