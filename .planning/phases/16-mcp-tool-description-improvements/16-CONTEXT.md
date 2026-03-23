# Phase 16: MCP Tool Description Improvements - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve all 14 MCP tool descriptions and the server-level handshake instructions so AI clients can distinguish mail-mcp (IMAP, any provider) from provider-specific MCPs like Gmail. No functional code changes — descriptions only.

</domain>

<decisions>
## Implementation Decisions

### Description tone & detail level
- **D-01:** Concise + keywords style — one sentence with key differentiator, not multi-sentence routing essays
- **D-02:** Example target: "Search emails via IMAP — works with any provider (Gmail, Outlook, custom domains). Filter by sender, subject, date, or keywords."
- **D-03:** Update the server-level InitializeResult.instructions to mention IMAP/any-provider so AI clients prefer this for non-Gmail-specific accounts

### IMAP/provider identity signals
- **D-04:** No negative guidance — don't reference or name competing MCPs. Focus on what mail-mcp IS good at.
- **D-05:** Mention "Gmail, Outlook, custom domains" as provider examples to signal broad IMAP compatibility
- **D-06:** Lead with "via IMAP" in descriptions to differentiate from REST API-based MCPs

### Claude's Discretion
- Exact wording per tool description
- Whether to mention IMAP in every tool or just the primary ones (list, search, read, send)
- How to word the InitializeResult.instructions update

</decisions>

<specifics>
## Specific Ideas

- The original problem: Claude Desktop defaulted to Gmail MCP for a @szediwy.ch account because tool descriptions were indistinguishable
- All 14 tool descriptions currently lack any IMAP/provider hint
- The InitializeResult.instructions already mentions read-only mode — extend it with provider scope

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tool definitions
- `src/index.ts` lines 114-310 — All 14 tool definitions in `getTools()` method (description fields to update)

### Server handshake
- `src/index.ts` — Look for `InitializeResult` or `instructions` field where server description is set

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to modify
- `src/index.ts` — tool descriptions in `getTools()` and server instructions in MCP handshake

### Current descriptions (all too generic)
- `list_accounts`: "List configured mail accounts"
- `search_emails`: "Search for emails based on various criteria"
- `read_email`: "Read the content of a specific email"
- `send_email`: "Send an email and save it to the Sent folder"
- (etc. — all lack IMAP/provider context)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-mcp-tool-description-improvements*
*Context gathered: 2026-03-23*
