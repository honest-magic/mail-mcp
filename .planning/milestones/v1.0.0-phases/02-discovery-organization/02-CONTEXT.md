# Phase 2: Discovery & Organization - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enables the AI to find and understand information, the precursor to advanced actions. Delivers advanced search, folder management, and basic threading.

</domain>

<decisions>
## Implementation Decisions

### Search Syntax & Dialects
- Provide a unified standard search interface (subject, from, since) with an optional raw query string.

### Label vs Folder Operations
- Provide two distinct tools: `move_message` and `modify_labels`.

### Return Output Size
- 10 messages by default, with a hard cap of 50.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/protocol/imap.ts` (ImapClient)
- `src/services/mail.ts` (MailService)

### Established Patterns
- Node.js ESM modules.
- MCP Tool registration in `src/index.ts`.

### Integration Points
- `src/index.ts` is the main MCP entry point where new tools (`search_messages`, `move_message`, `modify_labels`) will be registered.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
