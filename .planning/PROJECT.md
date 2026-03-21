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
- [ ] **ROM-04**: Server exposes its current mode so MCP clients can adapt
- [ ] **ROM-07**: SMTP connection skipped when server starts with --read-only

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

## Current Milestone: v1.1 Read-Only Mode

**Goal:** Add a startup flag that restricts the server to read-only operations, preventing any email mutations.

**Target features:**
- `--read-only` startup flag
- Write tools blocked with clear error in read-only mode
- Read/search tools unaffected
- Mode discoverable by MCP clients

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
*Last updated: 2026-03-21 — Milestone v1.1 started*
