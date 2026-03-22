---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-22T06:47:47.645Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 11
  completed_plans: 8
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 06 — mode-discoverability-connection-hygiene

## Current Position

Phase: 06 (mode-discoverability-connection-hygiene) — COMPLETE
Plan: 1 of 1 (DONE)

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
| Phase 06-mode-discoverability-connection-hygiene P01 | 1 | 2 tasks | 4 files |

## Session Continuity

**Last Action:** Completed 06-01-PLAN.md — ROM-04 (instructions in MCP handshake) and ROM-07 (SMTP skip in read-only mode) implemented.
**Next Step:** Run `/gsd:transition` or `/gsd:complete-milestone` to close v1.1 and update PROJECT.md.
**Context for Next Agent:** v1.1 complete. All 7 ROM requirements implemented across Phases 5 and 6. Phase 5 added --read-only flag, write blocking, tool filtering, and annotations. Phase 6 added MCP handshake instructions and SMTP skip. ROM-08 (IMAP EXAMINE) deferred to v2.
