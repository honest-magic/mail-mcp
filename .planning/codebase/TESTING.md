# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- Vitest 4.1.0
- Config: `vitest.config.ts`
- Environment: Node.js

**Assertion Library:**
- Vitest built-in assertions (expect syntax)
- No external assertion library

**Run Commands:**
```bash
npm test              # Run all tests (vitest run)
npm test -- --watch  # Watch mode
# Coverage not configured
```

**Test Execution:**
- 8 test files with 72 tests total
- All tests passing
- Execution time: ~501ms

## Test File Organization

**Location:**
- Co-located with source files using `.test.ts` suffix
- Test files in same directory as implementation:
  - `src/index.test.ts` alongside `src/index.ts`
  - `src/config.test.ts` alongside `src/config.ts`
  - `src/cli/accounts.test.ts` alongside `src/cli/accounts.ts`
  - `src/protocol/imap.test.ts` alongside `src/protocol/imap.ts`
  - `src/protocol/smtp.test.ts` alongside `src/protocol/smtp.ts`
  - `src/services/mail.test.ts` alongside `src/services/mail.ts`
  - `src/security/keychain.test.ts` alongside `src/security/keychain.ts`

**Naming:**
- Pattern: `{module-name}.test.ts`
- Examples: `index.test.ts`, `accounts.test.ts`, `imap.test.ts`

**Structure:**
```
src/
├── index.ts
├── index.test.ts
├── config.ts
├── config.test.ts
├── cli/
│   ├── accounts.ts
│   └── accounts.test.ts
├── protocol/
│   ├── imap.ts
│   ├── imap.test.ts
│   ├── smtp.ts
│   └── smtp.test.ts
└── services/
    ├── mail.ts
    └── mail.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock setup at top
vi.mock('../config.js', () => ({
  getAccounts: vi.fn().mockReturnValue([]),
}));

// Import after mocks
import { MailMCPServer } from './index.js';

// Suite
describe('ROM-01: readOnly constructor field', () => {
  it('Test A: MailMCPServer constructed with readOnly=false has this.readOnly === false', () => {
    const server = new MailMCPServer(false);
    expect((server as any).readOnly).toBe(false);
  });
});
```

**Patterns:**

1. **Mock setup before imports** (critical order):
   ```typescript
   vi.mock('../config.js', () => ({ /* ... */ }));
   vi.mock('../protocol/imap.js', () => ({ /* ... */ }));

   import { MailMCPServer } from './index.js'; // After mocks
   ```

2. **Named test identifiers** (RFC-style naming):
   - Test suites: `ROM-01`, `ROM-02`, `ROM-05`, `IMAP-03`, `IMAP-04`, `ORG-01`, `ORG-02`, `SMTP-02`
   - Individual tests: `Test A`, `Test B`, `Test C`, etc.
   - Purpose: Traceability to requirements/issues

3. **beforeEach for setup and cleanup**:
   ```typescript
   beforeEach(() => {
     vi.resetAllMocks();
     consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
     mockedOs.homedir.mockReturnValue('/home/testuser');
   });
   ```

4. **Test data constants**:
   ```typescript
   const TEST_ACCOUNT = {
     id: 'work',
     name: 'Work Email',
     host: 'imap.example.com',
     // ...
   };
   ```

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**

1. **Mocking modules with vi.mock()**:
   ```typescript
   vi.mock('imapflow', () => {
     return {
       ImapFlow: vi.fn().mockImplementation(function() {
         return {
           connect: vi.fn().mockResolvedValue(undefined),
           logout: vi.fn().mockResolvedValue(undefined),
           getMailboxLock: vi.fn().mockResolvedValue({
             release: vi.fn()
           }),
           // ...
         };
       })
     };
   });
   ```

2. **Creating named mock functions for reuse**:
   ```typescript
   const mockSearchEmails = vi.fn().mockResolvedValue([
     { id: '42', uid: 42, subject: 'Found Email', from: 'sender@example.com' }
   ]);

   vi.mock('./services/mail.js', () => ({
     MailService: vi.fn().mockImplementation(() => ({
       searchEmails: mockSearchEmails,
       sendEmail: vi.fn().mockResolvedValue(undefined),
     })),
   }));
   ```

3. **Accessing mocked functions**:
   ```typescript
   const mockedFs = vi.mocked(fs);
   const mockedGetAccounts = vi.mocked(getAccounts);

   mockedFs.existsSync.mockReturnValue(false);
   mockedGetAccounts.mockReturnValue([]);
   ```

4. **Spying on console methods**:
   ```typescript
   const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
   const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

   // Later:
   expect(consoleSpy).toHaveBeenCalledWith('Expected output');
   ```

5. **Mocking process.exit**:
   ```typescript
   const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
     throw new Error(`process.exit(${code})`);
   });
   ```

**What to Mock:**
- External services and protocols: ImapFlow, nodemailer, cross-keychain
- File system operations: `node:fs`, `node:os`
- Credential loaders: keychain, OAuth2 token providers
- Configuration loaders: reading accounts.json
- Child modules: protocol clients, security modules

**What NOT to Mock:**
- Core async/await behavior
- Error throwing (allow real Error objects)
- Type definitions and interfaces
- Core utility functions

## Fixtures and Factories

**Test Data:**
```typescript
const TEST_ACCOUNT: EmailAccount = {
  id: 'work',
  name: 'Work Email',
  host: 'imap.example.com',
  port: 993,
  user: 'you@example.com',
  authType: 'login' as const,
  useTLS: true,
};

const WRITE_TOOL_NAMES = [
  'send_email',
  'create_draft',
  'move_email',
  'modify_labels',
  'register_oauth2_account',
  'batch_operations',
];

const READ_TOOL_NAMES = [
  'list_accounts',
  'list_emails',
  'search_emails',
  'read_email',
  'list_folders',
  'get_thread',
  'get_attachment',
  'extract_attachment_text',
];
```

**Location:**
- Constants defined at module level in test files
- No separate fixtures directory
- Mock implementations defined inline with `vi.mock()`

## Coverage

**Requirements:** Not configured/enforced

**Current Status:**
- 72 tests across 8 test files
- No coverage reports generated
- Visible gaps: utility functions (`markdown.ts`), OAuth2 module, sanity checks

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes in isolation
- Approach: Mock all dependencies, test single units
- Example from `config.test.ts`:
  ```typescript
  it('returns empty array when config file does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const { getAccounts } = await import('./config.js');
    const result = getAccounts();
    expect(result).toEqual([]);
  });
  ```

**Integration Tests:**
- Scope: Multiple modules together with mocked external APIs
- Approach: Mock ImapFlow/nodemailer but integrate service layer
- Example from `mail.test.ts`:
  ```typescript
  it('SMTP connects lazily on first sendEmail', async () => {
    const account = { /* ... */ };
    const service = new MailService(account, false);
    await service.connect();
    expect(mockSmtpConnect).not.toHaveBeenCalled();
    await service.sendEmail('to@test.com', 'subject', 'body');
    expect(mockSmtpConnect).toHaveBeenCalledTimes(1);
  });
  ```

**E2E Tests:**
- Not implemented; would require real IMAP/SMTP servers

## Common Patterns

**Async Testing:**
```typescript
it('should fetch message body', async () => {
  const client = new ImapClient(account);
  await client.connect();
  const parsed = await client.fetchMessageBody('1', 'INBOX');
  expect(parsed.subject).toBeDefined();
});

// Or with beforeEach
beforeEach(async () => {
  mockImapConnect.mockClear();
});

it('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it('throws when not connected', () => {
  const client = new ImapClient(account);
  expect(() => client.listMessages()).rejects.toThrow('Not connected');
});

// Testing process.exit via error throwing
it('exits on invalid subcommand', async () => {
  await expect(handleAccountsCommand(['accounts', 'unknown']))
    .rejects.toThrow('process.exit(1)');
});
```

**Testing private fields**:
```typescript
it('readOnly field is set correctly', () => {
  const server = new MailMCPServer(true);
  expect((server as any).readOnly).toBe(true); // Type assertion to access private
});
```

**Testing method calls on mocks:**
```typescript
it('calls listMessages with folder and count', async () => {
  const mockList = vi.fn().mockResolvedValue([]);
  const service = createMockService({ listMessages: mockList });

  await service.listMessages('INBOX', 5);

  expect(mockList).toHaveBeenCalledWith('INBOX', 5);
  expect(mockList).toHaveBeenCalledTimes(1);
});
```

**Testing console output:**
```typescript
it('prints accounts in formatted table', async () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  mockedGetAccounts.mockReturnValue([TEST_ACCOUNT]);

  await listAccounts();

  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('ID')
  );
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('work')
  );
});
```

**Testing conditionals:**
```typescript
it('filters write tools in read-only mode', () => {
  const server = new MailMCPServer(true);
  const tools = (server as any).getTools(true);
  const names = tools.map((t: any) => t.name);

  for (const writeTool of WRITE_TOOL_NAMES) {
    expect(names).not.toContain(writeTool);
  }
});
```

## Test Coverage Gaps

**Untested areas:**
1. **Utilities**: `src/utils/markdown.ts` - HTML to markdown conversion has no tests
2. **OAuth2 flow**: `src/security/oauth2.ts` - token refresh and validation logic not fully tested
3. **Edge cases in IMAP**:
   - Thread ID handling with non-Gmail servers
   - Message parsing with mixed content types
   - Large attachment handling
4. **SMTP edge cases**:
   - Transport failures and retries
   - Connection pooling behavior
5. **CLI interactive input**:
   - Account addition workflow (uses readline, hard to test)
   - User input validation edge cases
6. **Protocol client error recovery**:
   - Connection timeouts
   - Partial failures in batch operations
   - Lock acquisition failures

**Risk:** Protocol clients have lower test coverage than higher-level services; bugs in IMAP/SMTP handling less likely to be caught early.

---

*Testing analysis: 2026-03-22*
