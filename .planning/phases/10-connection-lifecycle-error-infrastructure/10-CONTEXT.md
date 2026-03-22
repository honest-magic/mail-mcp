# Phase 10: Connection Lifecycle & Error Infrastructure - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Server starts and stops cleanly, account configs are validated before use, and all errors carry typed context. Covers CONN-01 (graceful shutdown), VAL-01 (Zod account validation), VAL-03 (SMTP port-aware TLS), VAL-04 (config caching), SAFE-02 (structured error types).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and codebase analysis:
- ImapFlow has no auto-reconnect; caller must manage lifecycle via `close` event
- `MailService.disconnect()` already exists in `src/services/mail.ts` — wire signal handlers in `src/index.ts`
- Zod is already installed and used in `src/config.ts` for env vars; extend to `EmailAccount` shape
- MCP domain errors must use `{ content, isError: true }` not `throw McpError` (H-14 pitfall)
- Port 465 = `secure: true`, Port 587 = `secure: false` (STARTTLS auto-upgrade by nodemailer)
- Config caching replaces synchronous `readFileSync` in `getAccounts()` with module-level cache + `fs.watch()`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MailService.disconnect()` in `src/services/mail.ts` (lines 30-33) — already disconnects IMAP and SMTP
- `MailMCPServer.services: Map<string, MailService>` in `src/index.ts` (line 26) — cached services to iterate on shutdown
- `getAccounts()` in `src/config.ts` (lines 34-54) — current sync file read to replace with cached version
- Zod imported in `src/config.ts` (line 1) — extend for account schema

### Established Patterns
- Error handling: `throw new Error('descriptive message')` propagated to MCP handler catch block
- MCP errors: `throw new McpError(ErrorCode.MethodNotFound, ...)` for protocol-level errors
- Tool errors: caught in try-catch, returned as `{ content: [{ type: 'text', text }], isError: true }`
- Lock management: `getMailboxLock(folder)` with finally-block release
- Module-level constants: `WRITE_TOOLS`, `ACCOUNTS_PATH`

### Integration Points
- `src/index.ts`: Signal handlers, error wrapping in tool dispatch, getService() for config access
- `src/config.ts`: Zod validation on load, caching layer
- `src/protocol/smtp.ts`: SmtpClient constructor for port-aware TLS derivation
- New `src/errors.ts`: Typed error classes consumed by all tool handlers

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
