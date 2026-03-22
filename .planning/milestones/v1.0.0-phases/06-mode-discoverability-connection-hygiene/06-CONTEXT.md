# Phase 6: Mode Discoverability & Connection Hygiene - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the final two read-only mode requirements: expose the server's active mode to MCP clients via the `instructions` field on `InitializeResult` (ROM-04), and skip SMTP authentication entirely when starting with `--read-only` (ROM-07). Changes span `src/index.ts` (instructions field) and `src/services/mail.ts` (SMTP skip).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are locked from Phase 5 decisions (STATE.md):

- **ROM-04 (Mode Discovery):** Pass `instructions` string in `Server` constructor options (`options.instructions`). The MCP SDK already supports this field and includes it in `InitializeResult`. Value: `"This server is running in read-only mode. Write operations (send_email, create_draft, move_email, modify_labels, batch_operations, register_oauth2_account) are disabled."` when read-only; omit when not read-only.
- **ROM-07 (SMTP Skip):** Modify `MailService` to accept `readOnly: boolean` (default false) and skip `smtpClient.connect()` in `connect()` when `readOnly === true`. Pass `this.readOnly` from `MailMCPServer.getService()` to `new MailService(account, this.readOnly)`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Server` constructor in `src/index.ts` already initialized with `name`, `version`, and `capabilities` — add `instructions` to the second arg options object
- `MailService.connect()` at `src/services/mail.ts:17` — add `readOnly` guard around `smtpClient.connect()`
- `getService()` in `src/index.ts:44` creates `new MailService(account)` — update to pass `readOnly`

### Established Patterns
- Server constructor options: `{ capabilities: { tools: {} } }` — extend to `{ capabilities: { tools: {} }, instructions: ... }`
- `this.readOnly` already stored on `MailMCPServer` as `private readonly`
- `MailService` constructor already takes `account: EmailAccount` — add optional second param

### Integration Points
- `src/index.ts:27–40` — Server constructor (add instructions option)
- `src/index.ts:44–57` — `getService()` (pass readOnly to MailService)
- `src/services/mail.ts:11–19` — MailService constructor + connect() (add readOnly param + SMTP skip)

</code_context>

<specifics>
## Specific Ideas

- Instructions message should be clear enough that an LLM reading it immediately understands which tools are blocked and what mode is active
- No instructions field should be set when NOT in read-only mode (avoid noise for normal usage)

</specifics>

<deferred>
## Deferred Ideas

- ROM-08 (IMAP EXAMINE in read-only mode) → v2 deferred per prior decision
- None — discussion stayed within phase scope

</deferred>
