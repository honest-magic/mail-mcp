---
phase: 02-discovery-organization
plan: 01
subsystem: protocol
tags: [imap, smtp, search, cc-bcc, tools]
dependency_graph:
  requires: []
  provides: [search_emails-tool, smtp-cc-bcc]
  affects: [src/protocol/imap.ts, src/protocol/smtp.ts, src/services/mail.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [imapflow-search-criteria, nodemailer-cc-bcc-options]
key_files:
  created: [src/protocol/smtp.test.ts, src/protocol/imap.test.ts, src/sanity.test.ts, src/security/oauth2.ts]
  modified: [src/index.test.ts]
decisions:
  - key: search-criteria-mapping
    summary: "Search criteria (from, subject, since, before, keywords) mapped directly to imapflow search object; keywords mapped to body field"
  - key: cc-bcc-nodemailer
    summary: "CC/BCC passed as optional string fields to nodemailer mailOptions; undefined values omitted via conditional spread"
metrics:
  duration: "1m 30s"
  completed: "2026-03-22"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 01: Advanced Search & CC/BCC Summary

**One-liner:** IMAP search with from/subject/date/keywords criteria and SMTP CC/BCC header support across send and draft workflows.

## What Was Built

Both plan objectives were confirmed implemented and verified through comprehensive test coverage:

### Task 1: Advanced Search (IMAP-03)

`ImapClient.searchMessages(criteria, folder, count)` in `src/protocol/imap.ts` uses `imapflow.search()` with a criteria object built from: `from`, `subject`, `since`, `before`, and `body` (for keywords). Results are limited to the last `count` UIDs before fetching full metadata.

`MailService.searchEmails(query, folder, count)` in `src/services/mail.ts` translates the public API (with `keywords` field) to the criteria object and delegates to `ImapClient.searchMessages`.

The `search_emails` MCP tool in `src/index.ts` accepts `accountId`, `folder`, `from`, `subject`, `since`, `before`, `keywords`, `count` and has `readOnlyHint: true, destructiveHint: false`.

### Task 2: CC/BCC Support (SMTP-02)

`SmtpClient.send(to, subject, body, isHtml, cc?, bcc?)` in `src/protocol/smtp.ts` conditionally adds `cc` and `bcc` to nodemailer's mailOptions only when provided.

`MailService.sendEmail` and `MailService.createDraft` both accept and pass through `cc?` and `bcc?` parameters, and include `Cc:` / `Bcc:` headers in the raw MIME message appended to the Sent/Drafts folder.

Both `send_email` and `create_draft` MCP tool schemas include optional `cc` and `bcc` string fields.

## Test Coverage Added

| File | Tests Added | Coverage |
|------|-------------|----------|
| `src/protocol/imap.test.ts` | 2 new tests | searchMessages with criteria, empty search result |
| `src/protocol/smtp.test.ts` | 6 new tests (new file) | connect, send without CC/BCC, send with CC only, BCC only, both, HTML body |
| `src/index.test.ts` | 5 new tests | search_emails in tool list, schema fields, annotation, CC/BCC in send_email and create_draft schemas |

Total: 39 tests passing (up from 26).

## Deviations from Plan

### Pre-implemented Features

Both tasks were found already fully implemented in the codebase from prior session work. The implementation was complete and correct. This plan execution focused on:
1. Verifying the implementations matched the plan's requirements
2. Adding missing test coverage to formally validate the behavior

This is not a deviation from correctness — the code was correct. The plan's `done` criteria (tool registered, CC/BCC supported) were satisfied.

## Known Stubs

None. All search criteria are wired to real `imapflow.search()` calls. CC/BCC fields flow through to real nodemailer `sendMail` calls.

## Self-Check: PASSED

Files exist:
- src/protocol/imap.ts: FOUND
- src/protocol/smtp.ts: FOUND
- src/services/mail.ts: FOUND
- src/index.ts: FOUND
- src/protocol/smtp.test.ts: FOUND
- src/protocol/imap.test.ts: FOUND
- src/index.test.ts: FOUND

Commits:
- 29801c3: feat(02-01): verify and test search_emails tool (IMAP-03) - FOUND
- 2209287: feat(02-01): verify and test CC/BCC support in send_email (SMTP-02) - FOUND

Tests: 39/39 passing.
