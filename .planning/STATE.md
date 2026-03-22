---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: public-release-cicd
status: active
last_updated: "2026-03-22T00:00:00.000Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Mail MCP Server

## Project Reference

**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.
**Current Focus:** Milestone v1.2 — Public Release & CI/CD

## Current Position

Phase: 7 — npm Package Setup
Plan: —
Status: Ready to plan
Last activity: 2026-03-22 — Roadmap created for v1.2

```
Phase 7 [          ] 0%   npm Package Setup
Phase 8 [          ] 0%   GitHub Repository
Phase 9 [          ] 0%   GitHub Actions
```

## Performance Metrics

- **Phases Completed:** 0/3 (v1.2)
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

## Session Continuity

**Last Action:** Roadmap created for v1.2 (Phases 7–9 defined, 9/9 requirements mapped).
**Next Step:** Run `/gsd:plan-phase 7` to plan npm package setup.
**Context for Next Agent:** v1.1 complete (6 phases, 28 requirements). v1.2 adds 3 phases (7–9). Phase 7 configures package.json for `@honest-magic/mail-mcp` (name, version, bin, files, publishConfig) and verifies `npm run build` produces a self-contained dist/index.js with shebang. Phase 8 creates the public GitHub repo at `github.com/honest-magic/mail-mcp` and writes the consumer-facing README. Phase 9 adds `.github/workflows/ci.yml` (tsc + test on push/PR to main) and `.github/workflows/publish.yml` (npm publish on v* tag, needs: ci).
