# Phase 22 Context: Mailbox Stats

## Problem

There is no tool to get a quick at-a-glance view of mailbox health — unread counts, total messages, and recent activity per folder — without listing individual emails. This forces the LLM to call `list_emails` or `search_emails` to estimate volume, which is slow and wastes tokens.

## Solution

Add a `mailbox_stats` tool that issues the IMAP `STATUS` command for each requested folder and returns structured counts. ImapFlow exposes `client.status(path, { messages, unseen, recent })` which maps directly onto IMAP STATUS.

## Key Observations

### ImapFlow `status()` API

```ts
const info = await client.status('INBOX', {
  messages: true,   // total messages
  unseen: true,     // unread count
  recent: true,     // recent (newly arrived since last IMAP session)
});
// info.messages, info.unseen, info.recent
```

Critically: STATUS does **not** require selecting (locking) the mailbox — it works on any folder without a lock. This makes it safe and non-blocking.

### Folder Discovery

When no folders are provided, we call `listFolders()` (Phase 9 IMAP LIST) and run STATUS on all of them.

### Output Shape

Per folder:

```json
{
  "name": "INBOX",
  "total": 1024,
  "unread": 5,
  "recent": 2
}
```

Formatted as a human-readable table in the tool response (also JSON-parseable).

## Architecture Decisions

- **D-01**: `getMailboxStatus()` lives on `ImapClient` — consistent with other IMAP primitives.
- **D-02**: `MailService.getMailboxStats()` wraps it for service-layer consistency, accepts optional `folders` array.
- **D-03**: The tool handler in `src/index.ts` calls service method; no direct IMAP client access from the handler.
- **D-04**: STATUS is parallelized with `Promise.all()` across folders for performance.
- **D-05**: Failures on individual folders (e.g., folder deleted mid-query) are caught and reported as `null` counts with an error string — the tool does not fail entirely.

## Testing Approach

- Unit tests mock `client.status()` on the `ImapFlow` mock in `src/protocol/imap.test.ts`.
- `MailService` tests mock `ImapClient.getMailboxStatus()`.
- `MailMCPServer.dispatchTool` tested via existing `src/index.test.ts` patterns.
- TDD: write failing tests first, then implement.

## Files to Modify

1. `src/protocol/imap.ts` — add `MailboxStatus` interface + `getMailboxStatus()` method
2. `src/services/mail.ts` — add `getMailboxStats()` method
3. `src/index.ts` — add `mailbox_stats` tool definition + dispatch handler
4. `src/protocol/imap.test.ts` — add `status` mock + tests
5. `src/services/mail.test.ts` — add stats method tests
6. `src/index.test.ts` — add `mailbox_stats` dispatch tests
