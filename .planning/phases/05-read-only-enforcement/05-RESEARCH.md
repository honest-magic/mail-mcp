# Phase 5: Read-Only Enforcement - Research

**Researched:** 2026-03-21
**Domain:** MCP Dispatch Layer — Startup Flag Parsing, Tool Filtering, Write Guard, Tool Annotations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error Response & Classification**
- Write tool blocking uses `{ content: [{ type: 'text', text: '...' }], isError: true }` structured response — matches codebase's existing error shape and is more LLM-friendly than throwing a McpError exception
- `list_accounts` is a **read tool** — it only reads keychain config, no mutations; it stays visible in read-only mode
- Full error message format: `"Tool '{name}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations."`
- Unknown flags alongside `--read-only` are handled leniently — warn to stderr and continue

**Tool Annotations**
- **Write tools** get: `readOnlyHint: false`, `destructiveHint: true`
- **Read tools** get: `readOnlyHint: true`, `destructiveHint: false`
- `idempotentHint` and `openWorldHint` are NOT added — only annotate what's directly useful
- All 14 tools are annotated for consistency (not just write tools)

**Flag & Enforcement Pattern**
- Flag name: `--read-only` (hyphenated, matches research/STATE.md decisions)
- Parsed via `util.parseArgs` (Node 20 built-in — zero new dependencies)
- Stored as `private readonly readOnly: boolean` on `MailMCPServer` constructor
- `WRITE_TOOLS` defined as a module-level `Set<string>` covering all 6 write tools: `send_email`, `create_draft`, `move_email`, `modify_labels`, `register_oauth2_account`, `batch_operations`
- Write tools filtered from `ListToolsRequestSchema` response when `readOnly === true`
- Guard placed at the TOP of `CallToolRequestSchema` handler (before all existing if-chain)

### Claude's Discretion
- Order of tool annotations within each tool definition object
- Exact TypeScript type annotation on the WRITE_TOOLS Set

### Deferred Ideas (OUT OF SCOPE)
- ROM-04 (instructions field at MCP handshake) — Phase 6
- ROM-07 (SMTP connection skip) — Phase 6
- IMAP EXAMINE mode (ROM-08) — v2 deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROM-01 | User can start the server with a `--read-only` flag to restrict it to read operations only | `util.parseArgs` verified in Node 20.19.0 — `parseArgs({args: process.argv.slice(2), options: {'read-only': {type: 'boolean'}}})` returns `{ values: { 'read-only': true } }` |
| ROM-02 | In read-only mode, write tools return a descriptive refusal error naming the blocked tool and active mode | Guard pattern: `if (this.readOnly && WRITE_TOOLS.has(name)) return { content: [...], isError: true }` at top of CallToolRequestSchema handler |
| ROM-03 | In read-only mode, all read and search tools function normally without modification | Inherently satisfied by the guard — no changes needed to read tool handlers; confirmed by reading the full if-chain in `src/index.ts` |
| ROM-05 | Write tools are filtered out of the `tools/list` response when the server is in read-only mode | `ListToolsRequestSchema` handler returns `tools.filter(t => !this.readOnly \|\| !WRITE_TOOLS.has(t.name))` |
| ROM-06 | All 14 tools declare `readOnlyHint` and `destructiveHint` MCP tool annotations | `ToolAnnotationsSchema` verified in installed SDK — `annotations: { readOnlyHint: boolean, destructiveHint: boolean }` is an optional sub-object on each tool definition |
</phase_requirements>

## Summary

Phase 5 is a narrow, well-understood change confined entirely to `src/index.ts`. The codebase, SDK, and Node.js runtime already provide every mechanism needed — zero new dependencies are required. The deliverables are: (1) parse `--read-only` from `process.argv` using `util.parseArgs`, (2) store the flag as `private readonly readOnly: boolean` on `MailMCPServer`, (3) define a module-level `WRITE_TOOLS` Set covering all 6 write tools, (4) add an early-return guard at the top of the `CallToolRequestSchema` handler, (5) filter write tools from the `ListToolsRequestSchema` response, and (6) add `annotations: { readOnlyHint, destructiveHint }` to all 14 tool definitions.

The existing dispatch pattern — a flat if-chain starting at line 255 of `src/index.ts` — makes guard insertion straightforward: one `Set.has()` check before the first `if` branch covers all 6 write tools at once. The SDK's `ToolAnnotationsSchema` (verified in `node_modules/@modelcontextprotocol/sdk/dist/cjs/types.d.ts`) shows annotations as an optional sub-object on each tool, accepting `readOnlyHint` and `destructiveHint` as optional booleans.

The primary risk is write-tool enumeration drift — `modify_labels`, `batch_operations`, and `register_oauth2_account` are easy to forget because they are less obviously "writes" than `send_email`. Defining `WRITE_TOOLS` as the very first implementation artifact (before touching any handler) and cross-checking it against the `CallToolRequestSchema` if-chain eliminates this risk.

**Primary recommendation:** Implement in one task: define `WRITE_TOOLS`, add `readOnly` constructor parameter, add call-time guard, add list-time filter, add annotations to all 14 tools. All changes are in `src/index.ts`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `^1.27.1` (installed) | MCP server, tool schema, `ToolAnnotationsSchema` | Already installed; `ToolAnnotationsSchema` confirmed in `.d.ts` |
| Node.js `util.parseArgs` | Built into Node 20.19.0 | CLI flag parsing | Zero dependencies; stable API since Node 18.3; verified locally |

### No New Dependencies
All mechanisms are already available. This phase adds no entries to `package.json`.

**Installation:** None required.

**Version verification:** Verified against installed packages — `@modelcontextprotocol/sdk` is present in `node_modules/`, `util.parseArgs` confirmed working in Node 20.19.0 local runtime.

## Architecture Patterns

### Recommended Project Structure
No new files. All changes in `src/index.ts`.

```
src/
└── index.ts   # All Phase 5 changes (flag parsing, WRITE_TOOLS, guard, filter, annotations)
```

### Pattern 1: Module-Level WRITE_TOOLS Constant

**What:** A `Set<string>` defined at module scope (outside the class), before the class definition, listing all 6 write tool names.

**When to use:** Single source of truth for both the call-time guard and the list-time filter. Module-level scope makes it grep-able and visible in code review.

**Example:**
```typescript
// Source: CONTEXT.md locked decisions + src/index.ts tool name audit
const WRITE_TOOLS = new Set<string>([
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'register_oauth2_account',
  'batch_operations',
]);
```

### Pattern 2: Constructor Parameter for readOnly Flag

**What:** Parse flag in the `run()` function / module bottom, pass to constructor, store as `private readonly`.

**When to use:** Immutable flag; TypeScript enforces no reassignment.

**Example:**
```typescript
// Source: CONTEXT.md locked decisions + Node 20 util.parseArgs API
import { parseArgs } from 'node:util';

// At module bottom (replacing current instantiation):
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { 'read-only': { type: 'boolean', default: false } },
  strict: false,  // lenient: warn on unknown flags, continue
});
const server = new MailMCPServer(values['read-only'] ?? false);
server.run().catch(console.error);

// In class constructor signature:
constructor(private readonly readOnly: boolean = false) { ... }
```

**Note on `strict: false`:** The CONTEXT.md decision is to warn to stderr and continue on unknown flags. `parseArgs` with `strict: false` silently ignores unrecognized flags. To emit a warning, catch the error from `strict: true` mode or post-process `positionals` — but the simplest approach matching the intent is `strict: false` (no crash) while optionally logging unrecognized tokens.

### Pattern 3: Call-Time Write Guard (Defense-in-Depth)

**What:** Early-return check at the very top of the `CallToolRequestSchema` try block, before the first `if (request.params.name === ...)`.

**When to use:** Catches any write tool call regardless of what `tools/list` returned. Guards against clients that cached the tool list before mode changed (not possible here since mode is immutable, but good practice).

**Example:**
```typescript
// Source: CONTEXT.md locked decisions + src/index.ts line 255 dispatch pattern
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;

    if (this.readOnly && WRITE_TOOLS.has(toolName)) {
      return {
        content: [{
          type: 'text',
          text: `Tool '${toolName}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`,
        }],
        isError: true,
      };
    }

    if (request.params.name === 'list_accounts') {
      // ... existing chain unchanged
```

### Pattern 4: List-Time Write Tool Filtering

**What:** Wrap the `tools: [...]` array return with a filter when `readOnly === true`.

**When to use:** Prevents LLMs from planning actions that will be refused at call time.

**Example:**
```typescript
// Source: CONTEXT.md locked decisions + src/index.ts line 51 ListToolsRequestSchema handler
this.server.setRequestHandler(ListToolsRequestSchema, async () => {
  const allTools = [ /* existing 14 tool definitions, unchanged */ ];
  return {
    tools: this.readOnly
      ? allTools.filter(t => !WRITE_TOOLS.has(t.name))
      : allTools,
  };
});
```

### Pattern 5: Tool Annotations on All 14 Tool Definitions

**What:** Add an `annotations` sub-object to each tool in the `tools` array. Write tools get `readOnlyHint: false, destructiveHint: true`. Read tools get `readOnlyHint: true, destructiveHint: false`.

**When to use:** Annotations are mode-independent — they describe the tool's intrinsic nature, not the current mode. Add to all 14 tools for consistency.

**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/cjs/types.d.ts — ToolAnnotationsSchema
{
  name: 'send_email',
  description: 'Send an email and save it to the Sent folder',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  inputSchema: { /* unchanged */ },
},
{
  name: 'list_emails',
  description: 'List recent emails from a specific folder',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  },
  inputSchema: { /* unchanged */ },
},
```

### Tool Classification Reference

| Tool Name | Read/Write | readOnlyHint | destructiveHint |
|-----------|-----------|--------------|-----------------|
| `list_accounts` | Read | `true` | `false` |
| `list_emails` | Read | `true` | `false` |
| `search_emails` | Read | `true` | `false` |
| `read_email` | Read | `true` | `false` |
| `list_folders` | Read | `true` | `false` |
| `get_thread` | Read | `true` | `false` |
| `get_attachment` | Read | `true` | `false` |
| `extract_attachment_text` | Read | `true` | `false` |
| `send_email` | Write | `false` | `true` |
| `create_draft` | Write | `false` | `true` |
| `move_email` | Write | `false` | `true` |
| `modify_labels` | Write | `false` | `true` |
| `register_oauth2_account` | Write | `false` | `true` |
| `batch_operations` | Write | `false` | `true` |

### Anti-Patterns to Avoid

- **Scattered per-branch guards:** Placing read-only checks inside each individual `if (name === 'send_email')` branch. The single top-of-handler guard is less error-prone and easier to audit.
- **Module-level `let` for the flag:** Creates mutation risk. Use constructor injection + `private readonly`.
- **Generic error without tool name:** `"Server is in read-only mode"` causes LLM retry loops. The message must interpolate the blocked tool name.
- **Silent no-op on write tools:** Returning success without an error makes the LLM believe the write succeeded. Always `isError: true`.
- **Filtering list but not guarding calls:** List filtering alone is insufficient; call-time guard is required for defense-in-depth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI flag parsing | Custom `process.argv` string scanning | `util.parseArgs` (Node built-in) | Handles `--flag`, `--flag=value`, boolean types, lenient mode — 3 lines vs 20 |
| Write tool enumeration | Logic derived from tool descriptions or regex | Explicit `WRITE_TOOLS = new Set([...])` constant | No inference; auditable; grep-able; impossible to accidentally miss a tool |

**Key insight:** The entire feature fits in one file with no new dependencies. The complexity of read-only enforcement is in correctness of enumeration, not in engineering.

## Common Pitfalls

### Pitfall 1: Incomplete WRITE_TOOLS Enumeration

**What goes wrong:** `modify_labels` and `register_oauth2_account` are omitted from the write set. `batch_operations` is sometimes overlooked because it proxies other operations. The server passes functional tests for `send_email` / `create_draft` but silently allows IMAP flag mutations and keychain writes.

**Why it happens:** Developers mentally model "writes" as sending mail. IMAP flag mutations (`\Seen`, `\Flagged`) and keychain writes are less salient.

**How to avoid:** Define `WRITE_TOOLS` first, before writing any guard code. Cross-check the Set members against every `if (request.params.name === ...)` branch in `CallToolRequestSchema` — there should be exactly 6 branches covered by the Set (send_email, create_draft, move_email, modify_labels, register_oauth2_account, batch_operations) and 8 not covered.

**Warning signs:** Test that explicitly calls `modify_labels` in read-only mode returns `isError: false`.

### Pitfall 2: LLM Retry Loops from Non-Informative Error Messages

**What goes wrong:** Error message is `"read-only mode"` without naming the blocked tool. The LLM retries with slight variations (different account, different parameters) expecting one to succeed.

**Why it happens:** Generic error messages are faster to write.

**How to avoid:** The exact message is locked in CONTEXT.md: `"Tool '${toolName}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations."` Use string interpolation with the actual tool name.

**Warning signs:** LLM calling the same write tool twice in a session.

### Pitfall 3: process.argv Slice Index

**What goes wrong:** `parseArgs({args: process.argv})` includes `node` and the script path as positionals, causing a parse error or misidentifying them as flags.

**Why it happens:** `process.argv[0]` is the Node executable, `process.argv[1]` is the script path.

**How to avoid:** Always `process.argv.slice(2)`. Verified with local runtime test — `parseArgs({args: ['--read-only'], options: {'read-only': {type: 'boolean'}}})` returns `{ values: { 'read-only': true } }`.

**Warning signs:** `parseArgs` throwing `TypeError: Not an option flag` for `node` or the script filename.

### Pitfall 4: Annotations Placement in Tool Definition Object

**What goes wrong:** `annotations` placed inside `inputSchema` instead of as a sibling of `inputSchema`. The SDK strips the field silently (Zod `.strip()`).

**Why it happens:** `inputSchema` is the largest sub-object; easy to accidentally nest inside it.

**How to avoid:** Follow `ToolSchema` structure from SDK types: `{ name, description, annotations, inputSchema, ... }`. The `annotations` key is a direct sibling of `inputSchema`, not nested within it.

**Warning signs:** `tools/list` response contains tool definitions without `annotations` field even after adding them.

## Code Examples

Verified patterns from official sources:

### util.parseArgs — Verified in Node 20.19.0

```typescript
// Source: Node 20.19.0 local runtime (verified 2026-03-21)
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'read-only': { type: 'boolean', default: false },
  },
  strict: false,  // unknown flags: silent ignore (warn to stderr if desired)
});

const readOnly = values['read-only'] ?? false;
```

### ToolAnnotationsSchema — Verified in SDK .d.ts

```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/cjs/types.d.ts
// ToolAnnotationsSchema fields (all optional):
//   title?: string
//   readOnlyHint?: boolean
//   destructiveHint?: boolean
//   idempotentHint?: boolean    (NOT used in Phase 5 per CONTEXT.md)
//   openWorldHint?: boolean     (NOT used in Phase 5 per CONTEXT.md)

// Usage in tool definition:
{
  name: 'list_emails',
  description: '...',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  },
  inputSchema: { type: 'object', properties: { ... } },
}
```

### Full Dispatch Handler Skeleton After Phase 5

```typescript
// Source: src/index.ts existing pattern + CONTEXT.md decisions
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;

    // Phase 5: read-only guard (TOP of handler — before existing if-chain)
    if (this.readOnly && WRITE_TOOLS.has(toolName)) {
      return {
        content: [{
          type: 'text',
          text: `Tool '${toolName}' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations.`,
        }],
        isError: true,
      };
    }

    // Existing if-chain follows unchanged:
    if (request.params.name === 'list_accounts') { ... }
    if (request.params.name === 'list_emails') { ... }
    // ... etc.
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `minimist` / `yargs` for flag parsing | `util.parseArgs` (Node built-in) | Node 18.3 stable | Zero dependencies for single boolean flags |
| MCP tool metadata via description text | `ToolAnnotationsSchema` (`readOnlyHint`, `destructiveHint`) | MCP SDK 1.x | Structured, machine-readable safety metadata |

**Deprecated/outdated:**
- `process.argv` manual parsing with `indexOf('--read-only')`: Works but non-standard; misses `--read-only=false` variants. Use `util.parseArgs` instead.

## Open Questions

1. **Lenient unknown-flag behavior implementation detail**
   - What we know: CONTEXT.md says warn to stderr and continue. `strict: false` on `parseArgs` silently ignores unknowns.
   - What's unclear: Whether a `console.error` warning on unrecognized tokens is needed, or whether `strict: false` silence is sufficient.
   - Recommendation: Use `strict: false` for simplicity. The intent is "don't crash on unknown flags" — silent ignore satisfies this. If warning is desired, wrap in try/catch with `strict: true` and log caught errors before falling back.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) — `include: ['src/**/*.test.ts']`, `environment: 'node'` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROM-01 | Server starts without `--read-only` flag; `readOnly` defaults to `false` | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-01 | Server starts with `--read-only` flag; `readOnly` is `true` | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-02 | `send_email` in read-only mode returns `isError: true` with correct message | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-02 | All 6 write tools return `isError: true` in read-only mode | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-03 | `list_emails` in read-only mode returns normal (non-error) response | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-05 | `tools/list` in read-only mode excludes all 6 write tools | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-05 | `tools/list` in normal mode includes all 14 tools | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-06 | All 14 tools have `annotations.readOnlyHint` defined | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-06 | All 14 tools have `annotations.destructiveHint` defined | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |
| ROM-06 | Write tools have `destructiveHint: true`, read tools have `destructiveHint: false` | unit | `npx vitest run src/index.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/index.test.ts` — covers ROM-01, ROM-02, ROM-03, ROM-05, ROM-06

**Testing strategy note:** `src/index.ts` uses a class-based pattern where `MailMCPServer` constructs an MCP `Server` internally. Unit tests for the dispatch logic should instantiate `MailMCPServer` directly (with `readOnly: true` or `false`) and invoke its internal handler via the `Server`'s request dispatch, or by extracting the handler into a testable helper. The existing `src/sanity.test.ts` confirms Vitest is configured and the `globals: true` setting provides `describe`/`it`/`expect` without imports.

## Sources

### Primary (HIGH confidence)
- `src/index.ts` — full 14-tool list, dispatch if-chain structure, error response shape, constructor, `run()` function
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/types.d.ts` — `ToolAnnotationsSchema` with `readOnlyHint`, `destructiveHint` as optional booleans; `ToolSchema` with `annotations` as sibling of `inputSchema`
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.d.ts` — `ServerOptions.instructions?: string` (Phase 6 concern, confirmed available)
- Node 20.19.0 local runtime — `util.parseArgs` with `--read-only` flag verified working: `{ values: { 'read-only': true } }`
- `vitest.config.ts` — `include: ['src/**/*.test.ts']`, `environment: 'node'`, `globals: true`
- `.planning/phases/05-read-only-enforcement/05-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- MCP Specification (https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tool annotations semantics (`readOnlyHint`, `destructiveHint` described as hints, not enforced by clients)

### Tertiary (LOW confidence)
- None for Phase 5 scope

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technologies verified against installed packages and local Node runtime
- Architecture: HIGH — based on direct reading of `src/index.ts`; no external inference needed
- Pitfalls: HIGH — derived from actual codebase tool list and SDK type inspection
- Validation: HIGH — Vitest config confirmed, test gap is known and documented

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (stable domain — MCP SDK and Node built-ins do not change frequently)
