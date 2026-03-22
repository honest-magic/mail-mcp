---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: public-release-cicd
status: active
last_updated: "2026-03-22T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Milestone v1.2 — Public Release & CI/CD

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-22 — Milestone v1.2 started

## Performance Metrics

- **Phases Completed:** 0/TBD
- **Requirements Covered:** 0/9 (v1.2 requirements pending)
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

**Last Action:** Milestone v1.2 started. Requirements defined (GH-01/02, PKG-01–04, GHA-01–03). Roadmap pending.
**Next Step:** Run `/gsd:plan-phase 7` after roadmap is created.
**Context for Next Agent:** v1.1 complete (6 phases, 28 requirements). v1.2 targets public GitHub repo under `honest-magic` org, npm package `@honest-magic/mail-mcp` at version 1.0.0 with `bin` entry for npx/global-install, and GH Actions for CI (test+typecheck) and tag-based npm publish. No new runtime dependencies expected.
