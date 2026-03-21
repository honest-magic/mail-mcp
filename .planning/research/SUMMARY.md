# Project Research Summary

**Project:** Mail MCP Server — Read-Only Mode (Milestone v1.1)
**Domain:** MCP Tool Server — IMAP/SMTP Email Integration with Access Control
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

This milestone adds a `--read-only` startup flag to an already-functional MCP email server. The core infrastructure (IMAP via imapflow, SMTP via nodemailer, 14 tools, OAuth2/Keychain security) is complete and validated. The read-only feature is narrow in scope: parse one boolean flag at startup, enforce it at the MCP dispatch layer, and signal the mode to clients. All four requirements (ROM-01 through ROM-04) can be satisfied without adding any new npm dependencies — Node.js 20's built-in `util.parseArgs` handles flag parsing, and the already-installed `@modelcontextprotocol/sdk@^1.27.1` provides all MCP primitives needed.

The recommended approach is to enforce read-only mode exclusively at the `CallToolRequestSchema` dispatch layer, not in the service layer. The `MailMCPServer` constructor accepts a `readOnly: boolean` parameter stored as a TypeScript `readonly` property. A module-level `WRITE_TOOLS` Set (6 tools) serves as the single source of truth for classification. When active, write tools are filtered from `tools/list` responses (preventing LLM planning of blocked operations) and blocked at call time with a descriptive `isError: true` refusal (defense-in-depth). Mode is exposed to clients via the MCP `InitializeResult.instructions` field — zero extra tools or resources, automatically delivered at handshake time.

The primary risks are enumeration gaps (forgetting `modify_labels`, `batch_operations`, or `register_oauth2_account` in the block list) and UX failures (a generic error message causes LLM retry loops). Both are mitigated by defining the write-tool set as an explicit, auditable constant before writing any guard logic, and by specifying the exact refusal message format in the implementation plan.

## Key Findings

### Recommended Stack

The project already has the correct stack installed. No new dependencies are required for this milestone. Node.js 20 (currently 20.19.0 in this repo) ships `util.parseArgs` as a stable built-in, replacing the need for `commander`, `minimist`, or any other CLI parsing library for a single boolean flag. See `.planning/research/STACK.md` for full details.

**Core technologies (all already installed, none require changes):**
- `@modelcontextprotocol/sdk@^1.27.1`: MCP server, `InitializeResult.instructions`, `ToolAnnotationsSchema` — all required capabilities present
- `zod@^4.3.6`: Schema validation already in use throughout; no changes
- `imapflow@^1.0.158`: IMAP client — unchanged; optional future improvement to use `EXAMINE` instead of `SELECT`
- `nodemailer@^6.9.13`: SMTP client — unchanged; connection can be skipped in read-only mode
- Node.js built-in `util.parseArgs`: CLI flag parsing — zero new dependency

### Expected Features

The four ROM requirements define a minimal, complete feature set. Research identified additional high-value differentiators that are low-effort and should ship with the milestone. See `.planning/research/FEATURES.md` for full classification.

**Must have (table stakes — ROM requirements):**
- `--read-only` startup flag (`ROM-01`) — entry point; all other features derive from this single boolean
- Write tool refusal with `isError: true` and descriptive message (`ROM-02`) — core enforcement contract
- Read tools function normally in read-only mode (`ROM-03`) — no handler changes needed, inherently satisfied by the guard
- Mode exposed to MCP clients (`ROM-04`) — via `instructions` field on `InitializeResult`

**Should have (differentiators, low effort, ship with milestone):**
- Filter write tools from `tools/list` in read-only mode — prevents LLM from planning blocked actions; strictly superior to call-time refusal alone
- MCP tool annotations (`readOnlyHint`, `destructiveHint`) on all tool definitions — MCP-native safety signaling, independent of mode
- Server `instructions` field reflects mode — primes LLM before any tool call, satisfies ROM-04 at zero extra cost

**Defer to future milestone:**
- IMAP `EXAMINE` instead of `SELECT` — prevents implicit `\Seen` flag mutation; deferred pending imapflow API verification
- SMTP connection skip in `MailService` — acceptable quality improvement, not required for correctness
- Runtime mode toggle — significant complexity; mode is a startup contract

**Anti-features (explicitly avoid):**
- Silent no-op on write tools — deceptive to the LLM; always `isError: true`
- Per-tool granular allow-listing in read-only mode — unnecessary surface area; mode is binary
- Storing mode in a mutable env variable — allows unintentional mutation; use constructor injection

### Architecture Approach

The existing layered architecture (MCP Layer → Service Layer → Protocol Layer → Security Layer) requires changes only to `src/index.ts`. The flag is parsed once in `main()` before constructing `MailMCPServer`, passed as a constructor argument, and stored as `private readonly readOnly: boolean`. All enforcement lives at the MCP dispatch layer — the service layer has zero knowledge of the mode, preserving its testability and clean boundary. No new files are required. See `.planning/research/ARCHITECTURE.md` for full design.

**Component responsibilities under read-only mode:**
1. **MCP Layer** (`src/index.ts`) — flag parsing, `WRITE_TOOLS` constant, dispatch guard, `tools/list` filter, `instructions` field — the only component modified
2. **Service Layer** (`src/services/mail.ts`) — unchanged; optionally accept `readOnly` flag to skip SMTP connection as a quality improvement
3. **Protocol Layer** (`src/protocol/`) — unchanged
4. **Security Layer** (`src/security/`) — unchanged; `register_oauth2_account` blocked at MCP layer, not service layer
5. **Config** (`src/config.ts`) — unchanged; startup flags are not environment configuration

**Key patterns:**
- Guard before dispatch: single `Set.has()` check at the top of `CallToolRequestSchema`, not scattered into individual tool branches
- Structured error response: `{ content: [{ type: 'text', text: '...' }], isError: true }` — matches existing codebase error shape
- Explicit write-tool constant: `WRITE_TOOLS` as a module-level `Set<string>` — auditable, grep-able, impossible to miss in code review

### Critical Pitfalls

1. **Incomplete write tool enumeration (R-01, R-06)** — `modify_labels`, `batch_operations`, and `register_oauth2_account` are the most likely omissions. Developers mentally model "writes" as send/move and miss flag mutations and keychain writes. Define the complete `WRITE_TOOLS` constant (all 6 tools) as the first implementation step before any guard code.

2. **LLM retry loops from generic error messages (R-03)** — A message like "read-only mode" without the tool name causes the LLM to attempt variations. The refusal must name the blocked tool, state the mode, and explain what to do: `"Tool 'send_email' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations."`

3. **Write tools visible in `tools/list` while blocked at call time (R-04)** — If `ListToolsRequestSchema` returns the full tool list regardless of mode, the LLM plans actions it cannot execute. Filter write tools out of the response when `readOnly === true`. Keep the call-time guard as defense-in-depth only.

4. **Mutable flag variable (R-02)** — Storing the flag as a module-level `let` creates a mutation risk for tests and future features. Parse once in `main()`, pass to constructor, store as `private readonly readOnly: boolean`. TypeScript enforces immutability at compile time.

5. **Mode not discoverable at initialization (R-05)** — ROM-04 is easy to defer because blocking appears functionally complete. The `instructions` field on the `Server` constructor is the correct mechanism — it is delivered automatically at the MCP handshake without requiring a tool call from the client.

## Implications for Roadmap

This milestone is a tightly scoped, two-phase feature. Both phases touch only `src/index.ts` and optionally `src/services/mail.ts`.

### Phase 1: Flag Parsing, Write Guard, and Tool Filtering

**Rationale:** ROM-01 (flag) is the dependency for all other requirements. Phase 1 delivers the full enforcement contract (ROM-01, ROM-02, ROM-03) plus the critical `tools/list` filtering differentiator that prevents LLM confusion. All changes are contained in a single file.

**Delivers:** Functional read-only mode — write tools blocked at both list-time and call-time; read tools unaffected; server starts correctly with and without the flag; tool annotations added to all tools.

**Addresses features:**
- ROM-01: `util.parseArgs` in `main()`, `readOnly` passed to `MailMCPServer` constructor
- ROM-02: `WRITE_TOOLS` Set + guard at top of `CallToolRequestSchema`
- ROM-03: No changes to read tool handlers (inherently satisfied)
- Differentiator: `ListToolsRequestSchema` filters write tools when `readOnly === true`
- Differentiator: `readOnlyHint`/`destructiveHint` annotations on all tool definitions

**Avoids pitfalls:**
- R-01/R-06: Define `WRITE_TOOLS` constant first, covering all 6 tools including `modify_labels` and `register_oauth2_account`
- R-02: Store as `private readonly readOnly: boolean` from the start
- R-03: Specify exact refusal message format before implementing the guard
- R-04: Filter `ListToolsRequestSchema` in the same pass as the call-time guard

### Phase 2: Mode Discoverability and Connection Hygiene

**Rationale:** ROM-04 (mode exposure) is independently deliverable and lower urgency than enforcement. Grouping it with SMTP connection hygiene creates a coherent quality-focused phase that keeps service-layer changes reviewable separately from MCP-layer changes.

**Delivers:** Clients receive mode signal at MCP initialization; no unnecessary SMTP authentication in read-only sessions.

**Addresses features:**
- ROM-04: `instructions` field on `Server` constructor reflects mode when `readOnly === true`
- Quality: Skip `smtpClient.connect()` in `MailService` when `readOnly === true`
- Deferred: IMAP `EXAMINE` instead of `SELECT` — only if imapflow API is confirmed

**Avoids pitfalls:**
- R-05: `instructions` field presence verified in tests against `InitializeResult`
- R-07: No SMTP authentication events when server starts with `--read-only`

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because the `instructions` field (ROM-04) requires the flag to exist as a constructor argument before it can be reflected at initialization.
- Phase 1 is entirely within `src/index.ts` — zero risk of cross-file regressions during enforcement implementation.
- Phase 2 service-layer changes (`src/services/mail.ts`) are separated so they are reviewable independently from the MCP dispatch changes.
- Tool annotations (Phase 1) are mode-independent and add value regardless of read-only mode; including them in Phase 1 avoids a separate low-effort pass later.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (IMAP EXAMINE):** Verify the exact imapflow API for opening a mailbox in examine mode before committing to implementation. The feature is documented but the option syntax for `^1.0.158` is not confirmed. Only blocks the IMAP-level read-only differentiator, not core requirements.

Phases with standard patterns (skip research-phase):
- **Phase 1:** All mechanisms verified directly against installed codebase, SDK source, and Node.js 20 runtime. No external research needed.
- **Phase 2 (instructions field, SMTP skip):** Both patterns verified against installed SDK types and `src/services/mail.ts`. Straightforward implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against installed packages and Node 20.19.0 runtime. Zero new dependencies required. |
| Features | HIGH | MCP SDK inspected directly; ROM requirements from `.planning/PROJECT.md`; tool list read from `src/index.ts`. |
| Architecture | HIGH | Based on direct reading of `src/index.ts` and `src/services/mail.ts`; no external inference required. |
| Pitfalls | HIGH | Codebase-specific analysis grounded in the actual tool list, dispatch pattern, and IMAP/SMTP domain knowledge. |

**Overall confidence:** HIGH

### Gaps to Address

- **imapflow EXAMINE API:** The exact option to open a mailbox in EXAMINE mode via imapflow `^1.0.158` is not confirmed. Only affects the deferred IMAP-level read-only differentiator — does not block Phase 1 or Phase 2 core work. Verify against imapflow source before implementing.
- **Test infrastructure for `process.argv` stubbing:** The research assumes standard Node.js test patterns but does not audit the existing test runner configuration. Confirm the test runner can override `process.argv` for flag-parsing unit tests before Phase 1 implementation begins.

## Sources

### Primary (HIGH confidence)
- `src/index.ts` — tool list (14 tools), dispatch pattern, `McpError`/`ErrorCode` usage, error response shape
- `src/services/mail.ts` — `MailService` constructor, SMTP connect pattern
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/types.d.ts` — `ToolAnnotationsSchema`, `InitializeResultSchema.instructions`, `ListResourcesRequestSchema`, `ReadResourceRequestSchema`
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.d.ts` — `Server` class, `ServerOptions.instructions`
- Node.js 20 `util.parseArgs` — verified against Node 20.19.0 runtime in this repo
- `.planning/PROJECT.md` — ROM-01 through ROM-04 requirements

### Secondary (MEDIUM confidence)
- MCP Specification (https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tool annotations semantics, `InitializeResult` structure
- RFC 3501 (IMAP4rev1) — EXAMINE vs SELECT semantics; informs `modify_labels` classification
- RFC 6154 (IMAP SPECIAL-USE) — special folder name resolution

### Tertiary (LOW confidence)
- imapflow EXAMINE support — referenced in documentation but exact API option for `^1.0.158` not confirmed against source; needs validation before implementation

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
