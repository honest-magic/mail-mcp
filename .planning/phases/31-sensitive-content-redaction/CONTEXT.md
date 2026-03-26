# Phase 31: Sensitive Content Redaction — Context

## Problem

When an AI model reads email content via the MCP server, that content is passed verbatim into the AI's context window. Emails regularly contain sensitive values embedded in plain text:

- Credit card numbers (e.g., payment receipts, phishing bait)
- Social Security Numbers (SSNs)
- Passwords in plain text (IT onboarding emails, password-reset confirmations)
- API keys and service credentials (e.g., `sk-...`, `api_...`)

These values in the AI context create unnecessary exposure risk, even in a local server. Users who want a privacy-first assistant should be able to mask these before content reaches the model.

## Goal

Add an optional `--redact` CLI flag. When enabled, all email body content returned to the AI is passed through a `redactSensitiveContent()` function that masks known sensitive patterns with neutral tokens like `[REDACTED CC]`.

## Design Decisions

- **Opt-in via `--redact`** — default off to avoid false positives breaking normal use
- **Zero external dependencies** — regex only; no ML, no heavy libs
- **Applied at the content layer** — `readEmail()` return value and `get_thread` content
- **Patterns** (all case-insensitive where applicable):
  1. Credit card numbers: 16-digit groups with optional spaces/dashes → `[REDACTED CC]`
  2. SSN: `XXX-XX-XXXX` format → `[REDACTED SSN]`
  3. Contextual passwords: `password: VALUE`, `pwd: VALUE`, `passwd: VALUE` → value replaced with `[REDACTED]`
  4. API keys: strings prefixed with `sk-`, `api_`, `token_`, `secret_` followed by 16+ alphanumeric chars → `[REDACTED KEY]`
- **Location**: `src/utils/redact.ts` — pure utility function
- **TDD**: Failing tests written first, then implementation

## Key Files

- `src/utils/redact.ts` — new utility (redactSensitiveContent function)
- `src/utils/redact.test.ts` — new unit tests
- `src/services/mail.ts` — apply redaction in readEmail()
- `src/index.ts` — add --redact CLI flag, pass redact mode to MailService

## Notes

- The `get_thread` tool returns `MessageMetadata[]` (metadata only, no body), so thread body redaction only matters in `readEmail()`.
- If `--redact` is off, no regex processing occurs — zero performance impact in default mode.
