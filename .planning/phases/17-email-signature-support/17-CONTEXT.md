# Phase 17: Email Signature Support - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-account email signatures that are automatically appended when sending or drafting emails. The AI agent composes the body, mail-mcp transparently appends the signature before sending.

</domain>

<decisions>
## Implementation Decisions

### Signature storage & format
- **D-01:** Store signatures in accounts.json as a `signature` string field per account (optional)
- **D-02:** Plain text only — converted to HTML `<p>` when body is HTML
- **D-03:** Add `signature` as optional field to the Zod emailAccountSchema

### Append behavior
- **D-04:** Default ON — if account has a signature, it's auto-appended to send_email and create_draft
- **D-05:** Opt-out via `includeSignature: false` parameter on send_email and create_draft tools
- **D-06:** Separator: `\n-- \n` (RFC 3676 standard sig delimiter) between body and signature

### AI agent interaction
- **D-07:** Signature is transparent to the AI — it composes the body, mail-mcp appends the signature
- **D-08:** AI can suppress signature per-message via `includeSignature: false`

### Claude's Discretion
- How to handle HTML body + plain text signature (wrap in `<p>` or `<pre>`)
- Whether to add a `mail-mcp accounts set-signature <id>` CLI command
- Test approach for verifying signature append behavior

</decisions>

<specifics>
## Specific Ideas

- The signature field should be optional — accounts without a signature just send the body as-is
- When `isHtml: true` and signature is plain text, wrap signature in `<br><br><p style="white-space: pre-line">-- \n{signature}</p>`
- The `includeSignature` parameter defaults to `true` (not explicitly required by the AI)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Account config
- `src/config.ts` — emailAccountSchema (Zod), ACCOUNTS_PATH, cache with fs.watch

### SMTP send
- `src/protocol/smtp.ts` lines 40-62 — `SmtpClient.send()` builds mail options, signature appended here

### Draft creation
- `src/services/mail.ts` line 79 — `MailService.createDraft()` — signature appended here too

### Tool definitions
- `src/index.ts` lines 174-210 — send_email and create_draft tool schemas (add includeSignature param)

</canonical_refs>

<code_context>
## Existing Code Insights

### Integration Points
- `SmtpClient.send()` in smtp.ts — append signature to body/html before `transporter.sendMail()`
- `MailService.createDraft()` in mail.ts — append signature before IMAP append
- `emailAccountSchema` in config.ts — add optional `signature: z.string().optional()`
- send_email and create_draft tool schemas in index.ts — add `includeSignature` boolean param

### Established Patterns
- Zod validation with `.optional()` for non-required fields (see smtpHost, smtpPort)
- Account config cached in memory with fs.watch invalidation
- Tool parameters use `type: 'boolean'` with description in inputSchema

</code_context>

<deferred>
## Deferred Ideas

- CLI command `mail-mcp accounts set-signature <id>` — nice but not essential for v1.3.0
- Signature templates with variables (e.g., {name}, {date}) — over-engineering for now

</deferred>

---

*Phase: 17-email-signature-support*
*Context gathered: 2026-03-23*
