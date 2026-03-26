# Phase 33: Send Recipient Allowlist — Context

## Problem Statement

AI agents using mail-mcp can send emails to any recipient, including accidental or unintended addresses. When an AI is summarizing emails, automating replies, or forwarding messages, there is risk it might send to wrong people — e.g., using a test address in production, accidentally forwarding to sensitive contacts, or misinterpreting "send this to everyone on the list."

An optional `allowedRecipients` field per account lets administrators lock down exactly who an AI can email. This is a last-line-of-defense safety feature.

## Design

### Config Schema Addition

Add optional `allowedRecipients?: string[]` to `emailAccountSchema` in `src/config.ts`.

Each entry is either:
- An exact email address: `"alice@example.com"` — matches exactly that address
- A domain pattern: `"@example.com"` — matches any address at that domain

### Validation Logic

New utility function `validateRecipients(recipients: string[], allowlist: string[], accountId: string): void` in `src/utils/validation.ts`.

- Parses comma-separated fields the same way `validateEmailAddresses` does (supporting angle-bracket format)
- For each extracted address, checks if it matches any allowlist entry (exact match OR domain suffix match)
- Throws `ValidationError` with message: `"Recipient foo@bar.com is not in the allowed recipients list for account X"`
- Called only when `account.allowedRecipients` is set (non-empty array); no restriction otherwise

### Integration Points

In `dispatchTool()` in `src/index.ts`, after email address format validation, retrieve the account and call `validateRecipients` for:
- `send_email` — to, cc, bcc
- `create_draft` — to, cc, bcc
- `reply_email` — cc, bcc (to is determined from original message — skip; AI cannot control it)
- `forward_email` — to, cc, bcc

Note: `reply_email` does not validate `to` since it is auto-determined from the original sender.

## Example Config

```json
{
  "id": "work",
  "allowedRecipients": [
    "alice@company.com",
    "bob@company.com",
    "@company.com"
  ]
}
```

With this config, attempting to send to `external@gmail.com` returns:
`"Recipient external@gmail.com is not in the allowed recipients list for account work"`

## Backward Compatibility

- If `allowedRecipients` is absent or empty array, no restriction applies
- All existing tests continue to pass
- No migration required for existing accounts.json files
