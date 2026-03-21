# Technology Stack

**Project:** Mail MCP — Read-Only Mode (v1.1)
**Researched:** 2026-03-21
**Scope:** Stack additions/changes for `--read-only` startup flag and per-tool access control

---

## Finding: Zero New Dependencies Required

All four ROM requirements are satisfiable with tools already present in the project. No `npm install` needed.

---

## Existing Stack (unchanged)

| Technology | Version (installed) | Purpose |
|------------|--------------------|---------|
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP server, tool registration, resources API |
| `zod` | `^4.3.6` | Schema validation (already used throughout) |
| Node.js built-in `util.parseArgs` | Node 20 (stable since 18.3) | CLI flag parsing |

---

## How to Satisfy Each Requirement

### ROM-01: `--read-only` startup flag

**Mechanism:** `util.parseArgs` from Node.js built-in `util` module.

Node 20 ships `parseArgs` as a stable API (graduated from experimental in Node 18.11). The project already runs on Node 20.19.0 (confirmed). No new package.

```typescript
import { parseArgs } from 'util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'read-only': { type: 'boolean', default: false },
  },
  strict: false, // ignore unknown flags gracefully
});

const isReadOnly: boolean = values['read-only'] ?? false;
```

Pass `isReadOnly` into `MailMCPServer` constructor. Store as `private readonly readOnly: boolean`.

**Why not `minimist`, `commander`, or `yargs`:**
- This feature needs exactly one boolean flag. A full CLI library is overkill and adds dependency surface.
- `util.parseArgs` is the Node.js-endorsed replacement for ad-hoc `process.argv` parsing.
- Confidence: HIGH — verified against Node 20 runtime in this repo.

---

### ROM-02: Write tools return clear refusal in read-only mode

**Mechanism:** Guard check at the top of the `CallToolRequestSchema` handler, using the existing `McpError` / `ErrorCode` pattern already in `src/index.ts`.

The write tools in the current codebase are:

| Tool name | Write operation |
|-----------|----------------|
| `send_email` | SMTP send + IMAP append |
| `create_draft` | IMAP append to Drafts |
| `move_email` | IMAP move |
| `modify_labels` | IMAP store (flag mutation) |
| `batch_operations` | IMAP move/delete/store |
| `register_oauth2_account` | Keychain write |

All six must be blocked. The guard pattern:

```typescript
const WRITE_TOOLS = new Set([
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'batch_operations',
  'register_oauth2_account',
]);

// Inside CallToolRequestSchema handler, before any tool dispatch:
if (this.readOnly && WRITE_TOOLS.has(request.params.name)) {
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Tool '${request.params.name}' is not available in read-only mode.`
  );
}
```

`McpError` and `ErrorCode` are already imported in `src/index.ts`. No new imports required.

**Error code choice:** `ErrorCode.InvalidRequest` (MCP code `-32600`) is the correct choice — the request is well-formed but semantically refused. `ErrorCode.MethodNotFound` would be misleading because the tool does exist.

---

### ROM-03: Read tools function normally in read-only mode

No code change needed for read tools. The guard in ROM-02 only checks `WRITE_TOOLS`; all other tools pass through unchanged.

---

### ROM-04: Server exposes its current mode

**Mechanism:** MCP Resources API — `ListResourcesRequestSchema` + `ReadResourceRequestSchema` from `@modelcontextprotocol/sdk/types.js` (already in the installed SDK at `^1.27.1`).

Expose a single resource at URI `server://config/mode` with JSON content describing the current mode.

```typescript
// In Server constructor options, add resources capability:
capabilities: {
  tools: {},
  resources: {},  // enables resources/list and resources/read
}

// Register handlers:
this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'server://config/mode',
      name: 'Server Mode',
      description: 'Current operating mode of the mail MCP server',
      mimeType: 'application/json',
    },
  ],
}));

this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri !== 'server://config/mode') {
    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${request.params.uri}`);
  }
  return {
    contents: [
      {
        uri: 'server://config/mode',
        mimeType: 'application/json',
        text: JSON.stringify({ mode: this.readOnly ? 'read-only' : 'read-write' }),
      },
    ],
  };
});
```

New imports needed from the SDK (both types are already in the installed package):

```typescript
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
```

**Why a resource not a tool:** MCP Resources represent server state that clients can inspect and subscribe to. Mode is server configuration, not an action. Using a tool (`get_mode`) would work but violates MCP semantics — tools are for operations, resources are for state. The `resources` capability tells clients the server has inspectable state.

**Why not `server.instructions`:** The `ServerOptions.instructions` field exists but is a plain string in the `initialize` handshake. It is set once at construction time and not re-readable. A resource is readable on demand and subscribable.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI parsing | `util.parseArgs` (built-in) | `commander@^12` | Unnecessary dependency for a single boolean flag |
| CLI parsing | `util.parseArgs` (built-in) | `minimist@^1` | Unmaintained, no TypeScript types, adds dep surface |
| CLI parsing | `util.parseArgs` (built-in) | Manual `process.argv.includes` | Works, but `parseArgs` handles edge cases (`--read-only=true`, combined flags) and is idiomatic Node 20 |
| Mode exposure | MCP Resource (`resources/read`) | Dedicated `get_mode` tool | Tools are for actions; resources are for server state — resource is the correct MCP primitive |
| Mode exposure | MCP Resource | Tool description text | Not machine-readable; client cannot reliably parse free text |
| Write guard | `if`-check in handler | Per-tool method wrappers | Unnecessary abstraction for 6 tools; a central Set-based check is simpler and keeps the guard in one place |
| Error type | `McpError(ErrorCode.InvalidRequest)` | Plain `throw new Error()` | The existing error handler wraps `Error` into `isError: true` content responses, but `McpError` produces a proper JSON-RPC error frame, which is the correct MCP protocol response for a refused request |

---

## Installation

No new packages to install. All capabilities come from:
- Node.js 20 built-in `util` module
- `@modelcontextprotocol/sdk@^1.27.1` (already installed, already includes `ListResourcesRequestSchema`, `ReadResourceRequestSchema`)

---

## Sources

- Node.js 20 docs `util.parseArgs` — stable API, confirmed working against Node 20.19.0 in this repo (HIGH confidence, verified via runtime test)
- `@modelcontextprotocol/sdk` `dist/cjs/types.d.ts` — `ListResourcesRequestSchema`, `ReadResourceRequestSchema`, `ReadResourceResultSchema`, `ServerCapabilitiesSchema.resources` — read directly from installed package (HIGH confidence)
- `@modelcontextprotocol/sdk` `dist/cjs/server/index.d.ts` — `Server` class API, `setRequestHandler`, `registerCapabilities` — read directly from installed package (HIGH confidence)
- MCP protocol: `ErrorCode.InvalidRequest` (`-32600`) for refused but well-formed requests — per JSON-RPC 2.0 spec as implemented by the SDK (HIGH confidence)
