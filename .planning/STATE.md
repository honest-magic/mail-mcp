---
gsd_state_version: 1.0
milestone: v1.4.0
milestone_name: AI Mail Assistant Features
status: roadmap_ready
last_updated: "2026-03-26T20:06:30Z"
progress:
  total_phases: 16
  completed_phases: 2
  total_plans: 2
  completed_plans: 2
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 21 — Contact Extraction

## Current Position

Phase: 20 (complete)
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

### Critical Blockers

- None identified.

### Technical Debt / Todo

- (none)

## Performance Metrics

| Phase | Plan | Duration (s) | Tasks | Files |
|-------|------|-------------|-------|-------|
| 20 | 01 | 415 | 4 | 6 |

## Session Continuity

**Last Action:** Completed Phase 20 Plan 01 — Reply & Forward Threading.
**Stopped At:** Completed 20-01-PLAN.md
**Next Step:** Run `/gsd:execute-phase 21` or `/gsd:autonomous` to continue.
