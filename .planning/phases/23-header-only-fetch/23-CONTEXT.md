# Phase 23 Context: Header-Only Fetch

## Problem Statement

`list_emails` currently fetches `bodyParts: ['TEXT']` for every message to generate a
150-character snippet. For large mailboxes this is expensive: the server must download
the body of every message even when the caller only needs subject/sender/date to triage.

## Goal

Add a `headerOnly` boolean parameter to `list_emails` (default `false` for backward
compatibility). When `true`, the IMAP fetch omits `bodyParts: ['TEXT']`, returns only
envelope + flags, and sets `snippet` to an empty string. This makes bulk inbox scanning
significantly faster.

## Codebase Snapshot

### ImapClient.listMessages (src/protocol/imap.ts, line 77)

```ts
for await (const msg of this.client.fetch(range, {
  envelope: true, flags: true, internalDate: true, bodyParts: ['TEXT']
})) {
  const textBuf = (msg as any).bodyParts?.get('TEXT');
  const snippet = textBuf
    ? textBuf.toString('utf-8').replace(/\s+/g, ' ').slice(0, 200).trim()
    : '';
  // ...
}
```

Adding `headerOnly` means switching between:
- Normal: `{ envelope: true, flags: true, internalDate: true, bodyParts: ['TEXT'] }`
- Header-only: `{ envelope: true, flags: true, internalDate: true }` (no bodyParts)

### MailService.listEmails (src/services/mail.ts, line 68)

```ts
async listEmails(folder = 'INBOX', count = 10, offset = 0): Promise<MessageMetadata[]> {
  return this.imapClient.listMessages(folder, count, offset);
}
```

Needs `headerOnly` forwarded through.

### MCP tool: list_emails (src/index.ts, line 126)

Schema and dispatch must accept and forward `headerOnly`.

## Design Decisions

- `headerOnly` defaults to `false` — fully backward-compatible
- `snippet` is always `''` when `headerOnly=true`
- No new `MessageMetadata` fields needed; existing `snippet?: string` already optional
- `ImapClient.listMessages` signature change: add `headerOnly = false` as 5th param
- `MailService.listEmails` signature change: add `headerOnly = false` as 4th param
- MCP tool schema gets optional boolean field `headerOnly`

## Test Plan (TDD)

Unit tests mock `imapflow` fetch — verify:
1. `headerOnly=false` → fetch called with `bodyParts: ['TEXT']`, snippet populated
2. `headerOnly=true` → fetch called WITHOUT `bodyParts`, snippet is empty string
3. Backward compat: `listMessages(folder, count, offset)` (no 5th arg) works as before
