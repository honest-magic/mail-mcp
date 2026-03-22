# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.9.3 - All production and test code, compiled to ES2022

**Runtime:**
- JavaScript (Node.js >=18.0.0)

## Runtime

**Environment:**
- Node.js >= 18.0.0

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` 1.27.1 - Model Context Protocol server framework for stdio transport and tool handling

**Protocol & Email:**
- `imapflow` 1.2.16 - IMAP client with async/await, native IDLE, connection locking, Gmail threading support
- `nodemailer` 8.0.3 - SMTP client for sending email, supports multiple transports
- `mailparser` 3.9.4 - MIME message parser for extracting content, headers, attachments

**Testing:**
- `vitest` 4.1.0 - Unit test framework with Vitest runner
- Environment: Node.js

**Build/Dev:**
- `typescript` 5.9.3 - TypeScript compiler
- `ts-node` 10.9.2 - TypeScript execution runtime for development

## Key Dependencies

**Critical:**
- `imapflow` 1.2.16 - IMAP protocol implementation; handles email retrieval, search, flags, threading
- `nodemailer` 8.0.3 - SMTP protocol implementation; handles email sending and storage
- `@modelcontextprotocol/sdk` 1.27.1 - Enables this server to function as an MCP server

**Infrastructure & Utilities:**
- `cross-keychain` 1.1.0 - OS-level credential storage (macOS Keychain, Windows Credential Manager, Linux secret-tool)
- `dotenv` 17.3.1 - Environment variable loading from `.env` files
- `zod` 4.3.6 - Schema validation for configuration objects
- `mailparser` 3.9.4 - MIME parsing for email content extraction
- `pdf-parse` 2.4.5 - PDF text extraction from email attachments
- `turndown` 7.2.2 - HTML to Markdown conversion for email body processing

## Configuration

**Environment:**
- `SERVICE_NAME` - OS keychain service identifier (default: `ch.honest-magic.config.mail-server`)
- `LOG_LEVEL` - Application logging level (default: `info`)

**Account Configuration:**
- Location: `~/.config/mail-mcp/accounts.json`
- Format: JSON array of EmailAccount objects
- Fields: `id`, `name`, `host`, `port`, `smtpHost` (optional), `smtpPort` (optional), `user`, `authType` (login|oauth2), `useTLS`

## Build

**Compilation:**
- Target: ES2022
- Module: NodeNext (ESM)
- Output: `./dist/`
- Source: `./src/`
- Declaration: true (emits `.d.ts` files)
- SourceMaps: true

**Build Command:**
```bash
npm run build  # Runs `tsc`
```

**TypeScript Configuration (`tsconfig.json`):**
- Strict mode enabled
- Force consistent casing
- Skip lib check for faster builds
- Exclude: node_modules, dist, test files

## Scripts

```bash
npm run build              # Compile TypeScript to dist/
npm start                 # Run compiled server: node dist/index.js
npm test                  # Run vitest in run mode (no watch)
```

## Binary/Entry Point

**CLI Binary:**
- Name: `mail-mcp`
- Location (when installed): `dist/index.js`
- Configured in `package.json` `bin` field
- Installed via npm/npx as `mail-mcp` command

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm or compatible package manager
- TypeScript 5.9.3 support
- Operating system with native credential storage support:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: secret-tool / DBus secrets

**Production:**
- Node.js >=18.0.0
- OS credential storage (for password/token management)
- Network access to IMAP and SMTP servers
- TLS 1.2+ support for secure email protocol connections

---

*Stack analysis: 2026-03-22*
