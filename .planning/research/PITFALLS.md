# Domain Pitfalls: Mail MCP Server (IMAP/SMTP)

**Domain:** Email Integration via IMAP/SMTP
**Researched:** 2025-05-15

## Critical Pitfalls

### Pitfall 1: UIDVALIDITY Invalidation
**What goes wrong:** The client's local cache of message UIDs becomes completely out of sync with the server.
**Why it happens:** IMAP servers use `UIDVALIDITY` to signal if the UID sequence has been reset (e.g., due to a database restore, server migration, or mailbox reconstruction).
**Consequences:** The client may fetch the wrong emails, delete the wrong messages, or fail to find existing ones, leading to data corruption or loss.
**Prevention:** Always check the `UIDVALIDITY` value upon selecting a mailbox. If it differs from the cached value, discard the local cache for that folder and re-index.
**Detection:** Monitor for `UIDVALIDITY` responses in the `SELECT` or `EXAMINE` command output.

### Pitfall 2: The "Sent" Folder Disappearance
**What goes wrong:** Emails sent via the MCP server do not appear in the user's "Sent" folder in their email client (Gmail/Outlook).
**Why it happens:** SMTP only handles the *delivery* of the message. Most IMAP/SMTP servers do not automatically copy the sent message to the `Sent` folder.
**Consequences:** Users lose the history of AI-sent emails, leading to a lack of trust and broken conversation threads.
**Prevention:** After a successful `SMTP SEND`, the server must manually upload the message content to the appropriate IMAP `Sent` folder using the `APPEND` command.
**Detection:** Check the "Sent" folder after a test send; if empty, the `APPEND` step is missing.

### Pitfall 3: Credential Exposure & Plaintext Storage
**What goes wrong:** User email credentials (passwords or tokens) are leaked or stolen from the MCP server's configuration.
**Why it happens:** Storing credentials in plaintext `.env` files, configuration JSONs, or logs.
**Consequences:** Full access to the user's email account by malicious actors; massive privacy breach.
**Prevention:** Use system-level keychains (e.g., macOS Keychain, Windows Credential Manager) via libraries like `keytar`. Mandate the use of OAuth2 (XOAUTH2) or App-Specific Passwords rather than primary account passwords.
**Detection:** Audit code for `console.log` of config objects and check if config files are readable by other users.

### Pitfall 4: Gmail Label vs. Folder Paradox
**What goes wrong:** The AI sees duplicate emails or fails to correctly "move" a message between folders.
**Why it happens:** Gmail doesn't have real folders; it has labels. A single message with multiple labels appears as a separate copy in each corresponding IMAP folder but shares a single `X-GM-MSGID`.
**Consequences:** AI might process the same email multiple times, or "deleting" a message from one folder might only remove a label rather than trashing the message.
**Prevention:** Use the `X-GM-MSGID` attribute to identify unique messages across all folders. For "moving" messages in Gmail, use the `X-GM-LABELS` command rather than `COPY` + `STORE +FLAGS (\Deleted)`.
**Detection:** Observe multiple UIDs for the same `Message-ID` across different folders.

## Moderate Pitfalls

### Pitfall 5: Connection Zombies (IDLE Timeouts)
**What goes wrong:** The MCP server stops receiving new email notifications without any error message.
**Why it happens:** IMAP `IDLE` connections are often silently dropped by stateful firewalls or server-side timeouts (typically 15-30 minutes).
**Consequences:** Real-time triggers fail, and the AI context becomes stale.
**Prevention:** Implement a "heartbeat" mechanism that sends a `NOOP` or re-issues the `IDLE` command every 10-15 minutes to keep the connection alive.
**Detection:** Check if the server still responds to new emails after 1 hour of inactivity.

### Pitfall 6: Attachment Bloat & Token Exhaustion
**What goes wrong:** Sending full email content with large attachments to an LLM causes "Context Window Exceeded" errors or massive API costs.
**Why it happens:** Attempting to fetch and process the entire email body and all attachments by default.
**Consequences:** System crashes, high latency, and wasted tokens on non-essential data (e.g., image signatures).
**Prevention:** Fetch `BODYSTRUCTURE` first to identify parts. Only fetch the `text/plain` or `text/html` part for initial reasoning. Provide a separate tool (`download_attachment`) to fetch file content only when explicitly requested by the AI.
**Detection:** High "token per request" metrics or frequent "context length" errors.

## Minor Pitfalls

### Pitfall 7: Folder Name Fragmentation
**What goes wrong:** The server fails to find the "Sent" or "Trash" folder on a new provider (e.g., iCloud or Yahoo).
**Why it happens:** System folder names vary (`Sent`, `Sent Items`, `Sent Messages`, `[Gmail]/Sent Mail`).
**Prevention:** Use the `SPECIAL-USE` extension (RFC 6154) to identify folders by their server-assigned flags (`\Sent`, `\Trash`, `\Drafts`) rather than hardcoded strings.
**Detection:** Error logs showing "Folder not found" for standard system actions.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: Basic Connectivity** | Credential Exposure | Use environment variables initially, but plan for system keychain integration. |
| **Phase 1: Basic Connectivity** | SMTP Sent Sync | Explicitly implement IMAP `APPEND` after every SMTP send. |
| **Phase 2: Sync & Search** | UIDVALIDITY | Implement a cache-invalidation check on every folder `SELECT`. |
| **Phase 2: Sync & Search** | Connection Zombies | Implement a `NOOP` timer for the IMAP connection pool. |
| **Phase 3: Advanced Features** | Attachment Bloat | Implement partial fetching using `BODYSTRUCTURE`. |
| **Phase 3: Advanced Features** | Gmail Labels | Use Gmail-specific IMAP extensions (`X-GM-*`) if the server is identified as Gmail. |
| **Phase 4: Compliance** | Accidental Deletion | Implement a "Soft Delete" (moving to Trash) by default, and require explicit confirmation for `EXPUNGE`. |

## Sources

- [RFC 3501 (IMAP4rev1)](https://datatracker.ietf.org/doc/html/rfc3501)
- [RFC 6154 (IMAP SPECIAL-USE Extension)](https://datatracker.ietf.org/doc/html/rfc6154)
- [Gmail IMAP Extensions Documentation](https://developers.google.com/gmail/imap/imap-extensions)
- [Microsoft Outlook IMAP Implementation Notes](https://learn.microsoft.com/en-us/exchange/client-developer/exchange-web-services/imap-and-pop3-adapter-for-exchange)
- [Fastmail: Why is IMAP so hard?](https://www.fastmail.help/hc/en-us/articles/115000396547-Why-is-IMAP-so-hard-)
