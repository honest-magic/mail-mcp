# Phase 27: Delete Email Tool — Context

## Problem

The current toolset has no single-message delete tool. Users can delete via
`batch_operations` with `action: "delete"` and a one-element `uids` array, but
that is verbose and unintuitive for the common case of deleting one email.
There is no direct `delete_email` tool.

## Existing Infrastructure

- `ImapClient.batchDeleteMessages(uids: string[], folder: string)` — already
  wraps `messageDelete` with UID mode. A single-message delete is just a
  one-element call.
- `MailService.invalidateBodyCache(folder, uid)` — used by `move_email` after
  moving a message; same cleanup needed after deletion.
- `WRITE_TOOLS` set in `src/index.ts` — controls read-only gating.
- Tool definitions and handlers follow a consistent pattern: tool definition in
  `getTools()`, handler in `dispatchTool()` / `CallToolRequestSchema` handler.

## Decision

Add a `deleteMessage(uid, folder)` method to `ImapClient` that calls
`batchDeleteMessages([uid], folder)`. This keeps the public surface area clean
and testable without duplicating IMAP logic.

In `MailService`, add `deleteEmail(uid, folder)` that:
1. Calls `this.imap.deleteMessage(uid, folder)`
2. Calls `this.invalidateBodyCache(folder, uid)`

In `src/index.ts`:
- Add `'delete_email'` to `WRITE_TOOLS`
- Add tool definition (readOnlyHint: false, destructiveHint: true)
- Add handler branch

## Key Design Choices

- `deleteMessage` on `ImapClient` takes `uid: string` (matches existing single-
  message methods like `moveMessage`).
- Body cache invalidated on delete (consistent with move_email pattern).
- Read-only mode blocks the tool (consistent with all destructive tools).
- Success message: `"Email ${uid} deleted from ${folder}."`
