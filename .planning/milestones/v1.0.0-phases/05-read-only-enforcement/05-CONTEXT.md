# Phase 5: Read-Only Enforcement - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the core read-only mode enforcement: parse a `--read-only` startup flag, block all 6 write tools at both list-time and call-time, and add MCP tool annotations to all 14 tools. All changes are confined to `src/index.ts`. The service layer is not touched.

</domain>

<decisions>
## Implementation Decisions

### Error Response & Classification

- Write tool blocking uses `{ content: [{ type: 'text', text: '...' }], isError: true }` structured response — matches codebase's existing error shape and is more LLM-friendly than throwing a McpError exception
- `list_accounts` is a **read tool** — it only reads keychain config, no mutations; it stays visible in read-only mode
- Full error message format: `"Tool '{name}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations."`
- Unknown flags alongside `--read-only` are handled leniently — warn to stderr and continue

### Tool Annotations

- **Write tools** get: `readOnlyHint: false`, `destructiveHint: true`
- **Read tools** get: `readOnlyHint: true`, `destructiveHint: false`
- `idempotentHint` and `openWorldHint` are NOT added — only annotate what's directly useful
- All 14 tools are annotated for consistency (not just write tools)

### Flag & Enforcement Pattern

- Flag name: `--read-only` (hyphenated, matches research/STATE.md decisions)
- Parsed via `util.parseArgs` (Node 20 built-in — zero new dependencies)
- Stored as `private readonly readOnly: boolean` on `MailMCPServer` constructor
- `WRITE_TOOLS` defined as a module-level `Set<string>` covering all 6 write tools:
  `send_email`, `create_draft`, `move_email`, `modify_labels`, `register_oauth2_account`, `batch_operations`
- Write tools filtered from `ListToolsRequestSchema` response when `readOnly === true`
- Guard placed at the TOP of `CallToolRequestSchema` handler (before all existing if-chain)

### Claude's Discretion

- Order of tool annotations within each tool definition object
- Exact TypeScript type annotation on the WRITE_TOOLS Set

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `McpError` and `ErrorCode` already imported in `src/index.ts` (available if needed for future)
- All 14 tool names already defined in `ListToolsRequestSchema` handler (lines 52–252)
- `CallToolRequestSchema` handler starts at line 255 with `try { if (request.params.name === 'list_accounts')...`

### Established Patterns
- Error responses use `{ content: [{ type: 'text', text: errorMessage }], isError: true }` shape — consistent throughout `src/index.ts`
- Tools are registered in a single `tools: [...]` array in `ListToolsRequestSchema` handler
- Tool dispatch is a flat if-chain in `CallToolRequestSchema`

### Integration Points
- `MailMCPServer` constructor (line 17) — add `readOnly: boolean` parameter and store as `private readonly`
- `setupToolHandlers()` (line 50) — add `WRITE_TOOLS` check at top of `CallToolRequestSchema`, filter in `ListToolsRequestSchema`
- `run()` function (bottom of file) — parse `--read-only` from `process.argv` and pass to constructor

</code_context>

<specifics>
## Specific Ideas

- Define `WRITE_TOOLS` as a module-level constant (outside the class) for maximum greppability
- The exact refusal message should include the tool name interpolated: `Tool '${toolName}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`

</specifics>

<deferred>
## Deferred Ideas

- ROM-04 (instructions field at MCP handshake) → Phase 6
- ROM-07 (SMTP connection skip) → Phase 6
- IMAP EXAMINE mode (ROM-08) → v2 deferred

</deferred>
