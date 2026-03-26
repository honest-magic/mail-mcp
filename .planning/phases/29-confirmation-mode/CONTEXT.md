# Phase 29: Confirmation Mode — Context

## Goal

Add an optional confirmation mode to the mail-mcp server. When started with `--confirm`, write tools return a confirmation prompt instead of executing immediately. The AI must re-call the same tool with the provided `confirmationId` to execute the action. This gives humans a safety net before destructive operations take effect.

## Motivation

AI agents can accidentally send emails, delete messages, or modify labels when given ambiguous instructions. A confirmation gate lets the human review what the AI intends to do before it happens. This mirrors the confirmation patterns in CLI tools (e.g., `git push --force` prompting for confirmation).

## Confirmation Flow

1. AI calls `send_email` with arguments → server is in `--confirm` mode
2. Server returns: `{ "confirmationRequired": true, "action": "send_email", "description": "Send email to alice@example.com with subject 'Hello'", "confirmationId": "uuid-v4", "expiresIn": "5 minutes" }`
3. AI presents this to the human: "I need your confirmation to send an email to alice@example.com..."
4. Human says "yes" → AI calls `send_email` again with the original args PLUS `confirmationId: "uuid-v4"`
5. Server finds the pending confirmation, marks it consumed, executes the action

## Scope

**Applies to write tools only** (WRITE_TOOLS set in index.ts):
- send_email, create_draft, move_email, modify_labels, register_oauth2_account
- batch_operations, reply_email, forward_email, delete_email
- mark_read, mark_unread, star, unstar, set_filter, delete_filter

**Read tools always execute immediately** regardless of `--confirm` flag.

## Key Design Decisions

- CLI flag: `--confirm` (adds to existing `--read-only` and `--validate-accounts`)
- TTL: 5 minutes (same as message body cache — consistent with existing patterns)
- Storage: In-memory Map in MailMCPServer (same instance-level pattern as `services` Map and `rateLimiter`)
- ID: `crypto.randomUUID()` (built-in Node.js 14.17+ — no new dependency)
- confirmationId is added to tool input schemas as optional parameter
- Pending confirmations store the full original args (minus confirmationId) for replay

## Confirmation Storage Shape

```typescript
interface PendingConfirmation {
  toolName: string;
  args: Record<string, unknown>;
  createdAt: number; // Date.now()
  ttlMs: number;
}
```

## Module Structure

New file: `src/utils/confirmation-store.ts`
- `ConfirmationStore` class (mirrors `MessageBodyCache` pattern)
- `CONFIRMATION_TTL_MS = 5 * 60 * 1000`
- Methods: `create(toolName, args): string`, `consume(id): PendingConfirmation | undefined`, `size` getter

The `--confirm` gate in `MailMCPServer` constructor and `setupToolHandlers()`.

## Server Instructions Update

When `--confirm` is active, append to MCP server instructions:
"This server is running in confirmation mode. Write operations require a two-step confirmation. The first call returns a confirmationId; include it in the second call to execute."
