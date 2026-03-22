# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Layered service-oriented MCP server with protocol abstraction and credential management

**Key Characteristics:**
- Multi-account support with per-account service instances
- Protocol layer abstraction (IMAP/SMTP clients encapsulated independently)
- Credential persistence via OS keychain integration
- Read-only mode support with tool filtering
- Dual entry point: MCP server or CLI account management commands

## Layers

**MCP Server Layer:**
- Purpose: Implements Model Context Protocol, exposes tools and resources to AI clients
- Location: `src/index.ts` - `MailMCPServer` class
- Contains: Tool definitions, request handlers, MCP SDK initialization
- Depends on: MailService, config, CLI routing
- Used by: External MCP clients via stdio transport

**Service Layer:**
- Purpose: Orchestrates mail operations across IMAP/SMTP, high-level business logic
- Location: `src/services/mail.ts` - `MailService` class
- Contains: Email operations (send, list, search, read, thread, batch), attachment handling
- Depends on: ImapClient, SmtpClient, markdown conversion, attachment parsing
- Used by: MCP server tool handlers

**Protocol Layer:**
- Purpose: Direct protocol communication with mail servers
- Location: `src/protocol/imap.ts`, `src/protocol/smtp.ts`
- Contains: ImapClient (message fetch/search/move/label/thread), SmtpClient (message send)
- Depends on: imapflow, nodemailer, mailparser for MIME parsing
- Used by: MailService

**Security Layer:**
- Purpose: Credential management and OAuth2 token handling
- Location: `src/security/keychain.ts`, `src/security/oauth2.ts`
- Contains: Keychain integration (cross-keychain), OAuth2 token refresh logic
- Depends on: cross-keychain package, system keychain
- Used by: Protocol layer (IMAP/SMTP) for authentication

**Configuration Layer:**
- Purpose: Account definitions and environment config
- Location: `src/config.ts`
- Contains: Account JSON persistence (~/.config/mail-mcp/accounts.json), environment variables (SERVICE_NAME, LOG_LEVEL)
- Depends on: zod for schema validation, file system
- Used by: MailMCPServer, CLI, MailService

**CLI Layer:**
- Purpose: Command-line interface for account management
- Location: `src/cli/accounts.ts`
- Contains: Account CRUD operations (add/list/remove), interactive prompts
- Depends on: config, keychain
- Used by: Main entry point as early routing mechanism

**Utilities:**
- Purpose: Shared transformations and helpers
- Location: `src/utils/markdown.ts`
- Contains: HTML to Markdown conversion via turndown
- Depends on: turndown package
- Used by: MailService for email content rendering

## Data Flow

**Email Read Flow:**

1. MCP client calls `read_email` tool with accountId, uid, folder
2. MailMCPServer.dispatchTool routes to setupToolHandlers
3. Handler calls getService(accountId) which creates or retrieves cached MailService instance
4. MailService.readEmail calls ImapClient.fetchMessageBody(uid, folder)
5. ImapClient acquires mailbox lock, fetches message source, releases lock
6. mailparser.simpleParser parses MIME to extract headers, text, html, attachments
7. MailService converts HTML to Markdown, builds header metadata, lists attachments
8. Response formatted as JSON and returned to client

**Email Send Flow:**

1. MCP client calls `send_email` with accountId, to, subject, body
2. MailMCPServer routes to sendEmail handler
3. Handler calls getService(accountId)
4. MailService.sendEmail builds raw message headers, calls ensureSmtp()
5. SmtpClient.connect() (lazy init) creates nodemailer transporter with OAuth2 or password auth
6. SmtpClient.send() calls transporter.sendMail()
7. MailService appends sent message to Sent folder via ImapClient.appendMessage()
8. Success response returned

**Search Flow:**

1. MCP client calls `search_emails` with criteria (from, subject, since, before, keywords)
2. MailService.searchEmails maps query object to IMAP search criteria
3. ImapClient acquires lock, calls imapflow.search(criteria)
4. Fetches envelope and flags for matching messages (last `count` results)
5. Returns MessageMetadata array with subject, from, date, snippet, threadId
6. Results reversed to show newest first

**OAuth2 Refresh Flow:**

1. Protocol layer (IMAP/SMTP) requests accessToken via getValidAccessToken(accountId)
2. Loads credentials JSON from keychain
3. If accessToken expired or missing, POSTs refresh_token to tokenEndpoint
4. Updates credentials with new accessToken and expiryDate
5. Saves updated credentials back to keychain
6. Returns valid accessToken for protocol connection

**State Management:**

- **MailService instances:** Cached in Map keyed by accountId, created on-demand, single instance per account per server lifetime
- **IMAP client state:** Single ImapClient per MailService, maintains connection and mailbox lock state
- **SMTP state:** Lazy-initialized SmtpClient, transporter pooling handled by nodemailer
- **Credentials:** Stored in OS keychain (macOS Keychain via cross-keychain), never in configuration file
- **Account definitions:** Stored in ~/.config/mail-mcp/accounts.json, read once at startup and on CLI operations

## Key Abstractions

**MailService (Service Abstraction):**
- Purpose: Provides high-level mail operations without exposing protocol details
- Examples: `src/services/mail.ts` (listEmails, searchEmails, sendEmail, readEmail, getThread, moveMessage, modifyLabels, batchOperations)
- Pattern: Coordinates IMAP and SMTP clients, handles content formatting, manages batch constraints

**ImapClient (Protocol Abstraction):**
- Purpose: Encapsulates all IMAP operations with connection management
- Examples: `src/protocol/imap.ts` (listMessages, searchMessages, fetchMessageBody, fetchThreadMessages, appendMessage, moveMessage, modifyLabels, batch operations)
- Pattern: Wraps imapflow, manages mailbox locks, handles both Gmail-specific (x-gm-thrid) and RFC-standard (Message-ID, References) threading

**SmtpClient (Protocol Abstraction):**
- Purpose: Encapsulates SMTP send operations
- Examples: `src/protocol/smtp.ts` (connect, send)
- Pattern: Wraps nodemailer transporter, lazy connection, supports both login and OAuth2 auth

**EmailAccount (Configuration Abstraction):**
- Purpose: Defines account connection parameters
- Examples: `src/types/index.ts` (id, name, host, port, smtpHost, smtpPort, user, authType, useTLS)
- Pattern: Immutable config object, used to initialize protocol clients

**MessageMetadata (Data Abstraction):**
- Purpose: Lightweight message summary for list/search operations
- Examples: `src/protocol/imap.ts` (id, uid, subject, from, date, snippet, threadId)
- Pattern: Contains essential fields only, avoids fetching full message bodies in bulk operations

## Entry Points

**MCP Server (Default):**
- Location: `src/index.ts` - main() function
- Triggers: Binary invocation without CLI subcommands (e.g., `mail-mcp` or `mail-mcp --read-only`)
- Responsibilities: Parse argv for --read-only flag, instantiate MailMCPServer, connect to stdio transport

**CLI Accounts (Optional):**
- Location: `src/cli/accounts.ts` - handleAccountsCommand(args)
- Triggers: Binary invocation with `accounts` subcommand (e.g., `mail-mcp accounts add`)
- Responsibilities: Route to add/list/remove account handlers, manage interactive prompts, exit process

**Service Initialization:**
- Location: `src/index.ts` - MailMCPServer.getService(accountId)
- Triggers: First tool call for an account
- Responsibilities: Retrieve account config, create MailService, establish IMAP connection, cache service

## Error Handling

**Strategy:** Errors propagate from protocol layer → service layer → MCP handler, returned as MCP error responses with isError: true

**Patterns:**
- Protocol errors (connection failures, authentication): Thrown as Error, caught in dispatchTool, returned as error text
- Missing accounts: Validated in getService(), throws error if not found in config
- Read-only mode violations: Checked before dispatch, returns error message without executing tool
- Batch operation limits: Validated in batchOperations() (max 100 emails), throws error if exceeded
- Attachment not found: Searched in downloadAttachment(), throws error if missing
- Credential not found: Checked in protocol connect(), throws error if keychain lookup fails
- OAuth2 token refresh failures: HTTP errors in getValidAccessToken() propagate as error

## Cross-Cutting Concerns

**Logging:**
- console.error() for configuration errors, credential failures, and append-to-sent failures
- imapflow logger disabled (logger: false) to reduce noise
- MCP server error handler logs via console.error

**Validation:**
- Account existence: Validated in getService(accountId)
- UID format: Assumed valid (passed as string, cast to number/uid by protocol)
- Batch operation limits: 100 email max enforced in batchOperations()
- Email address format: No validation, delegated to server
- OAuth2 token structure: Parsed as JSON, falls back to plaintext password

**Authentication:**
- Two modes: Login (password) or OAuth2 (clientId, clientSecret, refreshToken, tokenEndpoint)
- Credentials stored in OS keychain, never logged or exposed in config
- OAuth2 tokens auto-refresh with 1-minute buffer before expiry
- Legacy plaintext passwords supported via keychain fallback in getValidAccessToken()

**Read-Only Mode:**
- Enforced at tool dispatch level (before handlers execute)
- Filtered from tool list in getTools()
- Returns error message: "Tool 'X' is not available: server is running in read-only mode"
- Write tools defined in WRITE_TOOLS Set: send_email, create_draft, move_email, modify_labels, register_oauth2_account, batch_operations

**Thread Safety:**
- Mailbox locks acquired per operation (ImapClient uses imapflow.getMailboxLock)
- No concurrent access to same mailbox across operations
- MailService instance map is per-server (not shared across processes)
- Nodemailer transporter pooling handled internally

---

*Architecture analysis: 2026-03-22*
