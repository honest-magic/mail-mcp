# Domain Pitfalls: Mail MCP Server (IMAP/SMTP)

**Domain:** Email Integration via IMAP/SMTP + Read-Only Mode Feature
**Researched:** 2026-03-21
**Confidence:** HIGH (codebase-specific, based on direct analysis of src/index.ts and MCP SDK internals)

---

## Part A: Read-Only Mode Pitfalls (Milestone v1.1 — Current Focus)

These pitfalls are specific to adding a `--read-only` startup flag to an existing MCP tool server
that already has write capabilities. They are ordered by severity.

---

### Pitfall R-01: Incomplete Write Tool Enumeration

**What goes wrong:**
One or more write tools are not included in the read-only block list. The most common victim is
`register_oauth2_account`, which writes to the macOS Keychain, and `modify_labels`, which mutates
IMAP flags on the server. Because these tools do not "send" email, developers mentally categorize
them as "safe" and forget to block them.

**Why it happens:**
Write-tool enumeration is done by mental model, not by code analysis. The developer thinks
"send and move are writes," forgets that anything mutating external state is a write.

**How to avoid:**
Define the complete write-tool set explicitly in a typed constant before implementing the block.
In this codebase: `send_email`, `create_draft`, `move_email`, `modify_labels`,
`batch_operations`, and `register_oauth2_account` are all writes. Make this list the
single source of truth — used by both the guard check and the `ListTools` filter (if any).

**Warning signs:**
- Tests only cover `send_email` and `create_draft` but not `modify_labels` or `batch_operations`
- The word "write" does not appear in any constant or type definition

**Phase to address:** Phase 1 (flag parsing and tool guard) — must define the list before any
guard implementation begins

---

### Pitfall R-02: Checking Read-Only Flag at Call Time via Module-Level Variable

**What goes wrong:**
The read-only flag is stored in a `let` variable at module scope and read inside `CallToolRequestSchema`
handler. If any async path can mutate this variable (e.g., a future config-reload feature or test
utility), the guard becomes unreliable.

**Why it happens:**
Using a mutable variable feels natural; Node.js developers reach for `let isReadOnly = false`
without considering that the startup flag should be immutable for the server's lifetime.

**How to avoid:**
Parse `--read-only` from `process.argv` exactly once at startup and store it as a `const`.
Pass it into the `MailMCPServer` constructor so it is sealed at construction time, not injected
later. Mark the property `readonly` in TypeScript: `private readonly readOnlyMode: boolean`.

**Warning signs:**
- Flag is stored as `let` anywhere in the call chain
- Flag is read from environment variable at call time (allows mutation via `process.env`)
- No TypeScript `readonly` qualifier on the server property

**Phase to address:** Phase 1 (flag parsing) — parse once, freeze immediately

---

### Pitfall R-03: Returning a Generic Error Instead of a Descriptive Refusal

**What goes wrong:**
The read-only guard throws a generic `Error` or `McpError(ErrorCode.InternalError, ...)` that
the client sees as a server malfunction rather than an intentional policy refusal. The LLM
re-attempts the tool call or escalates unnecessarily.

**Why it happens:**
The existing error path in `src/index.ts` catches everything and wraps it in a generic
`{ content: [{type: 'text', text: 'Error: ...'}], isError: true }`. Developers just throw
an `Error` and assume the message is enough.

**How to avoid:**
Use a message pattern that is unambiguous for both humans and LLMs: include the tool name,
the mode, and what to do instead. Example:
`"Tool 'send_email' is not available: server is running in read-only mode. Use a server without
--read-only to perform write operations."` Keep `isError: true` so clients know it is a hard
refusal, not partial success.

**Warning signs:**
- Refusal message is "read-only mode" with no tool name
- Error uses `ErrorCode.MethodNotFound` (implies the tool doesn't exist, not that it's blocked)
- No mention of what the user should do differently

**Phase to address:** Phase 1 (tool blocking) — write the exact message before wiring the check

---

### Pitfall R-04: Tool List Still Shows Write Tools When Read-Only Is Active

**What goes wrong:**
`ListToolsRequestSchema` returns the full tool list regardless of mode. The LLM sees
`send_email` as available, calls it, receives a refusal error, and enters a confused loop
trying alternate phrasings because it believes the tool exists but is failing.

**Why it happens:**
Blocking at call-time and filtering at list-time are treated as separate concerns. The developer
blocks calls correctly but forgets that the tool listing informs LLM planning. MCP clients
(Claude Desktop, etc.) prefetch the tool list on connect and cache it.

**How to avoid:**
If read-only mode is active, omit write tools from `ListToolsRequestSchema` entirely. The
recommended pattern: build the full tool array, then filter it through the write-tool set
before returning. This is the preferred MCP pattern because it prevents the LLM from planning
actions that cannot succeed. Keep the call-time guard as a defense-in-depth layer.

**Warning signs:**
- `ListToolsRequestSchema` handler has no reference to the read-only flag
- Manual testing shows `send_email` in the tool list when server starts with `--read-only`

**Phase to address:** Phase 1 (tool listing) — filter happens in the same handler pass as the
tool-list construction

---

### Pitfall R-05: Mode Not Discoverable by MCP Clients (ROM-04 Missed)

**What goes wrong:**
The server correctly blocks writes but exposes no structured way for a client to know it is
in read-only mode before calling a tool. Clients that want to adapt their UI (e.g., disable
a "compose" button, add a status badge) have no programmatic signal.

**Why it happens:**
ROM-04 is easy to skip because the functional behavior (blocking) appears complete. Mode
exposure feels like a "nice to have" and gets deferred until there is no phase left to do it.

**How to avoid:**
Use one of two MCP-native mechanisms (not both):

1. **`instructions` field on `InitializeResult`** — set in the `Server` constructor's second
   argument. Example: append `"NOTE: Server is running in read-only mode. Write tools are
   unavailable."` to the instructions string when the flag is active. This is visible to any
   MCP client and is injected into the LLM system prompt by most clients.

2. **Dedicated `get_server_info` tool** — returns a JSON object with `{ readOnly: boolean }`.
   This is queryable without an out-of-band protocol mechanism.

The `instructions` approach (option 1) is preferred because it costs nothing extra and reaches
the LLM immediately at session start without requiring a tool call.

**Warning signs:**
- `new Server({name, version}, {capabilities})` has no `instructions` field
- There is no tool or resource exposing `{ readOnly: true }`
- ROM-04 requirement checked off but there is no test verifying client discovery

**Phase to address:** Phase 2 (client discoverability) — this is a separate deliverable from
blocking; ROM-04 should be a distinct implementation step

---

### Pitfall R-06: `modify_labels` Classification Ambiguity — The Grey-Area Tool

**What goes wrong:**
`modify_labels` is treated as a read operation because it "just changes flags." However, setting
`\Seen` (marking as read) or `\Deleted` via this tool are server-side mutations. In read-only
mode, marking an email as read via `modify_labels` is a write — it changes state on the IMAP
server that other clients observe.

**Why it happens:**
The mental model of "read-only" focuses on outbound SMTP operations (send) and folder mutations
(move, delete). Flag mutations feel lighter-weight but are IMAP `STORE` commands that mutate
server state.

**How to avoid:**
Define read-only as: "no mutations to server state via IMAP or SMTP." This explicitly includes
`modify_labels` and `batch_operations` with `action: 'label'`. The IMAP `EXAMINE` command (as
opposed to `SELECT`) demonstrates this philosophy: EXAMINE opens a mailbox read-only and
refuses to set `\Seen` on fetched messages. Mirror that philosophy.

**Warning signs:**
- `modify_labels` is omitted from the write-tool block list
- A test for read-only mode does not include a `modify_labels` call

**Phase to address:** Phase 1 (write tool enumeration) — the write-tool constant must include
`modify_labels`

---

### Pitfall R-07: SMTP Connection Still Established in Read-Only Mode

**What goes wrong:**
`MailService.connect()` in `src/services/mail.ts` calls `await this.smtpClient.connect()` even
when the server is in read-only mode. This opens an unnecessary SMTP connection (consuming
resources, triggering server-side auth, and potentially failing in firewalled environments)
for a session that will never send email.

**Why it happens:**
The service layer has no awareness of read-only mode. The connection is made eagerly on first
`getService()` call without consulting server mode.

**How to avoid:**
Either (a) skip `smtpClient.connect()` in `MailService` when a `readOnly` flag is passed to
the constructor, or (b) lazily instantiate the SMTP client only when a send operation is
actually called. Option (a) is simpler and more explicit for this milestone. Pass
`readOnly: boolean` to `MailService` constructor; if true, skip the SMTP connect entirely.

**Warning signs:**
- Telemetry shows SMTP auth events when server runs with `--read-only`
- SMTP connection failures surface as errors in read-only sessions that should never touch SMTP

**Phase to address:** Phase 1 (optional refinement) or Phase 2 — this is a quality-of-life
improvement, not strictly required for correctness if the call-time guard is reliable

---

## Part B: IMAP/SMTP Domain Pitfalls (Prior Phases — Existing Reference)

These pitfalls were identified during prior phase research and remain valid for the full
project lifetime.

---

### Pitfall 1: UIDVALIDITY Invalidation

**What goes wrong:** The client's local cache of message UIDs becomes completely out of sync with the server.

**Why it happens:** IMAP servers use `UIDVALIDITY` to signal if the UID sequence has been reset (e.g., due to a database restore, server migration, or mailbox reconstruction).

**How to avoid:** Always check the `UIDVALIDITY` value upon selecting a mailbox. If it differs from the cached value, discard the local cache for that folder and re-index.

**Warning signs:** Monitor for `UIDVALIDITY` responses in the `SELECT` or `EXAMINE` command output.

**Phase to address:** Phase 2 (Discovery & Organization)

---

### Pitfall 2: The "Sent" Folder Disappearance

**What goes wrong:** Emails sent via the MCP server do not appear in the user's "Sent" folder.

**Why it happens:** SMTP only handles delivery. Most servers do not automatically copy to `Sent`.

**How to avoid:** After a successful SMTP send, manually upload the message to the IMAP `Sent` folder using `APPEND`.

**Warning signs:** "Sent" folder is empty after a test send.

**Phase to address:** Phase 1 (Basic Connectivity)

---

### Pitfall 3: Credential Exposure and Plaintext Storage

**What goes wrong:** User credentials leaked from config files or logs.

**Why it happens:** Storing credentials in `.env` files or logging config objects.

**How to avoid:** Use system keychains (macOS Keychain via `cross-keychain`). Use OAuth2/XOAUTH2 or App-Specific Passwords.

**Warning signs:** `console.log` of config objects; world-readable config files.

**Phase to address:** Phase 1 (Secure Connectivity)

---

### Pitfall 4: Gmail Label vs. Folder Paradox

**What goes wrong:** Duplicate emails visible to AI, or incorrect "move" behavior.

**Why it happens:** Gmail uses labels, not folders. Single messages appear in multiple IMAP folders.

**How to avoid:** Use `X-GM-MSGID` for deduplication. Use `X-GM-LABELS` for moves on Gmail.

**Warning signs:** Multiple UIDs for the same `Message-ID` across folders.

**Phase to address:** Phase 2 (Discovery & Organization)

---

### Pitfall 5: Connection Zombies (IDLE Timeouts)

**What goes wrong:** Server stops receiving notifications without error.

**Why it happens:** IMAP IDLE connections are silently dropped by firewalls after 15-30 minutes.

**How to avoid:** Send `NOOP` or re-issue `IDLE` every 10-15 minutes.

**Warning signs:** No new email notifications after 1 hour of inactivity.

**Phase to address:** Phase 2 (Sync & Search)

---

### Pitfall 6: Attachment Bloat and Token Exhaustion

**What goes wrong:** Full email content with attachments causes context window errors.

**Why it happens:** Fetching entire email body and all attachments by default.

**How to avoid:** Fetch `BODYSTRUCTURE` first; provide a separate `get_attachment` tool.

**Warning signs:** High token-per-request metrics; frequent context length errors.

**Phase to address:** Phase 3 (Context & Resources)

---

### Pitfall 7: Folder Name Fragmentation

**What goes wrong:** Server fails to find "Sent" or "Trash" on providers with non-standard names.

**Why it happens:** Folder names vary by provider (`Sent`, `Sent Items`, `[Gmail]/Sent Mail`).

**How to avoid:** Use `SPECIAL-USE` extension (RFC 6154) to find folders by flag (`\Sent`, `\Trash`).

**Warning signs:** "Folder not found" errors on providers other than Gmail.

**Phase to address:** Phase 1 (Basic Connectivity)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing read-only flag as module-level `let` | Fast to implement | Mutability bugs; harder to test | Never — use `const` or constructor injection |
| Blocking only at call time, not at list time | One enforcement point | LLM plans actions it cannot execute | Never for new implementations |
| Generic error message for blocked tools | Less code | LLM retries, user confusion | Never — message content is load-bearing UX |
| Exposing mode only via logs, not protocol | Zero code | Client cannot adapt without screen-scraping | Never for ROM-04 requirement |
| Skipping SMTP skip in read-only mode | Simpler service layer | Unnecessary connections, harder debugging | Acceptable as a Phase 2 improvement |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCP `ListToolsRequestSchema` | Return static tool array; ignore mode | Filter array against write-tool set when `readOnly` is true |
| MCP `Server` constructor | Omit `instructions` field | Append mode notice to `instructions` when `readOnly` is true |
| `process.argv` parsing | Parse inside a handler or middleware | Parse once before `new MailMCPServer()`, pass as constructor arg |
| `MailService` constructor | Always connect SMTP | Accept `readOnly` flag; skip `smtpClient.connect()` when true |
| Error response format | Use `ErrorCode.MethodNotFound` for blocked tools | Use `isError: true` with descriptive message; method exists, it is blocked |

---

## "Looks Done But Isn't" Checklist (Read-Only Mode)

- [ ] **Write tool block list**: Verify it includes `modify_labels`, `batch_operations`, AND `register_oauth2_account` — not just `send_email` and `create_draft`
- [ ] **ListTools filtering**: Verify write tools are absent from `tools/list` response when `--read-only` is active, not just blocked at call time
- [ ] **Mode exposure (ROM-04)**: Verify MCP client receives structured mode signal — check `instructions` in initialize response or a `get_server_info` tool response
- [ ] **Error message quality**: Verify refusal message names the blocked tool and explains why, not just "read-only mode"
- [ ] **Flag immutability**: Verify the flag is `readonly` in TypeScript and parsed once at entry point
- [ ] **SMTP connection**: Verify no SMTP authentication event occurs when server starts with `--read-only`
- [ ] **Read tools unaffected**: Verify `list_emails`, `search_emails`, `read_email`, `get_thread`, `get_attachment`, `extract_attachment_text`, `list_folders`, `list_accounts` all return normal results

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| R-01: Incomplete write tool enumeration | Phase 1 — Flag & Guard | Unit test calls every named tool in read-only mode; all writes fail, all reads succeed |
| R-02: Mutable flag variable | Phase 1 — Flag Parsing | TypeScript `readonly` qualifier; grep for `let isReadOnly` yields zero results |
| R-03: Generic error on block | Phase 1 — Tool Guard | Assert error message contains tool name and "read-only mode" |
| R-04: Write tools in list | Phase 1 — Tool Listing | Assert `tools/list` response excludes `send_email` when `--read-only` is set |
| R-05: Mode not discoverable | Phase 2 — Client Discoverability | Assert `initialize` response `instructions` field contains "read-only" string |
| R-06: `modify_labels` grey area | Phase 1 — Write Tool Enumeration | Explicit test: call `modify_labels` in read-only mode; assert blocked |
| R-07: SMTP connect in read-only | Phase 1 or 2 | No SMTP auth log lines when starting with `--read-only` |

---

## Sources

- Direct analysis of `src/index.ts` (ListToolsRequestSchema and CallToolRequestSchema handlers)
- Direct analysis of `src/services/mail.ts` (MailService constructor and connect method)
- MCP SDK `dist/esm/types.js` — `ServerCapabilitiesSchema`, `InitializeResultSchema.instructions`
- [RFC 3501 (IMAP4rev1)](https://datatracker.ietf.org/doc/html/rfc3501) — EXAMINE vs SELECT semantics
- [RFC 6154 (IMAP SPECIAL-USE Extension)](https://datatracker.ietf.org/doc/html/rfc6154)
- [Gmail IMAP Extensions Documentation](https://developers.google.com/gmail/imap/imap-extensions)

---
*Pitfalls research for: Mail MCP Server — Read-Only Mode (Milestone v1.1) + IMAP/SMTP domain*
*Researched: 2026-03-21*
