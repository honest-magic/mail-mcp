# Phase 1: Secure Connectivity & Basic Messaging - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishes secure access and basic communication before building complex logic. Delivers secure credential storage (Keychain), IMAP connection, basic listing, and "Safe" SMTP (with IMAP `APPEND`).

</domain>

<decisions>
## Implementation Decisions

### Error Handling & Resilience
- Yes, implement automatic retries with backoff — Mail servers frequently drop idle connections.
- Return clear MCP tool error asking user to update credentials — Actionable for the agent.

### Markdown Sanitization
- Convert to base64 data URIs.
- Yes, flatten complex HTML structures (tables, nested quotes) for better LLM readability — Prioritizes content over visual layout.

### Default "Send" Behavior
- Rely on agent prompt to use `create_draft` first — Follows standard MCP tool atomicity.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`, `tsconfig.json`, `vitest.config.ts` established.
- Initial project structure created (`src/types`, `src/security`, `src/protocol`, `src/services`, `src/utils`).

### Established Patterns
- Node.js ESM modules.
- TypeScript strict mode.
- `vitest` for testing.

### Integration Points
- `src/index.ts` is the main MCP entry point.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
