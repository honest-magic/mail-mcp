---
phase: 16
plan: 01
status: complete
started: 2026-03-23
completed: 2026-03-23
---

# Plan 16-01 Summary

## One-liner

Updated all 14 MCP tool descriptions and server handshake with IMAP/provider identity signals for better AI client routing.

## What Changed

### Tool descriptions (14 updated)
- Primary tools (list_emails, search_emails, read_email, send_email) now lead with "via IMAP"
- All descriptions mention provider compatibility (Gmail, Outlook, custom domains)
- No negative guidance or competitor references
- Concise one-sentence format per D-01/D-02

### Server instructions
- Always present in both modes (was: only read-only)
- Leads with: "Use mail-mcp for IMAP-based email accounts"
- Read-only notice appended conditionally

### Tests
- ROM-04 tests P and Q updated to match new always-present instructions behavior

## Key Files

- `src/index.ts` — tool descriptions in getTools() + server instructions
- `src/index.test.ts` — updated ROM-04 assertions

## Commits

- `65daa6e` — feat(16-01): update all MCP tool descriptions with IMAP/provider signals

## Self-Check: PASSED

177 tests pass. TypeScript compiles clean. No old generic descriptions remain.
