---
gsd_state_version: 1.0
milestone: v1.4.0
milestone_name: AI Mail Assistant Features
status: roadmap_ready
stopped_at: Completed 29-01-PLAN.md (Confirmation Mode — --confirm flag with two-step write gate)
last_updated: "2026-03-26T19:57:00Z"
progress:
  total_phases: 16
  completed_phases: 12
  total_plans: 13
  completed_plans: 13
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 29 — Confirmation Mode (complete)

## Current Position

Phase: 29 (complete)
Plan: 01 (complete)

## Accumulated Context

### Key Decisions

Carried from v1.2.0 — see PROJECT.md Key Decisions table for full history.

- **17-01**: `signature` is `z.string().optional()` — accounts without signature remain valid; no forced migration needed
- **17-01**: `includeSignature` not in `required` array on tool schemas; default-true behavior handled in plan 17-02
- **17-02**: `applySignature` exported (not private) to enable direct unit testing of the pure function
- **17-02**: Default-true implemented via `args.includeSignature !== false` pattern (handles undefined/true/false correctly)
- **18-01**: TTL and maxSize injected via constructor defaults to allow test-time override without module mutation
- **18-01**: `size` getter reports raw store count (Map semantics) — avoids O(n) scan; stale entries counted until next `get()`
- **18-02**: `invalidateBodyCache` placed as public method on MailService (cache is owned by MailService, not ImapClient); no try/catch needed as in-memory delete cannot throw
- **19-01**: `parseUnsubscribeHeader` as private helper keeps `readEmail()` readable; https URLs output before mailto per RFC 2369 preference; mailto prefix stripped to show bare address
- **20-01**: `SmtpClient.send()` extended with optional `extraHeaders?: Record<string, string>` as 7th param (backward-compatible)
- **20-01**: `replyEmail()` uses `_cachedFetchBody()` internally — reuses body cache from Phase 18
- **20-01**: `forwardEmail()` does not set In-Reply-To/References — forwards break thread chain per convention
- **20-01**: `reply_email` `to` address auto-determined from original sender (not a required input param)
- **20-01**: `forward_email` validates `to` address via `validateEmailAddresses` before calling service
- **21-01**: `scanSenderEnvelopes` uses envelope-only fetch (no bodyParts) — lighter than `listMessages` for bulk scans
- **21-01**: Aggregation in `MailService.extractContacts`, not `ImapClient` — business logic vs protocol adapter separation
- **21-01**: Name from most-recent message wins when same email appears with multiple display names
- **21-01**: Count capped at 500 in ImapClient; output capped at 50 contacts in MailService
- **23-01**: `headerOnly` defaults to `false` for full backward compatibility — no behavior change for existing callers
- **23-01**: `ImapClient.listMessages` extended with 4th param (not a new method) to keep API surface minimal
- **23-01**: `snippet` is always `''` when `headerOnly=true`; no special marker needed
- **24-01**: Templates stored in `~/.config/mail-mcp/templates.json` — separate file from accounts.json, same fs.watch cache pattern
- **24-01**: `use_template` is read-only — resolves template to args only; AI calls `send_email`/`create_draft` separately
- **24-01**: `{{variable}}` regex replaces all occurrences globally; unknown placeholders left intact for AI awareness
- **24-01**: `list_templates` with `accountId` returns global (no accountId) + account-scoped templates; omit returns all
- **26-01**: mark_read/unread/star/unstar are thin wrappers calling service.modifyLabels() with \Seen/\Flagged flags
- **26-01**: All 4 are write tools (readOnlyHint:false, destructiveHint:true), folder defaults to INBOX
- **26-01**: Dispatch handlers placed in dispatchTool() using name param (not request.params.name)
- **30-01**: `allowedTools` stored as instance field on `MailMCPServer`; constructor throws if both `readOnly=true` and `allowedTools` provided
- **30-01**: `getTools()` extended with optional `allowedTools?: Set<string>` — read tools always pass, write tools filtered by Set membership
- **30-01**: `--allow-tools` CLI flag is comma-split string → `Set<string>`; mutually exclusive with `--read-only` enforced at CLI and constructor
- **29-01**: `confirmMode` as 4th MailMCPServer constructor param (after readOnly, allowedTools, auditLogger) for backward compatibility
- **29-01**: `ConfirmationStore.consume()` is single-use and removes entry on call; prevents replay attacks
- **29-01**: `buildConfirmationDescription()` is module-level function — human-readable action summary for all 15 write tools
- **29-01**: `confirmationId` stripped from args before replay on second call

### Critical Blockers

- None identified.

### Technical Debt / Todo

- (none)

## Performance Metrics

| Phase | Plan | Duration (s) | Tasks | Files |
|-------|------|-------------|-------|-------|
| 20 | 01 | 415 | 4 | 6 |
| 21 | 01 | 345 | 6 | 6 |
| 23 | 01 | 156 | 4 | 5 |
| 24 | 01 | 25 | 3 | 4 |
| 26 | 01 | 389 | 2 | 2 |
| Phase 25 P01 | 583 | 6 tasks | 7 files |
| Phase 30 P01 | 411 | 3 tasks | 2 files |
| Phase 28 P01 | 1080 | 4 tasks | 5 files |

## Session Continuity

**Last Action:** Completed Phase 26 Plan 01 — Mark Read/Star Tools (mark_read, mark_unread, star, unstar).
**Stopped At:** Completed 28-01-PLAN.md (Audit Logging — JSONL audit log with --audit-log flag)
**Next Step:** Run `/gsd:execute-phase` to continue with next phase.
