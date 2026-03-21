---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-21T21:31:28.876Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 10
  completed_plans: 7
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 5 — Read-Only Enforcement

## Current Position

Phase: 6
Plan: Not started

## Performance Metrics

- **Phases Completed:** 4/6
- **Requirements Covered:** 21/28 (v1.0 done; v1.1 pending)
- **Current Velocity:** 1 phase/session

## Accumulated Context

### Key Decisions

- **Stack:** Node.js with TypeScript.
- **Protocol:** IMAP/SMTP via `imapflow` and `nodemailer`.
- **Security:** Use macOS Keychain via `cross-keychain`.
- **Infrastructure:** Local Model Context Protocol (MCP) server.
- **Search:** Support unified search interface (from, subject, since, before).
- **Organization:** Unified tool for moving emails and separate tool for labels (flags).
- **Threading:** Use header-based reconstruction (Message-ID, References) with X-GM-EXT-1 optimization.
- **Attachments:** Return metadata first, fetch content on-demand via tools/resources.
- **PDF Extraction:** Use `pdf-parse`.
- **Batching:** Limit batch operations to 100 emails at once. Use comma-joined UID sequences for imapflow batch calls.
- **Read-Only Mode:** Enforce exclusively at the MCP dispatch layer (`src/index.ts`); service layer has zero knowledge of mode. `WRITE_TOOLS` defined as a module-level `Set<string>` covering all 6 write tools. Mode stored as `private readonly readOnly: boolean` on `MailMCPServer`.
- **Write Refusal Message Format:** Must name the blocked tool and state the mode — e.g. `"Tool 'send_email' is not available: server is running in read-only mode. Use a server without --read-only to perform write operations."`
- **Mode Discovery:** Delivered via `InitializeResult.instructions` at MCP handshake — no extra tool or resource required.
- **SMTP Skip:** Skip `smtpClient.connect()` in `MailService` when `readOnly === true`; IMAP EXAMINE deferred to v2 (ROM-08).

### Critical Blockers

- None identified.

### Technical Debt / Todo

- (none)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260321 | Fix 3 audit gaps: SMTP-04, THRD non-Gmail, IMAP-01 snippet | 2026-03-21 | c6f1bf2 | [260321-fix-audit-gaps](.planning/quick/260321-fix-audit-gaps/) |
| Phase 05-read-only-enforcement P01 | 137 | 2 tasks | 2 files |

## Session Continuity

**Last Action:** Roadmap created for milestone v1.1. Phases 5 and 6 defined with requirements mapped and success criteria derived.
**Next Step:** Run `/gsd:plan-phase 5` to decompose Phase 5 into executable plans.
**Context for Next Agent:** v1.0 complete (4 phases, 21 requirements). v1.1 adds Phases 5–6 (7 requirements: ROM-01 through ROM-07). Phase 5 is all MCP dispatch layer changes in `src/index.ts`. Phase 6 adds `instructions` field and skips SMTP connect in `src/services/mail.ts`. No new dependencies required — `util.parseArgs` is built into Node 20.19.0.
