---
gsd_state_version: 1.0
milestone: v1.0.0
milestone_name: milestone
status: unknown
stopped_at: Completed 08-github-repository 08-02-PLAN.md
last_updated: "2026-03-22T07:52:38.009Z"
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 14
  completed_plans: 11
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Phase 08 — github-repository

## Current Position

Phase: 9
Plan: Not started

## Performance Metrics

- **Phases Completed:** 1/3 (v1.2)
- **Requirements Covered:** 4/9 (v1.2 requirements pending)
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
- **npm Package Name:** `@honest-magic/mail-mcp`, version `1.0.0`, scoped public under `honest-magic` org.
- **bin Entry:** `"mail-mcp": "dist/index.js"` — enables `npx @honest-magic/mail-mcp` and `npm install -g @honest-magic/mail-mcp`.
- **Publish Strategy:** Simple tag-based (push `v*` tag → publish). No semantic-release or changesets.
- **CI Gate:** Publish workflow has `needs: ci` — broken builds cannot publish.

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
| Phase 07-npm-package-setup P01 | 10 | 2 tasks | 2 files |
| Phase 08-github-repository P01 | 75s | 1 tasks | 1 files |
| Phase 08-github-repository P02 | 4 minutes | 2 tasks | 0 files |

## Session Continuity

**Last Action:** Completed Phase 7 (npm-package-setup) — package.json configured as @honest-magic/mail-mcp with bin, files, publishConfig, MIT LICENSE created. PKG-01 through PKG-04 validated.
**Next Step:** Execute Phase 8 (github-readme) — create public GitHub repo at github.com/honest-magic/mail-mcp and write consumer-facing README.
**Stopped At:** Completed 08-github-repository 08-02-PLAN.md
**Context for Next Agent:** Phase 7 complete. package.json is @honest-magic/mail-mcp, bin=mail-mcp->dist/index.js, files=[dist,README.md,LICENSE], publishConfig.access=public, MIT LICENSE exists. npm pack --dry-run confirms correct tarball. Phase 8 creates GitHub repo and README.md (which is already referenced in files field). Phase 9 adds .github/workflows/ci.yml and publish.yml.
