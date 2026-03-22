# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**Email Protocols:**
- IMAP (RFC 3501 / RFC 9051) - Email retrieval and folder management
  - Client: `imapflow` library
  - Configuration: `EmailAccount.host`, `EmailAccount.port`, `EmailAccount.useTLS`
  - Auth: Password (login) or OAuth2 access token

- SMTP (RFC 5321) - Email sending
  - Client: `nodemailer` library
  - Configuration: `EmailAccount.smtpHost`, `EmailAccount.smtpPort`
  - Auth: Password (login) or OAuth2 access token
  - Ports: 465 (implicit TLS), 587 (STARTTLS, default if port 587)

**OAuth2 Token Refresh:**
- Generic OAuth2 token endpoint
  - Implementation: `src/security/oauth2.ts`
  - Used by: `getValidAccessToken()` function
  - Exchange: refresh_token → access_token via POST to tokenEndpoint
  - Env var: None (configured per-account in keychain)
  - Supported providers: Any OAuth2-compliant service (Gmail, Microsoft, Yahoo, etc.)

## Data Storage

**Credential Storage:**
- **Local OS Keychain (primary method):**
  - Service: `cross-keychain` library
  - Service name: `ch.honest-magic.config.mail-server` (configurable via `SERVICE_NAME` env var)
  - Storage locations:
    - macOS: Keychain
    - Windows: Credential Manager
    - Linux: secret-tool / DBus secrets service
  - What's stored: Account passwords or OAuth2 token bundles (clientId, clientSecret, refreshToken, tokenEndpoint, accessToken, expiryDate)
  - Implementation: `src/security/keychain.ts`

- **Account Configuration File:**
  - Location: `~/.config/mail-mcp/accounts.json`
  - Format: JSON array
  - Contents: Account metadata (id, name, host, port, smtpHost, smtpPort, user, authType, useTLS)
  - NOTE: Passwords are NOT stored here; only in keychain

**Databases:**
- None - This is a stateless MCP server. Email data is read-only from remote IMAP servers; no local database.

**File Storage:**
- Local filesystem only (temporary attachment downloads)
- No permanent file storage

**Caching:**
- None - All email operations are direct IMAP/SMTP protocol calls

## Authentication & Identity

**Auth Methods:**

1. **Password (login) Auth:**
   - Type: Standard IMAP/SMTP username + password
   - Storage: OS keychain via `cross-keychain`
   - Flow: User provides password during account setup → stored in keychain → retrieved on connection
   - Used by: `ImapClient.connect()`, `SmtpClient.connect()` when `authType: 'login'`
   - Implementation: `src/security/keychain.ts`, `src/protocol/imap.ts`, `src/protocol/smtp.ts`

2. **OAuth2 (bearer token) Auth:**
   - Type: OAuth2 grant_type=refresh_token
   - Token Endpoint: User-configurable per account
   - Storage: Keychain stores full OAuth2 bundle (clientId, clientSecret, refreshToken, tokenEndpoint, accessToken, expiryDate)
   - Flow:
     1. `register_oauth2_account` MCP tool stores credentials in keychain
     2. `getValidAccessToken()` checks if token is expired (with 60s buffer)
     3. If expired, refreshes via POST to tokenEndpoint
     4. Returns valid accessToken for IMAP/SMTP auth
   - Automatic Refresh: Yes - tokens refresh 60 seconds before expiry
   - Used by: `ImapClient.connect()`, `SmtpClient.connect()` when `authType: 'oauth2'`
   - Implementation: `src/security/oauth2.ts`, `src/security/keychain.ts`

**Key Configuration:**
- Account ID: Unique identifier for keychain lookups (e.g., 'work', 'personal')
- Service Name: `ch.honest-magic.config.mail-server` (environment variable: `SERVICE_NAME`)

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to console only

**Logs:**
- Console stderr logging
- Configuration: `LOG_LEVEL` environment variable (default: 'info')
- Implementation: `console.error()` throughout codebase for errors and warnings

## CI/CD & Deployment

**Hosting:**
- Local - Designed to run on user's machine (macOS, Windows, Linux)
- Runs as stdio transport MCP server (stdin/stdout for communication)

**CI Pipeline:**
- None configured - No GitHub Actions or CI workflows present

**Package Distribution:**
- npm package: `@honest-magic/mail-mcp`
- Installed via: `npm install -g @honest-magic/mail-mcp` or `npx @honest-magic/mail-mcp`

## Environment Configuration

**Required Environment Variables:**
- None strictly required (all have sensible defaults)

**Optional Environment Variables:**
- `SERVICE_NAME` - OS keychain service identifier (default: `ch.honest-magic.config.mail-server`)
- `LOG_LEVEL` - Logging level (default: `info`)

**Secrets Location:**
- Passwords and OAuth2 tokens: OS keychain (via `cross-keychain`)
- Service name: `ch.honest-magic.config.mail-server`
- Account identifier: Each account's unique ID (e.g., 'work', 'personal')

## Webhooks & Callbacks

**Incoming:**
- None - This is a pull-based model (MCP tools request data)

**Outgoing:**
- None - No webhooks or callbacks sent to external services

---

*Integration audit: 2026-03-22*
