# Phase 4: Efficiency & Scale - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Focuses on efficiency and high-volume tasks once the foundation is rock-solid. Delivers batch operations for performance.

</domain>

<decisions>
## Implementation Decisions

### Batch Action Syntax
- Accept an array of `uid`s and a single action (e.g. "move", "addLabel").

### Batch Operation Limits
- 100 emails to prevent timeouts and mass data loss.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/protocol/imap.ts` (ImapClient uses UID lists in some operations already)
- `src/services/mail.ts`

### Established Patterns
- MCP Tools with JSON input.

### Integration Points
- `src/index.ts` where `batch_operations` tool will be registered.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
