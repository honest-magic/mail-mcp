# Mail MCP Server

## What This Is

A local Model Context Protocol (MCP) server that provides tools and resources to interact with a mailbox via IMAP and SMTP. It allows AI models to search, read, list, and send emails, as well as manage threads and perform automated workflows like summarization and filtering.

## Core Value

Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.

## Requirements

### Validated

- [x] **AUTH-01–04**: Secure credential storage via macOS Keychain; TLS/SSL + OAuth2 — *Validated in Phase 1: Secure Connectivity & Basic Messaging*
- [x] **IMAP-01–04**: IMAP connection, message listing, reading, searching, folder management — *Validated in Phase 1 & 2*
- [x] **SMTP-01–04**: SMTP send, draft creation, CC/BCC — *Validated in Phase 1 & 2*
- [x] **ORG-01–02**: Move messages, label/flag management — *Validated in Phase 2: Discovery & Organization*
- [x] **THRD-01–03**: Thread reconstruction, conversation view — *Validated in Phase 3: Context & Resources*
- [x] **RES-01–03**: Attachment metadata, content on-demand, PDF extraction — *Validated in Phase 3: Context & Resources*
- [x] **ORG-03**: Batch operations (move, delete, label) up to 100 emails — *Validated in Phase 4: Efficiency & Scale*

### Active

- [x] **ROM-01**: Server can be started with a `--read-only` flag — *Validated in Phase 5: Read-Only Enforcement*
- [x] **ROM-02**: In read-only mode, write tools return a clear refusal error — *Validated in Phase 5*
- [x] **ROM-03**: In read-only mode, all read/search tools function normally — *Validated in Phase 5*
- [x] **ROM-05**: Write tools filtered from tools/list in read-only mode — *Validated in Phase 5*
- [x] **ROM-06**: All 14 tools annotated with readOnlyHint/destructiveHint — *Validated in Phase 5*
- [x] **ROM-04**: Server exposes its current mode so MCP clients can adapt — *Validated in Phase 6: Mode Discoverability & Connection Hygiene*
- [x] **ROM-07**: SMTP connection skipped when server starts with --read-only — *Validated in Phase 6*

### v1.2 Active

- [x] **GH-01**: Public repo `github.com/honest-magic/mail-mcp` exists with all existing commits pushed — *Validated in Phase 8: GitHub Repository*
- [x] **GH-02**: Repository has a README.md suitable for public consumers (install, config, usage) — *Validated in Phase 8*
- [x] **PKG-01**: `package.json` has `name: "@honest-magic/mail-mcp"`, `version: "1.0.0"`, `publishConfig.access: "public"` — *Validated in Phase 7: npm Package Setup*
- [x] **PKG-02**: `package.json` has a `bin` entry enabling `npx @honest-magic/mail-mcp` and global install — *Validated in Phase 7*
- [x] **PKG-03**: `package.json` `files` field scopes the published artifact to `dist/`, `README.md`, `LICENSE` only — *Validated in Phase 7*
- [x] **PKG-04**: Build script produces a self-contained `dist/` that runs without dev dependencies — *Validated in Phase 7*
- [ ] **GHA-01**: CI workflow runs `tsc --noEmit` + `npm test` on push to `main` and on pull requests
- [ ] **GHA-02**: Publish workflow triggers on `v*` tag push and publishes `@honest-magic/mail-mcp` to npm
- [ ] **GHA-03**: Publish workflow requires CI to pass before publishing

### Out of Scope

- Hosting a mail server (this is a client/adapter only)
- Proprietary APIs (Gmail/Outlook specific APIs) unless fallback to IMAP is unavailable
- Permanent local storage of full mailbox (should act as a real-time gateway)

## Context

- The user wants a local server for personal use.
- Implementation preferred in Go or TypeScript/Node.js.
- Credentials handling (security) needs further discussion but must be secure.

## Constraints

- **Protocol**: Must use IMAP/SMTP for broad compatibility.
- **Environment**: Must run locally on macOS (Darwin).
- **Interface**: Must adhere to the Model Context Protocol (MCP) specification.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Language Choice | TypeScript/Node.js selected for rich MCP SDK support and async handling | ✓ Good |

## Previous Milestone: v1.1 Read-Only Mode — Complete ✓

**Delivered (all 7 requirements validated):**
- `--read-only` startup flag, write blocking, tool filtering, MCP handshake instructions, SMTP skip

## Current Milestone: v1.2 — Public Release & CI/CD

**Goal:** Publish the server as `@honest-magic/mail-mcp` on npm, create a public GitHub repo under `honest-magic`, and add GitHub Actions for CI and tag-based npm publish.

**Target features:**
- Public GitHub repo at `github.com/honest-magic/mail-mcp`
- Consumer-facing README
- npm package configured for `npx @honest-magic/mail-mcp` and global install
- CI workflow (type-check + tests on push/PR)
- Publish workflow (npm publish on `v*` tag)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 — Phase 8 complete (public GitHub repo live at github.com/honest-magic/mail-mcp)*
