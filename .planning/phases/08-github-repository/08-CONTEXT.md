# Phase 8: GitHub Repository - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a public GitHub repository under `honest-magic/mail-mcp`, push all existing local commits to `main`, and write a README that lets any consumer install and configure the server in under five minutes.

</domain>

<decisions>
## Implementation Decisions

### README Structure
- Sections order: Installation → Configuration → Tools → Read-Only Mode
- Installation methods: npx (primary), global install (`npm i -g`), Claude Desktop JSON snippet
- Tool documentation: table of all 14 tools with name + one-line description (no params)
- Tone: concise, technical — no marketing copy

### MCP Client Configuration
- Show both Claude Desktop (`claude_desktop_config.json`) and a generic MCP client snippet
- Use full JSON block with `mcpServers` wrapper
- Credential setup: full inline walkthrough covering:
  1. `ACCOUNTS_JSON` env variable with full JSON structure example
  2. macOS Keychain password storage via `security add-generic-password -s com.mcp.mail-server -a <account-id> -w <password>`
  3. OAuth2 setup via `register_oauth2_account` MCP tool

### GitHub Repo Setup
- Repo description: `"MCP server for IMAP/SMTP email access — works with Claude and other MCP clients"`
- Topics: `mcp`, `email`, `imap`, `smtp`, `claude`, `ai-tools`
- Push full existing commit history to `main`
- Branch protection: require PR reviews on `main`

### Claude's Discretion
- Exact wording of README sections (within concise/technical constraint)
- README section ordering beyond the top-level structure
- Any badges or shields.io additions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 14 tools in `src/index.ts`: `list_accounts`, `list_emails`, `search_emails`, `read_email`, `send_email`, `create_draft`, `list_folders`, `move_email`, `modify_labels`, `get_thread`, `get_attachment`, `extract_attachment_text`, `register_oauth2_account`, `batch_operations`
- `--read-only` flag: filters write tools (`send_email`, `create_draft`, `move_email`, `modify_labels`, `batch_operations`, `register_oauth2_account`) and shows MCP instructions message
- Account config: `ACCOUNTS_JSON` env var (JSON array of `EmailAccount`: `id`, `name`, `host`, `port`, `smtpHost?`, `smtpPort?`, `user`, `authType: 'login'|'oauth2'`, `useTLS`)
- Credentials: macOS Keychain via `cross-keychain`, service name `com.mcp.mail-server`
- Package name: `@honest-magic/mail-mcp`, bin: `mail-mcp` → `dist/index.js`
- Node.js ≥18 required (engines field in package.json)

### Established Patterns
- ESM TypeScript, outputs to `dist/`
- `npm run build` = `tsc`

### Integration Points
- README `files` field references `README.md` — README must exist at repo root before `npm publish` works correctly
- Phase 9 (GitHub Actions) will reference `.github/workflows/` directory — no conflicts with this phase

</code_context>

<specifics>
## Specific Ideas

- Branch protection: require PR reviews on `main` (user explicitly requested)
- Show Claude Desktop config AND generic MCP config example (user requested multiple clients)
- Full credential walkthrough — user confirmed wanting complete setup instructions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
