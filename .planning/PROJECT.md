# Mail MCP Server

## What This Is

A local Model Context Protocol (MCP) server that provides tools and resources to interact with a mailbox via IMAP and SMTP. It allows AI models to search, read, list, and send emails, as well as manage threads and perform automated workflows like summarization and filtering.

## Core Value

Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **IMAP-01**: Access mailbox via IMAP (list folders, fetch messages)
- [ ] **IMAP-02**: Search and filter emails based on criteria (sender, date, subject)
- [ ] **SMTP-01**: Send emails via SMTP with support for attachments
- [ ] **THRD-01**: Thread/Conversation support (grouping related messages)
- [ ] **WORK-01**: Smart workflows (summarization, action item extraction)
- [ ] **ORG-01**: Mailbox organization (moving, tagging, bulk actions)
- [ ] **RES-01**: Resource access (mailbox structure, contacts)

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

---
*Last updated: 2026-03-21 after initial questioning*
