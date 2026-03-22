# Milestones

## v1.1.0 Hardening & Reliability (Shipped: 2026-03-22)

**Phases completed:** 6 phases, 9 plans, 4 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- Task 1: ImapClient.disconnect() liveness check
- Task 1 — Attachment size guard:
- One-liner:
- 1. [Rule 1 - Bug] imap.test.ts missing `once` method in ImapFlow mocks
- One-liner:
- One-liner:

---

## v1.0.0 Mail MCP Server (Shipped: 2026-03-22)

**Phases completed:** 9 phases, 16 plans, 12 tasks

**Key accomplishments:**

- Task 1 — Project Setup:
- One-liner:
- list_folders, move_email, and modify_labels tools delivering IMAP folder browsing and message organization via imapflow lock-based mutations
- One-liner:
- One-liner:
- MCP handshake now exposes read-only mode via InitializeResult.instructions and MailService skips smtpClient.connect() when readOnly=true
- package.json configured for @honest-magic/mail-mcp npm distribution with MIT LICENSE, bin entry, files scoping, and publishConfig.access=public
- 1. [Rule 1 - Bug] Corrected OAuth2 example arguments to match actual tool signature
- GitHub Actions CI workflow running tsc --noEmit type-check and vitest tests on every push to main and every pull request targeting main
- One manual secret required.

---
