# Phase 28: Audit Logging — Context

## Goal

Log every MCP tool invocation to a local append-only JSONL audit file so operators and users can review what the AI agent did with their email account.

## Current State

- Tool dispatch happens in `MailMCPServer.setupToolHandlers()` in `src/index.ts` (line 876+)
- The `CallToolRequestSchema` handler is the single choke-point for all tool calls
- There is also a `dispatchTool()` method used in tests
- Config constants live in `src/config.ts` — `ACCOUNTS_PATH` is defined there
- No logging of tool invocations exists today

## Key Decisions (from auto_decisions)

- Log to `~/.config/mail-mcp/audit.log` (append-only JSONL format)
- Each log entry: `{ timestamp, tool, accountId, args (sanitized), success, error? }`
- Enable/disable via `--audit-log` CLI flag (default: off)
- Add logging as middleware in the `CallToolRequestSchema` handler (wraps `dispatchTool`)
- Sanitize: strip `password`, `refreshToken`, `clientSecret` from logged args
- JSONL format (one JSON object per line) for easy grep/jq parsing
- Create `AuditLogger` utility class with `log()` method in `src/utils/audit-logger.ts`

## Integration Points

- `src/index.ts` main `MailMCPServer` constructor: accept `auditLogger` or `auditLog` flag
- `src/config.ts`: add `AUDIT_LOG_PATH` constant alongside `ACCOUNTS_PATH`
- `src/utils/audit-logger.ts`: new file — `AuditLogger` class
- `src/utils/audit-logger.test.ts`: TDD tests

## Sensitive Fields to Strip

```
password, refreshToken, clientSecret, token, secret, key, auth
```

Only strip top-level fields named exactly one of these (case-insensitive match).

## Audit Entry Shape

```typescript
interface AuditEntry {
  timestamp: string;   // ISO 8601
  tool: string;        // tool name
  accountId?: string;  // from args if present
  args: Record<string, unknown>;  // sanitized
  success: boolean;
  durationMs: number;
  error?: string;      // if success=false
}
```
