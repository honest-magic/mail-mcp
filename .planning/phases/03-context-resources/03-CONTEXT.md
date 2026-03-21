# Phase 3: Context & Resources - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhances the AI's ability to reason over full conversations and supplementary files. Delivers full thread reconstruction and attachment handling.

</domain>

<decisions>
## Implementation Decisions

### Threading Strategy
- Use `Message-ID`, `In-Reply-To`, and `References` headers for robust client-side threading.

### Attachment Content Representation
- Return metadata and a reference URI, requiring a separate tool call to fetch/extract content — saves token space.

### PDF Extraction Strategy
- Use `pdf-parse` as a lightweight standard Node library.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/protocol/imap.ts` (ImapClient uses `mailparser` which exposes attachments)
- `src/services/mail.ts` (MailService already handles HTML to markdown)

### Established Patterns
- MCP Resource URIs for file references.
- Deferring large content until explicitly requested.

### Integration Points
- `src/index.ts` where `get_thread` and `download_attachment` tools will be registered.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
