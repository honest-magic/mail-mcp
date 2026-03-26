# Phase 21 Context: Contact Extraction

## Goal

Add a new `extract_contacts` tool that scans recent messages in a folder and returns structured contact data — name, email address, message count, and last-seen date — sorted by frequency. This enables "who emails me most?" queries from AI agents.

## Current State

The codebase has `ImapClient.listMessages()` which fetches envelope data (from address, date, subject) for recent messages. This envelope data is lightweight (no body download) and contains exactly what we need: sender address and date.

`MailService` wraps `ImapClient` and is the surface exposed to MCP tool handlers in `src/index.ts`.

## Design Decisions

### Data Shape

```typescript
export interface ContactInfo {
  name: string;       // Display name from From header (may be empty string)
  email: string;      // Normalized lowercase email address
  count: number;      // Number of messages from this address in scanned set
  lastSeen: string;   // ISO-8601 date of most recent message
}
```

### Scanning Approach

- Reuse `ImapClient.listMessages()` — it already fetches `envelope` which includes `from[0].address` and `from[0].name`.
- However `listMessages()` currently only exposes `from` as a string (the address). We need the display name too.
- Solution: Add `extractContacts()` to `ImapClient` that does its own envelope scan with name extraction, returning `ContactInfo[]`.
- Or: Add a new method `scanEnvelopes()` to `ImapClient` that returns raw `{ name, email, date }` tuples.
- Chosen: Add `extractContacts(folder, count)` directly on `MailService` that calls a new lightweight `ImapClient.scanSenderEnvelopes(folder, count)` method.

### Why a Separate ImapClient Method

`listMessages()` fetches `bodyParts: ['TEXT']` for snippets — expensive for 100+ messages. The contact scan only needs `envelope` (no body). A dedicated `scanSenderEnvelopes` method skips body parts entirely, making bulk scanning 5-10x faster.

### Aggregation

Aggregation (group by email, count, track lastSeen) happens in `MailService.extractContacts()`, not in `ImapClient`. This keeps `ImapClient` as a protocol adapter and `MailService` as the business-logic layer.

### Name Resolution

When the same email appears with multiple display names (e.g., "Alice" vs "Alice Smith"), we use the name from the most recent message.

### Tool Parameters

- `accountId` (required)
- `folder` (optional, default `INBOX`)
- `count` (optional, default `100`) — number of recent messages to scan

### Limits

- Count capped at 500 to prevent runaway scans.
- Results capped at 50 unique contacts (by frequency).

## Files to Touch

| File | Change |
|------|--------|
| `src/protocol/imap.ts` | Add `scanSenderEnvelopes(folder, count): Promise<SenderEnvelope[]>` |
| `src/services/mail.ts` | Add `extractContacts(folder, count): Promise<ContactInfo[]>` |
| `src/index.ts` | Add `extract_contacts` tool definition + handler |
| `src/protocol/imap.test.ts` | TDD tests for `scanSenderEnvelopes` |
| `src/services/mail.test.ts` | TDD tests for `extractContacts` aggregation |
| `src/index.test.ts` | TDD tests for `extract_contacts` tool handler |

## Success Criteria

1. `extract_contacts` tool visible in `getTools()` output.
2. Returns contacts sorted by count descending.
3. Each contact has `{ name, email, count, lastSeen }`.
4. `npm test` passes.
