# Phase 26 Context: Mark Read/Star Tools

## User Vision

AI agents currently need to know IMAP flag syntax (`\\Seen`, `\\Flagged`) to mark emails.
This phase adds four semantic, human-readable tools that hide that complexity:

- `mark_read` — mark an email as read
- `mark_unread` — mark an email as unread
- `star` — star/flag an email
- `unstar` — remove the star/flag from an email

Each tool is a thin wrapper around the existing `modifyLabels` call.

## Key Implementation Decisions

- All four tools call `service.modifyLabels()` under the hood
- `mark_read`:  `addLabels=['\\Seen']`,    `removeLabels=[]`
- `mark_unread`: `addLabels=[]`,           `removeLabels=['\\Seen']`
- `star`:       `addLabels=['\\Flagged']`, `removeLabels=[]`
- `unstar`:     `addLabels=[]`,            `removeLabels=['\\Flagged']`
- All take: `accountId` (required), `uid` (required), `folder` (optional, default INBOX)
- All are write tools: `readOnlyHint: false, destructiveHint: true`
- All blocked in read-only mode (added to `WRITE_TOOLS` set)
- No new service methods needed — `service.modifyLabels()` already exists

## Files to Modify

- `src/index.ts` — add 4 tool definitions + 4 dispatch handlers + update WRITE_TOOLS set
- `src/index.test.ts` — add tests (TDD: RED then GREEN)
