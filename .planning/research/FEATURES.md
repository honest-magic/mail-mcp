# Feature Landscape: Read-Only Mode (Milestone v1.1)

**Domain:** MCP Tool Server — Read-Only Mode
**Researched:** 2026-03-21
**Overall Confidence:** HIGH (MCP SDK inspected directly, spec consulted)

## Context: Subsequent Milestone

This research is scoped to the **read-only mode milestone** (v1.1). All core email features
(IMAP read, SMTP send, folder management, search, threading, attachments, batch operations)
are already built and validated. This file documents only the new features required for
read-only mode.

**Active requirements:**
- ROM-01: Server can be started with a `--read-only` flag
- ROM-02: In read-only mode, write tools return a clear refusal error
- ROM-03: In read-only mode, all read/search tools function normally
- ROM-04: Server exposes its current mode so MCP clients can adapt

---

## Existing Tools: Write vs. Read Classification

Before building read-only mode, every existing tool must be classified. This drives the
enforcement logic.

### Write Tools (blocked in read-only mode)

| Tool | Why It Writes | IMAP/SMTP Operation |
|------|--------------|---------------------|
| `send_email` | Sends message via SMTP, saves to Sent folder | SMTP + IMAP APPEND |
| `create_draft` | Saves message to Drafts folder | IMAP APPEND |
| `move_email` | Changes message location on server | IMAP MOVE/COPY+EXPUNGE |
| `modify_labels` | Sets/clears flags (`\Seen`, `\Flagged`, etc.) | IMAP STORE |
| `batch_operations` (move/delete/label) | Mutates multiple messages | IMAP STORE/MOVE/EXPUNGE |
| `register_oauth2_account` | Writes credentials to macOS Keychain | Keychain write |

**Note on `batch_operations`:** The action is a parameter (`move`, `delete`, `label`).
All three variants are mutations. The entire tool is a write tool.

### Read Tools (permitted in read-only mode)

| Tool | Why It Is Read-Only | IMAP Operation |
|------|---------------------|----------------|
| `list_accounts` | Reads config file only | None |
| `list_emails` | Fetches message headers | IMAP FETCH (no flag side-effect) |
| `search_emails` | Queries message UIDs | IMAP SEARCH |
| `read_email` | Fetches message body | IMAP FETCH |
| `list_folders` | Lists mailbox names | IMAP LIST |
| `get_thread` | Fetches grouped messages | IMAP FETCH + SEARCH |
| `get_attachment` | Downloads attachment bytes | IMAP FETCH |
| `extract_attachment_text` | Reads and parses attachment | IMAP FETCH (local parse) |

**Important caveat — implicit \Seen flag:** Some IMAP servers automatically set the
`\Seen` flag when a message body is fetched via `read_email` or `get_attachment`.
To be truly read-only at the IMAP protocol level, the server should open the mailbox in
read-only mode via `EXAMINE` instead of `SELECT`. imapflow supports this via `mailbox`
open options. Whether to enforce IMAP-level read-only is a judgment call (see below).

---

## Table Stakes

Features the read-only mode must have to be considered complete and trustworthy.
Missing any of these makes the feature feel broken or unshippable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`--read-only` startup flag** | The entry point. Without this, there is no mode. | Low | Parse `process.argv` before constructing the server. |
| **Write tools return refusal error** | Core contract: no mutations happen in read-only mode. | Low | Single guard checked at the top of each write-tool handler. `isError: true` in the response. |
| **Read tools work normally in read-only mode** | Mode must be transparent to the LLM for read operations. | Low | No change needed for read tool handlers. |
| **Mode exposed via `get_server_info` tool** | ROM-04. Clients need to know the mode to give the LLM accurate context. | Low | New tool or embedded in `list_accounts` response. See differentiators for the better approach. |
| **Clear, actionable error message on write refusal** | LLMs use error text to self-correct. Ambiguous errors cause retry loops. | Low | Message must state the mode, the blocked tool, and what to do instead. |

---

## Differentiators

Features that go beyond the four requirements and make read-only mode noticeably better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Tool annotations (`readOnlyHint`, `destructiveHint`)** | MCP-native way for clients to understand tool safety *before* calling. Claude Desktop and other clients may use these to suppress confirmation dialogs for read tools. | Low | The MCP SDK `ToolAnnotationsSchema` defines `readOnlyHint: boolean` and `destructiveHint: boolean`. Add to all tool definitions. |
| **Omit write tools from `tools/list` in read-only mode** | Prevents LLMs from ever attempting blocked operations. The model cannot call what it cannot see. Cleaner than relying on runtime refusal alone. | Low | Filter tool list in `ListToolsRequestSchema` handler. Pairs with `listChanged: true` capability if mode can be toggled at runtime (out of scope for now). |
| **Server `instructions` field reflects mode** | The `InitializeResult.instructions` field is sent to clients during handshake and may be injected into the LLM's system prompt by clients like Claude Desktop. Including mode status here primes the model correctly before any tool calls. | Low | Set `instructions` to include "Server is in read-only mode. Email mutations are not available." when `--read-only` is active. |
| **IMAP EXAMINE instead of SELECT in read-only mode** | Prevents the `\Seen` flag from being set as a side-effect of reading messages. Guarantees protocol-level read-only, not just tool-level. | Medium | imapflow's `mailbox` open call accepts an `examine` option or equivalent. Requires verifying exact imapflow API. Meaningful for privacy-sensitive use cases. |

---

## Anti-Features

Features that seem useful but should not be built for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Runtime mode toggle (switch from read-only to read-write)** | Adds significant complexity (state management, `tools/list_changed` notification, reconnect logic). Out of scope. The mode is a startup contract. | Require server restart to change mode. Document clearly. |
| **Per-tool granular allow-listing in read-only mode** | "Block send but allow create_draft" configurations add surface area and make the mode harder to reason about. | Keep the mode binary: all writes blocked or none. |
| **Silent no-op on write tools in read-only mode** | Returning success without doing anything is actively deceptive to the LLM. It will believe the action happened. | Always return `isError: true` with an explicit refusal message. |
| **Separate read-only config file or flag format** | Two configuration systems for the same boolean is unnecessary complexity. | A single `--read-only` CLI flag is sufficient. |

---

## Feature Dependencies

```
--read-only flag parsed
  → write tool refusal (ROM-02) — requires knowing mode at handler time
  → tool list filtering (differentiator) — requires knowing mode at list-generation time
  → server instructions field (differentiator) — requires knowing mode at Server constructor time
  → IMAP EXAMINE mode (differentiator) — requires passing mode into MailService

Mode discovery tool (ROM-04) → --read-only flag (ROM-01)
```

The flag must be parsed and stored as a module-level or constructor-level constant before
any handler setup occurs. All other features derive from this single boolean.

---

## MVP Recommendation

Build in this order:

1. **Parse `--read-only` flag** — `process.argv` check, stored as a constant, passed into `MailMCPServer` constructor. This unlocks all other features.

2. **Write tool refusal** — Guard at the top of `CallToolRequestSchema` handler. Return `{ content: [{ type: 'text', text: 'Server is in read-only mode. Tool "send_email" is not available. No changes were made.' }], isError: true }`.

3. **Omit write tools from `tools/list`** — Filter the tool array in `ListToolsRequestSchema` handler when `readOnly === true`. This is strictly better than runtime refusal alone because the LLM never tries blocked tools. Low effort, high value.

4. **Add MCP tool annotations** — Add `annotations: { readOnlyHint: true }` to all read tools and `annotations: { readOnlyHint: false, destructiveHint: true }` to all write tools. This is independent of mode and should ship regardless.

5. **Server instructions field** — Set `instructions` in the `Server` constructor call to include mode when `--read-only` is active. Zero-cost discoverability.

**Defer:** IMAP EXAMINE mode. It adds protocol-level correctness but requires verifying imapflow's exact API and testing against real mailboxes. Not required for the four ROM requirements.

---

## Behavior Contract for Clients

What MCP clients and LLMs should expect from a read-only mode server:

| Scenario | Expected Behavior |
|----------|------------------|
| Call `list_emails` in read-only mode | Normal response, no difference |
| Call `send_email` in read-only mode | `isError: true`, message explains mode and that no action was taken |
| Call `tools/list` in read-only mode | Write tools absent from the list |
| Initialize connection | `serverInfo` available; `instructions` field states read-only mode |
| Read tool sets `\Seen` flag implicitly | Acceptable unless IMAP EXAMINE is implemented (deferred) |

---

## MCP-Specific Implementation Notes

These are verified against the MCP SDK (`@modelcontextprotocol/sdk` as installed in the project):

**Tool Annotations (HIGH confidence — read from SDK source):**
- `readOnlyHint: boolean` — if true, tool does not modify environment. Default: `false`.
- `destructiveHint: boolean` — if true, tool may destructively update environment. Default: `true`. Only meaningful when `readOnlyHint == false`.
- `idempotentHint: boolean` — if true, calling repeatedly with same args has no additional effect. Default: `false`.
- Annotations are hints only. Clients must not make trust decisions based on annotations from untrusted servers.

**Mode Discoverability (HIGH confidence — read from SDK source):**
- The `InitializeResult` includes `instructions: string` (optional). This is described as "a hint to the model" that clients MAY inject into the system prompt.
- There is no dedicated "server mode" field in the MCP spec. The `instructions` field plus the tool list are the two canonical ways to signal mode.
- A dedicated `get_server_info` tool is the most explicit option for ROM-04 and is what an LLM can query programmatically.

**Tool List Filtering vs. Runtime Refusal (MEDIUM confidence — pattern reasoning):**
- Filtering the tool list in read-only mode is strictly superior to only using runtime refusal. An LLM that cannot see `send_email` will not attempt to call it. Runtime refusal is a safety net, not the primary mechanism.
- Both should be implemented together.

---

## Sources

- MCP SDK `ToolAnnotationsSchema` — `/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js` lines 1153–1197 (HIGH confidence, read from installed package)
- MCP SDK `InitializeResultSchema` — `/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js` line 532 (HIGH confidence)
- MCP Tools Specification — https://modelcontextprotocol.io/specification/2025-11-25/server/tools (MEDIUM confidence, fetched current)
- Existing tool list — `/src/index.ts` (HIGH confidence, read from codebase)
- PROJECT.md ROM-01 to ROM-04 requirements — `.planning/PROJECT.md` (HIGH confidence)
