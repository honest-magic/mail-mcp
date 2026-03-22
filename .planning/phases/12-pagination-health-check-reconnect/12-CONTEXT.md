# Phase 12: Pagination, Health Check & Reconnect - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can navigate large mailboxes, validate credentials at startup, and the server recovers automatically from dropped connections. Covers QUAL-01 (pagination), CONN-02 (reconnect on drop), CONN-03 (health check CLI).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and prior phases:
- Pagination: Add optional `offset` parameter to `list_emails` and `search_emails` tool schemas. ImapFlow `fetch()` is an async generator — pagination is a range slice over sorted UIDs.
- Health check: `--validate-accounts` CLI flag probes IMAP CAPABILITY + SMTP EHLO per account. Uses existing `handleAccountsCommand()` pattern in `src/cli/accounts.ts`.
- Reconnect: ImapFlow emits `close` event on connection drop (no auto-reconnect). Add close listener that invalidates cached `MailService` in `MailMCPServer.services`. Next tool call triggers fresh service creation with one retry attempt and exponential backoff.
- Use `NetworkError` from `src/errors.ts` when reconnect fails.
- Existing `getAccounts()` is now async with caching (Phase 10).
- All tool dispatch now has rate limiting, email validation, and typed error handling (Phases 10-11).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/errors.ts` — `NetworkError` for reconnect failures
- `src/protocol/imap.ts` — `ImapClient` with `client.usable` guard (Phase 10)
- `src/index.ts` — `MailMCPServer.services: Map<string, MailService>` for cache invalidation
- `src/cli/accounts.ts` — `handleAccountsCommand()` for CLI flag handling
- `nodemailer.verify()` for SMTP health check

### Established Patterns
- Tool schema changes: add optional params to `inputSchema.properties` in `getTools()`
- IMAP UID range slicing: `listMessages()` already computes tail ranges
- CLI flags: `parseArgs()` in `src/index.ts main()`

### Integration Points
- `src/index.ts`: Tool schemas for `list_emails`/`search_emails` offset param, `--validate-accounts` flag
- `src/protocol/imap.ts`: Pagination in `listMessages()`/`searchMessages()`, close event listener
- `src/services/mail.ts`: Pass offset through to ImapClient methods
- `src/cli/accounts.ts` or `src/index.ts`: Health check implementation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
