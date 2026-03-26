# Phase 34 Context: Install Claude CLI Command

## User Vision

Running `mail-mcp --install-claude` should be a single command that sets up the MCP server configuration for Claude Desktop — no manual JSON editing required.

## Key Facts

### Claude Desktop config path (macOS)
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Current config structure (observed)
```json
{
  "mcpServers": {
    "mail": {
      "command": "/opt/homebrew/bin/mail-mcp"
    }
  }
}
```

### Claude Code CLI settings path
`~/.claude/settings.json` — uses different schema (hooks, statusLine, etc.), does NOT have `mcpServers`. Claude Code CLI MCP servers are configured differently. For now, support only Claude Desktop.

### Binary path strategy
Use `process.execPath` (node binary) is wrong — need the mail-mcp binary. Use:
1. Try `which mail-mcp` via child_process
2. Fall back to resolving from `import.meta.url` (dist/index.js → project root)
3. Last resort: use `process.argv[1]` (the script being run)

### MCP entry format
```json
{
  "mcpServers": {
    "mail": {
      "command": "/path/to/mail-mcp"
    }
  }
}
```

## Behavior

1. Detect binary path (which mail-mcp → argv[1])
2. Read existing Claude Desktop config (create if missing, create dir if missing)
3. Merge: add/update `mcpServers.mail` entry, preserve all other keys
4. Write back with 2-space indent
5. Print: "mail-mcp configured for Claude Desktop at: /path/config.json\nRestart Claude Desktop to activate.\nServer path: /path/to/mail-mcp"
6. Exit 0

## Error Cases
- Config dir doesn't exist → create it
- Config file doesn't exist → create with minimal `{"mcpServers": {...}}`
- Config file is malformed JSON → print error and exit 1
- Binary not found anywhere → print error and exit 1

## Implementation Location

New file: `src/cli/install-claude.ts`
Function: `installClaude(): Promise<void>`
Called from `main()` in `src/index.ts` when `--install-claude` flag is present.
