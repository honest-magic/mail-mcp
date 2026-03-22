# Phase 11: Input Validation & Safety Limits - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Malformed inputs and resource-exhausting requests are rejected before any network I/O occurs. Covers VAL-02 (email address validation), SAFE-01 (attachment size limits), SAFE-03 (per-account rate limiting).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from research and Phase 10 context:
- Phase 10 delivered typed error classes in `src/errors.ts` — use `ValidationError` for email/attachment rejections, `QuotaError` for rate limiting
- Email validation: RFC 5322 format check on to/cc/bcc before SMTP send (zero-dependency regex sufficient)
- Attachment size: Check BODYSTRUCTURE size before content download, reject with clear error if > 50MB default
- Rate limiting: In-memory sliding window per account ID (100 req/60s default), no external dependencies
- All guards must return `{ content, isError: true }` not throw `McpError` (H-14 pitfall from research)
- Validation happens at tool dispatch level in `src/index.ts` before service method calls

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/errors.ts` — `ValidationError`, `QuotaError` classes (created in Phase 10)
- `src/index.ts` catch block — already handles `MailMCPError` with typed `[ErrorCode] message` format
- `src/protocol/imap.ts` — `downloadAttachment()` method where size check would be added
- `src/services/mail.ts` — `sendEmail()` and `createDraft()` where email validation would be added

### Established Patterns
- Tool dispatch in `src/index.ts` validates args then calls service methods
- Errors returned as `{ content: [{ type: 'text', text }], isError: true }`
- Module-level constants for limits: `WRITE_TOOLS` pattern
- New utilities go in `src/utils/` directory

### Integration Points
- `src/index.ts`: send_email and create_draft handlers for email validation
- `src/index.ts`: get_attachment and extract_attachment_text handlers for size check
- `src/index.ts` or `src/utils/rate-limiter.ts`: rate limiting at tool dispatch level
- `src/protocol/imap.ts`: BODYSTRUCTURE fetch for attachment size metadata

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
