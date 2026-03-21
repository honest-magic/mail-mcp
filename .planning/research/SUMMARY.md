# Research Summary: Mail MCP Server

## Executive Summary

The Mail MCP project aims to build a robust Model Context Protocol (MCP) server that enables AI models to interact with email accounts via IMAP and SMTP. This integration allows agents to search, read, draft, and send emails, facilitating workflows like automated triage, meeting preparation, and follow-ups. The project prioritizes security, thread awareness, and "human-in-the-loop" safety patterns.

The recommended approach involves a Node.js-based architecture using `imapflow` for IMAP, `nodemailer` for SMTP, and `mailparser` for MIME handling. This stack provides modern async/await support, robust connection management, and stable protocol implementation. Key architectural patterns include using the macOS Keychain for credential storage, reference-based attachment handling to save tokens, and leveraging standard email headers (Message-ID, In-Reply-To, References) for conversation threading.

Critical risks include the complexity of IMAP synchronization (UIDVALIDITY), the need to manually sync sent emails to the "Sent" folder via IMAP `APPEND`, and the nuances of Gmail's label-based system versus traditional folders. Mitigation strategies involve implementing strict protocol checks, using provider-specific extensions where available, and defaulting to safe actions like creating drafts rather than direct sending.

## Key Findings

### From STACK.md
- **Primary Stack:** Node.js with `imapflow` (IMAP client), `nodemailer` (SMTP client), and `mailparser` (MIME parsing).
- **Rationale:** High maintenance, native async/await support, built-in IDLE detection, and excellent attachment/threading capabilities.
- **Security:** Requires TLS 1.2/1.3 and STARTTLS support.

### From FEATURES.md
- **Table Stakes:** Search & List, Read Email (Markdown-friendly), Send/Reply, Draft Management, Attachment Metadata.
- **Differentiators:** Thread Awareness (conversation context), Bulk Actions (triage), Contact Lookup, Attachment Retrieval (on-demand), Folder/Label Management.
- **Anti-Features:** Raw HTML (wastes tokens), Auto-Send (default), Plaintext Password Storage.

### From ARCHITECTURE.md
- **Tiered Structure:** MCP Layer (JSON-RPC) -> Service Layer (Business Logic) -> Protocol Layer (IMAP/SMTP).
- **Security Pattern:** Use macOS Keychain (`cross-keychain`) for credential storage to avoid plaintext leaks.
- **Attachment Pattern:** Reference-based storage; store locally and provide MCP Resource URIs, fetching content only on-demand.
- **Performance:** Connection pooling via `imapflow`, IMAP IDLE for real-time updates, and header caching for fast searching.

### From PITFALLS.md
- **UIDVALIDITY:** Local cache must be invalidated if the server resets UIDs to avoid data corruption.
- **Sent Sync:** SMTP sends do not automatically appear in IMAP "Sent" folders; requires manual `APPEND` command.
- **Gmail Labels:** Messages can appear in multiple folders; use `X-GM-MSGID` to identify unique messages.
- **Connection Zombies:** IDLE connections need periodic heartbeats (`NOOP`) to avoid silent firewall drops.

## Implications for Roadmap

### Suggested Phase Structure

1.  **Phase 1: Basic Connectivity & Security (Foundation)**
    - **Rationale:** Establishes secure access and basic communication before building complex logic.
    - **Delivers:** Secure credential storage (Keychain), IMAP connection, basic listing, and "Safe" SMTP (with IMAP `APPEND`).
    - **Features:** `list_messages`, `get_message`, `send_message`, `create_draft`.
    - **Pitfalls:** Credential exposure, missing "Sent" folder sync.

2.  **Phase 2: Core Triage & Search (Context)**
    - **Rationale:** Enables the AI to find and understand information, the precursor to advanced actions.
    - **Delivers:** Advanced search, folder management, and basic threading.
    - **Features:** `search_messages`, `modify_labels`, `list_labels`, `archive_message`.
    - **Pitfalls:** UIDVALIDITY issues, connection timeouts.

3.  **Phase 3: Advanced Conversation & Attachments (Intelligence)**
    - **Rationale:** Enhances the AI's ability to reason over full conversations and supplementary files.
    - **Delivers:** Full thread reconstruction and attachment handling.
    - **Features:** `get_thread`, `download_attachment`, `reply_to_message`.
    - **Pitfalls:** Attachment bloat (token exhaustion), Gmail label duplicates.

4.  **Phase 4: Bulk Automation & Optimization (Scale)**
    - **Rationale:** Focuses on efficiency and high-volume tasks once the foundation is rock-solid.
    - **Delivers:** Batch operations and caching for performance.
    - **Features:** `batch_modify`, `search_contacts`, header caching.
    - **Pitfalls:** Rate limiting, accidental mass deletion.

### Research Flags
- **Needs research:** `Phase 3 (Attachment Retrieval)` - Specifically, strategies for cleaning/summarizing different file types (PDF, Docx) for LLM ingestion.
- **Needs research:** `Phase 4 (Contact Lookup)` - Cross-referencing email addresses with other contact providers (Google, iCloud).
- **Standard patterns:** Phase 1 & 2 follow well-documented IMAP/SMTP and MCP patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `imapflow` and `nodemailer` are industry standards for Node.js mail. |
| Features | HIGH | Clear mapping of AI needs to email capabilities. |
| Architecture | HIGH | Standard tiered approach with clear security/performance patterns. |
| Pitfalls | HIGH | Deep understanding of IMAP/SMTP edge cases and Gmail-specific quirks. |

### Gaps to Address
- **Cross-Platform Keychain:** Specific implementation for Windows/Linux if project expands beyond macOS.
- **OAuth2 Integration:** Detailed flows for Google/Microsoft accounts (more complex than app passwords).

## Sources
- [ImapFlow Documentation](https://imapflow.com/)
- [Nodemailer Official Site](https://nodemailer.com/)
- [Gmail API & IMAP Extensions](https://developers.google.com/gmail/api)
- [MCP Specification](https://modelcontextprotocol.io)
- [RFC 3501 (IMAP4rev1)](https://datatracker.ietf.org/doc/html/rfc3501)
