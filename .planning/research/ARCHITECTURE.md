# Architecture Patterns: Email MCP Server

**Domain:** Email (IMAP/SMTP) — MCP Server with Read-Only Mode
**Researched:** 2026-03-21
**Overall Confidence:** HIGH

---

## Existing Architecture (as-built)

The server is a single `MailMCPServer` class in `src/index.ts` that wires everything together. Its current structure:

```
src/index.ts          MailMCPServer class — MCP wiring, tool dispatch
src/config.ts         Environment-based config (ACCOUNTS_JSON, dotenv)
src/types/index.ts    Shared types: EmailAccount, Credentials, AuthType
src/services/mail.ts  MailService — all business logic (per-account)
src/protocol/imap.ts  ImapFlow wrapper
src/protocol/smtp.ts  Nodemailer wrapper
src/security/         Keychain + OAuth2
src/utils/            Markdown conversion
```

All 14 tools are registered in a single `setupToolHandlers()` method. Tool dispatch is a flat `if` chain on `request.params.name`. There is no middleware layer, no type classification on tools, and no startup flag parsing today.

### Component Boundaries (current)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **MCP Layer** (`src/index.ts`) | Tool registration, JSON-RPC dispatch, error wrapping | LLM/Host, MailService |
| **Service Layer** (`src/services/mail.ts`) | Business logic per account | MCP Layer, Protocol Layer, Security Layer |
| **Protocol Layer** (`src/protocol/`) | IMAP (imapflow), SMTP (nodemailer) | Service Layer, Mail Server |
| **Security Layer** (`src/security/`) | Keychain + OAuth2 token refresh | Service Layer, macOS Keychain |
| **Config** (`src/config.ts`) | Account definitions, env vars | MCP Layer |

---

## Read-Only Mode: Integration Design

### Where the Flag Lives

The `--read-only` flag must be parsed at **process startup**, stored once on the `MailMCPServer` instance, and checked at **the MCP dispatch layer** — not in the service layer.

Rationale:
- The service layer (`MailService`) has no knowledge of the MCP context. Blocking there would be the wrong abstraction and would require threading a flag through every service method call.
- The MCP layer owns the tool contract and is the correct place to enforce which tools are callable. This mirrors how HTTP middleware blocks routes before handlers run.
- Checking at startup (not per-call) is both correct and efficient: the flag does not change during a session.

```
process.argv  →  startup parse  →  this.readOnly: boolean  →  stored on MailMCPServer
                                                             ↓
                                             CallToolRequestSchema handler checks flag
                                             before routing to any write tool
```

### Tool Classification

Tools fall into two categories. This classification must be declared explicitly — not inferred — so it is auditable and doesn't drift silently.

**Read tools (always allowed):**
- `list_accounts`
- `list_emails`
- `search_emails`
- `read_email`
- `list_folders`
- `get_thread`
- `get_attachment`
- `extract_attachment_text`

**Write tools (blocked in read-only mode):**
- `send_email`
- `create_draft`
- `move_email`
- `modify_labels`
- `batch_operations`
- `register_oauth2_account`

Note: `register_oauth2_account` is a write to the keychain, not the mailbox, but it is a mutation that should be blocked. If an operator wants to pre-register credentials before starting in read-only mode, that is the correct workflow.

### How to Block Write Tools

Block in the `CallToolRequestSchema` handler, before the per-tool dispatch chain:

```typescript
// At the top of the CallToolRequest handler, before any if-blocks:
if (this.readOnly && WRITE_TOOLS.has(request.params.name)) {
  return {
    content: [{ type: 'text', text: 'Error: Server is running in read-only mode. This operation is not permitted.' }],
    isError: true
  };
}
```

Use a `Set<string>` named `WRITE_TOOLS` defined as a module-level constant in `src/index.ts`. This makes the write surface explicit, grep-able, and impossible to miss in code review.

Do not throw `McpError` here. Return a structured error response with `isError: true` — this is the established error pattern already used in the codebase's catch block, and it surfaces cleanly to the LLM as a readable refusal rather than a protocol-level error.

### How to Expose Mode to Clients (ROM-04)

The MCP SDK's `Server` constructor accepts an `instructions` string in its options. This field is included in the `initialize` response that every MCP client receives on connection. It is the correct, spec-compliant mechanism for advertising server state — no additional tool or resource needed.

```typescript
this.server = new Server(
  { name: 'mail-mcp-server', version: '0.1.0' },
  {
    capabilities: { tools: {} },
    instructions: readOnly
      ? 'Running in READ-ONLY mode. Write operations (send, draft, move, label, batch, register) are disabled.'
      : undefined,
  }
);
```

This satisfies ROM-04 without inventing a new tool or resource. Clients that inspect `initialize` will see the mode. Clients that don't inspect it will still receive the inline refusal message when they attempt a write.

**Alternative considered — a `get_server_info` tool:** Rejected. A tool adds surface area and requires the client to call it. The `instructions` field is passive and delivered automatically.

**Alternative considered — an MCP Resource at `mcp://server/mode`:** Rejected for the same reason. Resources require active client fetching. The `instructions` field is simpler and standard.

### Startup Flag Parsing

Parse `process.argv` before constructing `MailMCPServer`. Pass the result as a constructor argument so the class is testable without process.argv:

```
main() {
  const readOnly = process.argv.includes('--read-only');
  const server = new MailMCPServer({ readOnly });
  server.run();
}
```

Do not read from an environment variable for this flag. Flags change per-invocation; env vars are session-ambient. The MCP spec (and Claude Desktop config) passes CLI args to stdio servers — this is the expected channel.

---

## Updated Component Boundaries

| Component | Responsibility | Modified? |
|-----------|---------------|-----------|
| **MCP Layer** (`src/index.ts`) | Tool registration, dispatch, read-only enforcement | YES — flag parse, guard, instructions |
| **Service Layer** (`src/services/mail.ts`) | Business logic per account | NO — unchanged |
| **Protocol Layer** (`src/protocol/`) | IMAP/SMTP | NO — unchanged |
| **Security Layer** (`src/security/`) | Keychain + OAuth2 | NO — unchanged |
| **Config** (`src/config.ts`) | Account definitions, env vars | NO — flag does not belong here |
| **Types** (`src/types/index.ts`) | Shared types | MAYBE — add `ServerOptions` if constructor options grow |

---

## Data Flow with Read-Only Mode

```
LLM calls tool
     │
     ▼
CallToolRequestSchema handler
     │
     ├─ [read-only && write tool?] → return isError response immediately
     │
     └─ [allowed] → existing if-chain dispatch → MailService → Protocol
```

No changes below the MCP dispatch layer. The service layer is never reached for blocked tools, so there is zero risk of partial execution.

---

## Build Order

1. **Parse and thread the flag** — Add `readOnly` to `MailMCPServer` constructor. Parse `process.argv` in `main()`. This is self-contained and touches only `src/index.ts`.

2. **Declare the write tool set** — Add `WRITE_TOOLS` constant in `src/index.ts`. This is the audit surface; it must be reviewed for completeness before step 3.

3. **Add the dispatch guard** — Insert the read-only check at the top of `CallToolRequestSchema` handler. Depends on step 1 and 2.

4. **Populate `instructions`** — Pass mode-conditional instructions string to `Server` constructor. Depends on step 1.

5. **Tests** — Verify: write tools return `isError: true` in read-only mode; read tools pass through; `--read-only` flag is correctly parsed; default (no flag) is read-write.

Steps 1-4 are all within `src/index.ts`. No new files required.

---

## Patterns to Follow

### Pattern: Guard before dispatch
Check the flag once, at the top of the dispatch handler, using a `Set` lookup. Do not scatter the check into individual tool branches.

```typescript
const WRITE_TOOLS = new Set([
  'send_email', 'create_draft', 'move_email',
  'modify_labels', 'batch_operations', 'register_oauth2_account'
]);
```

### Pattern: Structured error, not thrown error
The codebase's existing error handling wraps exceptions and returns `{ content: [...], isError: true }`. The read-only refusal must use the same shape for consistency.

### Anti-Pattern: Flag in the service layer
Do not pass `readOnly` to `MailService`. The service layer is infrastructure; policy lives at the interface layer (MCP). Mixing them makes the service untestable in isolation and leaks orchestration concerns into business logic.

### Anti-Pattern: Separate tool lists in `ListTools` and `CallTool`
`ListToolsRequestSchema` currently returns all tools unconditionally. In read-only mode, filtering write tools out of the `ListTools` response is tempting but creates a subtle mismatch risk: if the lists diverge, clients get confusing errors. The simpler and more robust approach is to keep the full tool list visible and return a clear refusal message at call time. The LLM sees the tools exist, attempts one, gets an explicit refusal — unambiguous. Hiding tools from the list while silently blocking them is worse UX for the LLM.

---

## Scalability Considerations

This feature has no scalability implications. It is a single boolean checked once per tool call in O(1) via Set lookup.

---

## Sources

- MCP SDK `Server` constructor types: `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.d.ts` — `instructions?: string` confirmed in `ServerOptions` (HIGH confidence)
- MCP `InitializeResult` schema: `types.d.ts` line 879 — `instructions` is part of the initialize response (HIGH confidence)
- Existing codebase: `src/index.ts` — tool list, dispatch pattern, error shape confirmed by direct reading (HIGH confidence)
- [MCP Specification — Server initialization](https://modelcontextprotocol.io/docs/specification) (MEDIUM confidence — verified via SDK types)
