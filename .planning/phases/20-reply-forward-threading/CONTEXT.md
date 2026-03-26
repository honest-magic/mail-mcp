# Phase 20 Context: Reply & Forward Threading

## Goal

Add `reply_email` and `forward_email` MCP tools that produce correctly threaded email by
setting RFC 2822 headers (`In-Reply-To`, `References`) so replies appear in the original
conversation thread in any IMAP client.

## Problem Statement

The current `send_email` tool composes a fresh message with no reference to prior messages.
When an AI agent replies to an email using `send_email`, the reply does not appear in the
original thread — it creates a new, orphaned conversation. To be a useful mail assistant,
the MCP server must produce RFC-compliant threading headers.

## Key RFC Rules (RFC 2822 §3.6.4)

- **In-Reply-To**: contains the Message-ID of the message being directly replied to.
- **References**: contains the full chain of Message-IDs from the thread. If the original
  message had a `References` header, append its Message-ID to that chain. If not, just
  use its Message-ID.
- **Subject for replies**: prepend "Re: " (unless already present).
- **Subject for forwards**: prepend "Fwd: " (unless already present).

## Design Decisions (auto-selected)

### reply_email tool

- **Inputs**: `accountId`, `uid`, `folder` (default INBOX), `body`, optional `cc`, `bcc`,
  `isHtml` (default false), `includeSignature` (default true)
- **Flow**:
  1. Fetch original message via `fetchMessageBody(uid, folder)` (reuses existing method)
  2. Extract `messageId`, `references` header, `from` (to set `to`), `subject`
  3. Build `In-Reply-To: <messageId>` and `References: <existing-refs> <messageId>` headers
  4. Prepend "Re: " to subject if not already present
  5. Send via `SmtpClient.send()` with extra headers; save to Sent via IMAP append

### forward_email tool

- **Inputs**: `accountId`, `uid`, `folder` (default INBOX), `to`, optional `body`
  (preamble before forwarded content), `cc`, `bcc`, `isHtml` (default false),
  `includeSignature` (default true)
- **Flow**:
  1. Fetch original message
  2. Prepend "Fwd: " to subject if not already present
  3. Append formatted original message body (with "--- Forwarded message ---" separator)
  4. No In-Reply-To/References (forward breaks the thread chain per convention)
  5. Send via `SmtpClient.send()`, save to Sent

### SmtpClient.send() extension

Add optional `extraHeaders` parameter (`Record<string, string>`) so threading headers
can be injected without changing the existing SMTP call signature (backward-compatible
— existing callers pass nothing).

## File Map

| File | Change |
|------|--------|
| `src/protocol/smtp.ts` | Add `extraHeaders?: Record<string, string>` to `send()` |
| `src/services/mail.ts` | Add `replyEmail()` and `forwardEmail()` methods |
| `src/index.ts` | Add `reply_email` and `forward_email` tool definitions + handlers; add both to `WRITE_TOOLS` |
| `src/protocol/smtp.test.ts` | Tests for `extraHeaders` on `send()` |
| `src/services/mail.test.ts` | Tests for `replyEmail()` and `forwardEmail()` |
| `src/index.test.ts` | Update tool count expectations; add handler smoke tests |

## Success Criteria

1. `reply_email` produces `In-Reply-To` and `References` headers matching the original
   message's `Message-ID`.
2. `forward_email` prepends "Fwd: " to subject and includes forwarded body.
3. Both tools save to Sent folder via IMAP append.
4. Both tools support `includeSignature`.
5. `npm test` passes with no regressions.
6. New tools appear in `getTools()` output and are blocked in read-only mode.
