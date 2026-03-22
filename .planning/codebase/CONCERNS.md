# Codebase Concerns

**Analysis Date:** 2026-03-22

## Resource Lifecycle Management

**IMAP/SMTP Connection Leaks:**
- Issue: Services are cached in `MailMCPServer.services` map but never disconnected. When the MCP server exits or crashes, active IMAP and SMTP connections are not gracefully closed.
- Files: `src/index.ts` (lines 26, 49-62), `src/services/mail.ts` (lines 30-33)
- Impact: Long-running server processes may accumulate stale connections over time; potential resource exhaustion and dropped message queue errors from IMAP providers
- Fix approach: Implement explicit cleanup handlers (SIGTERM, SIGINT) to call `disconnect()` on all cached services before exit. Consider adding connection pooling with lifecycle management.

## Error Handling Gaps

**Unhandled Promise Rejections in Tool Dispatch:**
- Issue: The `setupToolHandlers()` method (lines 317-586 in `src/index.ts`) has a try-catch at the handler level, but individual tool operations (line 548: `const result = await service.batchOperations()`) could reject without meaningful error propagation if service methods fail.
- Files: `src/index.ts` (lines 317-586)
- Impact: Errors from IMAP operations (e.g., folder not found, permission denied) are caught generically and returned as plain text `Error: ${error.message}`, losing structured error context for callers
- Fix approach: Implement typed error responses with error codes (similar to MCP ErrorCode pattern). Create custom error types for authentication, network, and operation-specific failures.

**Silent Credential Failures:**
- Issue: In `src/security/keychain.ts` (lines 9-14), credential loading silently returns `null` on failure with console.error only. If credentials fail to load, this cascades to connection failures without clear signaling.
- Files: `src/security/keychain.ts` (lines 8-14)
- Impact: Unclear failure mode when keychain is unavailable or corrupted; users see generic "Credentials not found" error without diagnostic information
- Fix approach: Propagate keychain errors with specific context (e.g., "keychain access denied", "credential corrupted"). Add retry logic with exponential backoff for transient keychain failures.

## Security Considerations

**OAuth2 Token Storage:**
- Risk: Refresh tokens and client secrets are stored as plaintext JSON in macOS Keychain via `saveCredentials()`. If keychain is compromised or serialized to disk, tokens are exposed.
- Files: `src/security/oauth2.ts` (line 65), `src/index.ts` (lines 516-534)
- Current mitigation: Keychain encryption via OS-level security
- Recommendations: (1) Never log or return refresh tokens in error messages. (2) Add token rotation notification to alert on unusual token refresh patterns. (3) Implement token expiry enforcement with minimum validity check before use (currently only 60-second buffer at line 32).

**Plaintext Password Fallback in OAuth2 Module:**
- Risk: In `src/security/oauth2.ts` (lines 22-28), if stored credentials are not valid OAuth2 JSON, the function assumes plaintext password and returns it directly without validation.
- Files: `src/security/oauth2.ts` (lines 12-68)
- Impact: Legacy password handling allows mixed credential types without clear lifecycle separation
- Fix approach: Split password and OAuth2 credential handling into separate storage paths. Add explicit auth type validation at credential load time.

**Email Recipient Validation:**
- Risk: No validation of email addresses in `send_email` and `create_draft` tools. Malformed addresses could cause SMTP failures or be sent to wrong recipients.
- Files: `src/index.ts` (lines 404-416, 418-430), `src/services/mail.ts` (line 50, 74)
- Impact: Invalid To/Cc/Bcc fields could cause mail delivery failures or expose intended recipients
- Fix approach: Add email regex validation in tool schema or create dedicated email validation utility. Use stricter parsing for RFC 5322 compliance.

## Performance Bottlenecks

**Synchronous Account Configuration Parsing:**
- Issue: `getAccounts()` in `src/config.ts` (lines 34-54) reads entire accounts.json file synchronously on every tool invocation that requires account lookup.
- Files: `src/config.ts` (lines 34-54), `src/index.ts` (line 53)
- Impact: Every MCP request that calls `getService()` triggers file I/O. With many accounts or slow storage, this blocks the event loop.
- Improvement path: Cache accounts configuration in memory with file watcher for changes. Implement lazy-load pattern with cache invalidation on file modification.

**Large Email List Processing:**
- Issue: `listMessages()` in `src/protocol/imap.ts` (lines 57-91) fetches and buffers all bodyParts['TEXT'] in memory, creating string snippets for every message up to `count` limit (default 10, but no pagination).
- Files: `src/protocol/imap.ts` (lines 72-87)
- Impact: Fetching 1000+ emails would load entire body text into memory; IMAP servers with slow connections cause long hangs
- Improvement path: Implement cursor-based pagination. Fetch only envelope + flags for initial list, defer body parsing to `read_email`. Add timeout for IMAP fetch operations.

**HTML-to-Markdown Conversion Overhead:**
- Issue: In `src/services/mail.ts` (line 108), every HTML email is converted to Markdown using TurndownService. Complex HTML (nested tables, embedded styling) causes expensive DOM parsing.
- Files: `src/services/mail.ts` (lines 90-148), `src/utils/markdown.ts` (lines 8-10)
- Impact: Reading emails with large HTML content (newsletters, formatted marketing emails) causes latency spikes
- Improvement path: Cache conversion results. Add HTML size limits. Consider streaming conversion for large documents.

## Fragile Areas

**Thread ID Resolution Fallback:**
- Files: `src/protocol/imap.ts` (lines 146-194)
- Why fragile: Three-tier fallback for thread ID (Gmail x-gm-thrid → RFC 5256 headers → empty return) silently fails without logs. If a server supports header search but returns malformed results, threadId reconstruction is unreliable.
- Safe modification: Add structured logging at each fallback stage. Test explicitly against non-Gmail IMAP servers. Document which servers support which threading mode.
- Test coverage: No integration tests against real IMAP servers; only mocked MailService tests exist.

**Batch Operations Size Limit:**
- Files: `src/services/mail.ts` (lines 207-209)
- Why fragile: Hard limit of 100 UIDs enforced in JavaScript, but no IMAP server-side validation. Some IMAP servers have stricter limits (e.g., 50 UIDs in batch).
- Safe modification: Make batch size configurable per account. Test against actual server limits. Add retry logic with exponential backoff for batch operations.
- Test coverage: Only happy-path test exists (`batch_operations` not tested in index.test.ts).

**Account Configuration without Validation:**
- Files: `src/config.ts` (lines 34-54)
- Why fragile: Account configuration loaded without schema validation. Missing required fields (e.g., `host`, `port`, `authType`) would cause runtime errors only when service tries to connect.
- Safe modification: Add Zod schema validation on account load. Provide validation errors before attempting connections. Test with malformed accounts.json.
- Test coverage: `config.test.ts` does not test error cases for missing fields.

## Missing Critical Features

**No Account Connection Health Check:**
- Problem: Server starts without verifying that IMAP/SMTP credentials are valid. Errors only surface when tools are called.
- Blocks: Cannot pre-validate accounts during server startup; users get delayed feedback on misconfigured accounts
- Recommendation: Add optional `--validate-accounts` CLI flag that tests IMAP CAPABILITY and SMTP EHLO without loading full message data

**No Rate Limiting or Quota Management:**
- Problem: No rate limiting on tool invocations. Malicious or buggy callers could trigger 1000s of IMAP commands, hitting server rate limits.
- Blocks: Production deployments vulnerable to DOS; no quota tracking per account
- Recommendation: Implement sliding window rate limiter per account. Add quota tracking and return quota status in tool responses.

**No Persistent Message Cache:**
- Problem: Message lists are fetched fresh on every call. No local cache of message metadata.
- Blocks: Cannot efficiently support "show new messages since last check" or message offset pagination
- Recommendation: Add optional SQLite cache layer for message metadata with sync tracking

**Missing Attachment Size Limits:**
- Problem: No size checks on attachments before downloading. Large files (100MB+) could exhaust memory.
- Blocks: Cannot safely expose attachment tools in untrusted environments
- Recommendation: Add size limit configuration (default 50MB), add streaming download support

## Test Coverage Gaps

**Integration Tests Missing:**
- What's not tested: Real IMAP/SMTP connections, OAuth2 token refresh flow, cross-account operations
- Files: All test files use mocks; no `*.integration.test.ts` exists
- Risk: Refactoring OAuth2 or connection logic could break production without detection
- Priority: High — OAuth2 token refresh is complex and error-prone

**SMTP Send Verification:**
- What's not tested: Whether sent emails are actually appended to Sent folder. Sending without folder append confirmation could lose message history.
- Files: `src/services/mail.ts` (lines 50-72) — append is wrapped in try-catch with only console.error
- Risk: Silent message loss on folder permission issues
- Priority: Medium — affects email audit trail integrity

**Error Recovery Scenarios:**
- What's not tested: Connection drops during batch operations, token expiry during tool execution, IMAP server disconnection and reconnect
- Files: No test for `imapClient.disconnect()` after errors or timeouts
- Risk: Zombie connections or undefined behavior on transient failures
- Priority: Medium — impacts reliability in production

**Credential Edge Cases:**
- What's not tested: Empty password, non-ASCII characters in password, missing keychain on Linux
- Files: `src/security/keychain.ts` and `src/cli/accounts.ts` (lines 176-182)
- Risk: Undiscovered failures in non-macOS environments or with special characters
- Priority: Low-Medium — cross-platform support is secondary goal

## Dependencies at Risk

**Outdated Type Definitions:**
- Risk: `@types/pdf-parse@1.1.5` and `@types/nodemailer@7.0.11` are several minor versions behind their runtime counterparts
- Impact: Type mismatches could lead to runtime errors in edge cases
- Migration plan: Update type packages to latest compatible versions; run type checking in CI

**pdf-parse Legacy Module:**
- Risk: `pdf-parse@2.4.5` is a lightweight wrapper around pdfjs-dist. If PDF document structure changes, parsing could fail silently (returns empty string).
- Impact: Attachment extraction fails on certain PDF formats without clear error messaging
- Migration plan: Upgrade to pdfjs-dist directly for better error handling and structured output

**TurndownService Configuration Static:**
- Risk: HTML-to-Markdown conversion uses singleton TurndownService instance with fixed settings. No option to customize rendering per email or handle malformed HTML gracefully.
- Impact: Unusable markdown output for emails with complex formatting; no fallback to HTML representation
- Migration plan: Add configurable markdown options per account or per tool invocation. Consider alternative markdown renderer with better edge case handling.

---

*Concerns audit: 2026-03-22*
