# Retrospective: Mail MCP Server

## Milestone: v1.0.0 — Mail MCP Server

**Shipped:** 2026-03-22
**Phases:** 9 | **Plans:** 16 | **Timeline:** 2 days

### What Was Built

- 14 MCP tools covering the full email lifecycle (read, search, send, thread, organize, attach)
- macOS Keychain credential storage + OAuth2 with token refresh for Gmail/Outlook
- Thread reconstruction using x-gm-thrid (Gmail) + RFC 5256 header fallback
- Batch operations (up to 100 emails per call) with UID-based IMAP sequences
- Read-only mode: startup flag, write blocking, tool list filtering, MCP handshake instructions, SMTP skip
- Published as `@honest-magic/mail-mcp` on npm with GitHub Actions CI + tag-based publish

### What Worked

- **GSD wave execution**: Plans 02–04 of Phase 1 were already implemented; GSD correctly detected existing SUMMARYs and skipped, keeping execution atomic
- **Verification depth**: Verifiers caught a stale VERIFICATION.md stub (Phase 1) and replaced it with real evidence from code inspection
- **Integration checker**: Caught orphaned `Credentials` interface and confirmed all 14 tool dispatch chains are wired end-to-end
- **Read-only as a startup contract**: Single `--read-only` flag controlling 4 enforcement points (list, call, SMTP, handshake) proved clean to implement and verify

### What Was Inefficient

- Many phases had code already implemented from prior sessions — plans documented existing work rather than driving new work. Useful for validation but creates overhead.
- SUMMARY.md one-liner extraction returned nulls for most plans (fields not populated) — integration checker had to fall back to reading full files
- Phase 01 plans were numbered 01-01 through 01-04 but only 01-01 was missing its SUMMARY — ordering was confusing initially

### Patterns Established

- MCP tools always route through `MailService` — never call `ImapClient`/`SmtpClient` directly from handlers
- WRITE_TOOLS Set as single source of truth for read-only enforcement — referenced in exactly 4 places
- `getValidAccessToken()` called on every `connect()` — stateless token refresh, no background timer needed
- Thread ID surfaced in `read_email` output to enable chaining into `get_thread`

### Key Lessons

- Audit + complete-milestone lifecycle is worth running even on fast milestones — the integration checker caught a real orphan and verified all 30 requirement chains in minutes
- For projects that pre-exist planning, GSD works well as documentation/validation layer — execution confirms rather than creates
- NPM_TOKEN must be set before the first publish tag; document this in the README or the first `git push v*` will fail silently

### Cost Observations

- Model mix: sonnet throughout (executor + verifier)
- Sessions: ~3 sessions across 2 days
- Notable: Integration check over 30 requirements completed in one agent call with no tool failures

---

## Cross-Milestone Trends

| Metric | v1.0.0 |
|--------|--------|
| Phases | 9 |
| Plans | 16 |
| Tests at ship | 55 |
| Verification pass rate | 9/9 (100%) |
| Requirements satisfied | 30/30 |
| Days to ship | 2 |
