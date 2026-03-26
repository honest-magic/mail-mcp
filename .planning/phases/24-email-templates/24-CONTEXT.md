# Phase 24 Context: Email Templates

## Goal

Add reusable email template support to mail-mcp. AI agents can list templates, apply
variable substitution, and produce ready-to-send arguments for `send_email` or `create_draft`.

## Codebase Observations

### Config layer (src/config.ts)
- Accounts stored at `~/.config/mail-mcp/accounts.json` with a Zod schema and fs.watch cache.
- Pattern: separate path constant, schema, in-memory cache with invalidation watcher.
- Templates will follow the same pattern at `~/.config/mail-mcp/templates.json`.

### Tool layer (src/index.ts)
- `getTools()` returns static array — two new entries needed: `list_templates`, `use_template`.
- `dispatchTool()` handles each name with an `if` block — two new blocks needed.
- `WRITE_TOOLS` set controls read-only mode gating — `use_template` is read-only (it only
  resolves template → args; actual send is a separate tool call).
- `extract_contacts` shows the pattern for read-only tools with no `accountId`.

### Service layer (src/services/mail.ts)
- `applySignature` is a pure exported helper — template variable substitution will follow
  the same pure-helper pattern in `src/utils/templates.ts`.

### Testing pattern (src/config.test.ts, src/services/mail.test.ts)
- `vi.mock('node:fs/promises')` / `vi.mock('node:fs')` for filesystem isolation.
- `vi.mock('node:os')` with `homedir` returning a fixed path.
- Schemas tested via `safeParse`; helpers tested as plain functions.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage path | `~/.config/mail-mcp/templates.json` | Consistent with accounts.json location |
| Template scope | Global or per-account via optional `accountId` field | Flexible without extra complexity |
| Variable syntax | `{{variable}}` | Standard mustache-style, AI-friendly |
| `use_template` result | Returns merged args object (not sending) | Separation of concerns; AI decides to send or draft |
| Missing file | Returns empty array | Graceful — no templates = no error |
| Schema | Zod, same pattern as accounts | Type-safe, consistent validation |
| Cache invalidation | fs.watch on templates.json | Consistent with accounts cache pattern |

## Template Schema

```typescript
{
  id: string;           // unique identifier, e.g. "ack-received"
  name: string;         // human label, e.g. "Acknowledgement"
  subject?: string;     // optional subject template with {{vars}}
  body: string;         // body with {{vars}} placeholders
  isHtml?: boolean;     // default false
  accountId?: string;   // null/absent = global, set = account-specific
}
```

## Variable Substitution

`{{variable}}` in `subject` and `body` is replaced by values from the `variables` map
passed to `use_template`. Unknown placeholders are left as-is (AI can see them and fill
remaining ones). Extra variables not referenced in the template are silently ignored.

## New MCP Tools

### `list_templates`
- Read-only
- Optional `accountId` filter — if provided, returns global + account-specific templates
- If omitted, returns all templates

### `use_template`
- Read-only (resolves template to args — no I/O)
- Inputs: `templateId`, `variables` (key-value map), optional `accountId`, `to`, `cc`, `bcc`
- Output: JSON object ready to pass to `send_email` or `create_draft`
- Returns error text if templateId not found

## File Plan

| File | Change |
|------|--------|
| `src/utils/templates.ts` | New — schema, cache, `getTemplates()`, `applyVariables()` |
| `src/utils/templates.test.ts` | New — TDD tests for all above |
| `src/index.ts` | Add tool definitions + dispatch blocks |
| `src/index.test.ts` | Add tests for new tool dispatch |
