# Requirements: Mail MCP Server

**Defined:** 2026-03-21
**Core Value:** Empower AI agents to act as a personal mail assistant by providing structured, tool-based access to existing email accounts through standard protocols.

## v1 Requirements (Completed — Milestone v1.0)

All 21 v1 requirements validated and shipped. See ROADMAP.md and individual phase verifications.

### Security (AUTH)
- [x] **AUTH-01**: Secure credential storage using macOS Keychain (no plaintext passwords)
- [x] **AUTH-02**: Support for standard IMAP/SMTP authentication (User/Password/App Passwords)
- [x] **AUTH-03**: TLS/SSL encryption for all protocol communication
- [x] **AUTH-04**: OAuth2 support for Gmail/Outlook (more secure connection)

### IMAP Access & Search (IMAP)
- [x] **IMAP-01**: List recent messages with snippets and metadata
- [x] **IMAP-02**: Fetch full message content (sanitized to Markdown for LLMs)
- [x] **IMAP-03**: Advanced search (by sender, subject, date, keywords)
- [x] **IMAP-04**: List and select available folders/labels

### SMTP Sending & Drafting (SMTP)
- [x] **SMTP-01**: Send new emails via SMTP with support for HTML and text bodies
- [x] **SMTP-02**: Support for multiple recipients (CC/BCC)
- [x] **SMTP-03**: Create drafts in the "Drafts" folder (Human-in-the-loop safety)
- [x] **SMTP-04**: Automatically sync sent emails to the IMAP "Sent" folder via `APPEND`

### Threading & Conversations (THRD)
- [x] **THRD-01**: Group messages by `threadId` using Message-ID/References headers
- [x] **THRD-02**: Fetch all messages in a specific thread for full conversation context
- [x] **THRD-03**: Provide summarization-friendly thread views (token-efficient)

### Organization & Bulk Actions (ORG)
- [x] **ORG-01**: Move messages between folders (Archive, Trash, Spam)
- [x] **ORG-02**: Add or remove labels/tags (for providers that support them)
- [x] **ORG-03**: Batch operations (apply actions to many emails in one call)

### Attachments & Resources (RES)
- [x] **RES-01**: List attachment metadata (filename, size, MIME type)
- [x] **RES-02**: Fetch attachment content on-demand via MCP Resource URIs
- [x] **RES-03**: Extract text from PDFs and common document types for AI reasoning

## v1.1 Requirements

### Read-Only Mode (ROM)

- [ ] **ROM-01**: User can start the server with a `--read-only` flag to restrict it to read operations only
- [ ] **ROM-02**: In read-only mode, write tools (`send_email`, `create_draft`, `move_email`, `modify_labels`, `batch_operations`, `register_oauth2_account`) return a descriptive refusal error naming the blocked tool and active mode
- [ ] **ROM-03**: In read-only mode, all read and search tools (`list_emails`, `read_email`, `search_emails`, `list_folders`, `get_thread`, `list_attachments`, `get_attachment`) function normally without modification
- [ ] **ROM-04**: Server communicates its current mode to MCP clients automatically at handshake via the `instructions` field on `InitializeResult`
- [ ] **ROM-05**: Write tools are filtered out of the `tools/list` response when the server is in read-only mode, preventing LLM planning of blocked operations
- [ ] **ROM-06**: All 14 tools declare `readOnlyHint` and `destructiveHint` MCP tool annotations
- [ ] **ROM-07**: SMTP connection is skipped when the server starts with `--read-only`, avoiding unnecessary authentication

## v2 Requirements (Deferred)

- **REAL-01**: Real-time push updates via IMAP IDLE
- **CONT-01**: Advanced contact lookup and history enrichment
- **AI-01**: Proactive inbox triage suggestions (auto-tagging based on AI rules)
- **ROM-08**: IMAP mailbox opened with `EXAMINE` instead of `SELECT` in read-only mode, preventing implicit `\Seen` flag mutation on reads

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mail Server Hosting | This is a client-only bridge/adapter |
| Full Local Sync | Should act as a gateway; real-time interaction preferred over local DB |
| Proprietary API wrapper | Focus on IMAP/SMTP for maximum compatibility |
| Runtime mode toggle | Mode is a startup contract; toggling at runtime adds significant complexity for minimal gain |
| Per-tool granular allow-listing | Binary read/write mode is sufficient; per-tool exceptions add unnecessary surface area |
| Silent no-op on blocked write tools | Deceptive to LLM; always return explicit `isError: true` |

## Traceability

### v1.0 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| IMAP-01 | Phase 1 | Complete |
| IMAP-02 | Phase 1 | Complete |
| IMAP-03 | Phase 2 | Complete |
| IMAP-04 | Phase 2 | Complete |
| SMTP-01 | Phase 1 | Complete |
| SMTP-02 | Phase 2 | Complete |
| SMTP-03 | Phase 1 | Complete |
| SMTP-04 | Phase 1 | Complete |
| THRD-01 | Phase 3 | Complete |
| THRD-02 | Phase 3 | Complete |
| THRD-03 | Phase 3 | Complete |
| ORG-01 | Phase 2 | Complete |
| ORG-02 | Phase 2 | Complete |
| ORG-03 | Phase 4 | Complete |
| RES-01 | Phase 3 | Complete |
| RES-02 | Phase 3 | Complete |
| RES-03 | Phase 3 | Complete |

### v1.1 (Active)

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROM-01 | Phase 5 | Pending |
| ROM-02 | Phase 5 | Pending |
| ROM-03 | Phase 5 | Pending |
| ROM-04 | Phase 5 | Pending |
| ROM-05 | Phase 5 | Pending |
| ROM-06 | Phase 5 | Pending |
| ROM-07 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after v1.1 milestone definition*
