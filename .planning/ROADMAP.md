# Roadmap: Mail MCP Server

## Phases

- [ ] **Phase 1: Secure Connectivity & Basic Messaging** - Establish secure IMAP/SMTP connections and enable basic read/send capabilities.
- [ ] **Phase 2: Discovery & Organization** - Implement advanced search, folder management, and mailbox organization.
- [ ] **Phase 3: Context & Resources** - Add thread reconstruction and attachment handling for deeper reasoning.
- [ ] **Phase 4: Efficiency & Scale** - Optimize with batch operations and performance improvements.

## Phase Details

### Phase 1: Secure Connectivity & Basic Messaging
**Goal**: Securely connect to mail servers and perform basic read/write operations.
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, IMAP-01, IMAP-02, SMTP-01, SMTP-03, SMTP-04
**Success Criteria**:
1. User can securely store and retrieve credentials using macOS Keychain.
2. User can connect to IMAP/SMTP servers using TLS/SSL or OAuth2.
3. User can list recent messages and read their content sanitized as Markdown.
4. User can send a new email and verify it appears in the "Sent" folder via IMAP APPEND.
5. User can create a draft in the "Drafts" folder for human-in-the-loop safety.
**Plans**: TBD

### Phase 2: Discovery & Organization
**Goal**: Find specific information and manage mailbox structure.
**Depends on**: Phase 1
**Requirements**: IMAP-03, IMAP-04, SMTP-02, ORG-01, ORG-02
**Success Criteria**:
1. User can search for emails using advanced criteria (sender, subject, date range).
2. User can list all available folders/labels and move messages between them.
3. User can add or remove labels/tags on messages (supporting provider-specific extensions).
4. User can send emails with CC and BCC recipients.
**Plans**: TBD

### Phase 3: Context & Resources
**Goal**: Reason over full conversations and supplementary files.
**Depends on**: Phase 1, Phase 2
**Requirements**: THRD-01, THRD-02, THRD-03, RES-01, RES-02, RES-03
**Success Criteria**:
1. User can fetch a complete thread of messages grouped by thread ID.
2. User can view a token-efficient, summarization-friendly representation of a conversation.
3. User can list attachment metadata and download content via MCP Resource URIs.
4. User can see extracted text from PDF and common document attachments.
**Plans**: TBD

### Phase 4: Efficiency & Scale
**Goal**: Perform high-volume actions efficiently.
**Depends on**: Phase 2
**Requirements**: ORG-03
**Success Criteria**:
1. User can perform batch operations (move, delete, label) on many emails in a single request.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Connectivity & Basic Messaging | 0/1 | Not started | - |
| 2. Discovery & Organization | 0/1 | Not started | - |
| 3. Context & Resources | 0/1 | Not started | - |
| 4. Efficiency & Scale | 0/1 | Not started | - |
