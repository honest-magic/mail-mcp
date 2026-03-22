# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- Kebab-case for feature directories: `src/cli/`, `src/protocol/`, `src/services/`, `src/security/`, `src/utils/`
- PascalCase for class files: `imap.ts`, `smtp.ts`, `keychain.ts`, `oauth2.ts`
- camelCase for utility/helper functions: `markdown.ts` contains function exports
- `.test.ts` suffix for test files (e.g., `index.test.ts`, `accounts.test.ts`)
- Files in `src/types/` use `index.ts` for type exports

**Functions:**
- camelCase for all function names: `listMessages()`, `getAccounts()`, `saveCredentials()`, `handleAccountsCommand()`
- Async functions follow same convention: `connect()`, `disconnect()`, `sendEmail()`, `loadCredentials()`
- Private methods use camelCase with underscore prefix (TypeScript private modifier preferred): `private async ensureSmtp()`

**Variables:**
- camelCase for local variables, parameters, and properties: `authConfig`, `messageId`, `threadId`, `accountId`, `startDate`
- CONSTANT_CASE for module-level constants: `WRITE_TOOLS`, `ACCOUNTS_PATH`, `READ_TOOL_NAMES`
- Boolean variables prefixed with `is`, `has`, or `can`: `isHtml`, `hasAttachments`, `canDelete`, `smtpConnected`

**Types:**
- PascalCase for interfaces: `MessageMetadata`, `EmailAccount`, `Credentials`, `ParsedMail`
- Union types use PascalCase: `AuthType = 'login' | 'oauth2'`
- Generic type parameters use PascalCase: `Map<string, MailService>`

**Classes:**
- PascalCase for class names: `ImapClient`, `SmtpClient`, `MailService`, `MailMCPServer`

## Code Style

**Formatting:**
- TypeScript 5.9.3 compiler, strict mode enabled
- No ESLint or Prettier configured (formatting follows implicit conventions)
- 2-space indentation (inferred from codebase)
- Line length approximately 100-120 characters (observed pattern)

**Linting:**
- `tsconfig.json` enforces strict mode:
  - `forceConsistentCasingInFileNames: true`
  - `strict: true` (all strict checks enabled)
  - `skipLibCheck: true` (skip type checking of declarations)
- Target: ES2022, module: NodeNext (native ESM)

**Module System:**
- ES modules throughout: `import/export` syntax required
- File extensions required in imports: `import { X } from './file.js'` (not `./file`)
- `type` imports used for type-only declarations: `import type { EmailAccount } from '../types/index.js'`

## Import Organization

**Order:**
1. Node.js built-in modules: `import * as fs from 'node:fs'`, `import { parseArgs } from 'node:util'`
2. Third-party packages: `import { ImapFlow } from 'imapflow'`, `import { z } from 'zod'`
3. Relative imports from same project: `import { ImapClient } from '../protocol/imap.js'`
4. Type imports grouped separately: `import type { EmailAccount } from '../types/index.js'`

**Path Aliases:**
- No path aliases configured; relative imports used throughout
- Imports always include file extension: `.js` suffix required for ESM compatibility

## Error Handling

**Patterns:**
- Throw descriptive Error objects for unrecoverable conditions:
  - `throw new Error('Not connected')` in protocol clients
  - `throw new Error(`Account ${accountId} not found in configuration.`)` for missing resources
  - `throw new Error('No attachments found in this email')` for validation failures

- Try-catch blocks for known failure modes:
  - `src/config.ts`: catches JSON parse errors, returns empty array as fallback
  - `src/security/keychain.ts`: catches credential loading failures, logs and returns null
  - `src/services/mail.ts`: catches append-to-sent-folder failures, logs but continues
  - `src/cli/accounts.ts`: catches keychain removal when credentials don't exist

- Error logging via `console.error()`:
  - Logs unrecoverable errors with context: `console.error('Failed to load credentials for ${accountId}:', error)`
  - Logs warnings for non-fatal failures: `console.error('Warning: could not remove keychain entry')`

- MCP protocol errors use `McpError`:
  - `throw new McpError(ErrorCode.MethodNotFound, 'Tool not found: ${name}')`
  - Used in `src/index.ts` for invalid tool dispatch

## Logging

**Framework:** `console` (built-in, no logger library)

**Patterns:**
- `console.error()` for errors, warnings, and diagnostics
- `console.log()` for user-facing CLI output
- No info/debug logging levels — production-like behavior
- ImapFlow client initialized with `logger: false` to silence debug output

**When to Log:**
- Configuration loading failures in `config.ts`
- Credential loading failures in `keychain.ts`
- Append-to-sent failures in `mail.ts`
- CLI operation results (success/failure messages)
- Process initialization (e.g., "Mail MCP server running on stdio")

## Comments

**When to Comment:**
- Clarify non-obvious logic or workarounds:
  - `// Build raw message before sending so we can append to Sent folder` in `mail.ts`
  - `// Convert inline images to base64 if needed` explains why conversion happens
  - `// Some modules have a .default property when imported via dynamic import in ESM` explains fallback pattern

- Explain assumptions about external behavior:
  - `// nodemailer transporter doesn't strictly need closing, but good practice if pooling`
  - `// Gmail-specific threadId lookup, fall back to Message-ID for non-Gmail`

- Document implementation constraints:
  - `// Take only the last 'count' messages` in message fetch operations
  - `// For test purposes — other tools require a real service connection` in mocked tool dispatch

**JSDoc/TSDoc:**
- JSDoc comments used for exported functions in `config.ts`:
  ```typescript
  /**
   * Writes account definitions to ~/.config/mail-mcp/accounts.json.
   * Creates the directory if it does not exist.
   */
  export function saveAccounts(accounts: EmailAccount[]): void
  ```

- JSDoc used for CLI function in `accounts.ts`:
  ```typescript
  /**
   * Handle `mail-mcp accounts <subcommand>` CLI commands.
   *
   * Returns true if a CLI subcommand was handled (caller should process.exit),
   * false if not a CLI command (caller should start the MCP server).
   */
  export async function handleAccountsCommand(args: string[]): Promise<boolean>
  ```

- No JSDoc for most class methods or internal functions

## Function Design

**Size:**
- Methods typically 10-50 lines
- Large file is `src/index.ts` (618 lines) due to extensive tool definition boilerplate
- Protocol clients (`imap.ts`, `smtp.ts`) range 60-277 lines
- Architectural justification: tool dispatch requires inline schema definition and implementation

**Parameters:**
- Positional parameters for required values: `listMessages(folder: string = 'INBOX', count: number = 10)`
- Default parameter values used: `folder: string = 'INBOX'`, `count: number = 10`, `readOnly: boolean = false`
- Optional chaining used for derived values: `message.envelope?.from?.[0]?.address`
- Destructuring used for complex object parameters: `{ from?: string, subject?: string, since?: string ... }`

**Return Values:**
- Async functions return `Promise<T>`: `Promise<void>`, `Promise<MessageMetadata[]>`, `Promise<string>`
- Void returns for side-effect operations: `saveAccounts()`, `connect()`, `sendEmail()`
- Array returns for collections: `listMessages()`, `listFolders()`, `getThread()`
- Object returns for structured data: `downloadAttachment()` returns `{ content: Buffer, contentType: string }`
- Nullable returns for optional data: `loadCredentials()` returns `Promise<string | null>`
- Tuple returns for multiple values: Not used in this codebase

## Module Design

**Exports:**
- Named exports for functions and classes: `export function saveAccounts()`, `export class ImapClient`
- Default export avoided; all exports are named
- Type exports separate: `export type AuthType = 'login' | 'oauth2'`, `export interface EmailAccount`

**Barrel Files:**
- `src/types/index.ts` exports all type definitions: `export type AuthType`, `export interface EmailAccount`, `export interface Credentials`
- No other barrel files used (each module exports its own)

**Lazy Loading:**
- Dynamic imports used in specific cases:
  - PDF parsing: `const pdf = await import('pdf-parse')`; handles default vs. named export ESM variation
  - Security module: `const { saveCredentials } = await import('./security/keychain.js')`

- Rationale: avoid unnecessary dependencies loading until required (SMTP optional, PDF parsing optional)

## Async/Await Patterns

**Connection Management:**
- Classes hold connection state: `private client: ImapFlow | null = null`
- Lazy connection pattern: SMTP connects only on first `sendEmail()` call via `ensureSmtp()`
- IMAP connects eagerly: `await service.connect()` required before operations
- Lock-based resource management: `const lock = await this.client.getMailboxLock(folder)` with finally-block release

**Error Propagation:**
- Errors propagate up (not swallowed):
  - Missing credentials throw immediately in `connect()`
  - Not-connected errors thrown in operation methods
  - Batch operation limits checked and errors thrown

- Non-critical failures logged but don't stop execution:
  - Append-to-sent failures logged in try-catch, operation continues
  - Keychain removal failures logged in accounts CLI

## Type Assertions

**Patterns:**
- `(expression as any)` used when type system can't infer:
  - `(msg as any).bodyParts?.get('TEXT')` — ImapFlow doesn't export bodyParts type
  - `(pdf as any).default || pdf` — handle ESM default export variation
  - `(operation as any).type` — unknown operation type fallback
  - `(server as any).readOnly` — accessing private fields in tests

- Type casting with `as const` for literal types: `authType: 'oauth2' as const`

- Avoidance of `unknown` type; `any` used when external library types incomplete

---

*Convention analysis: 2026-03-22*
