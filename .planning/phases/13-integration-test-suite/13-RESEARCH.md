# Phase 13: Integration Test Suite - Research

**Researched:** 2026-03-22
**Domain:** Vitest integration test isolation, smtp-server in-process fixture, IMAP credential gating
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SMTP tests: Use `smtp-server` (Nodemailer org, v3.18.1) as in-process fixture — real send/receive without network
- IMAP tests: Use real credentials via CI secrets (no viable in-process IMAP server exists). Skip when credentials absent.
- Test isolation: Separate vitest config for integration tests (`vitest.integration.config.ts`)
- `npm run test:integration` script in package.json
- Integration tests must NOT appear in or interfere with default `npm test` run
- `smtp-server` is a devDependency
- Tests guarded with `describe.skipIf(!process.env.TEST_IMAP_HOST)` for IMAP
- CJS interop: `smtp-server` is CJS but Node.js allows CJS default import from ESM

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-02 | Integration test suite covers SMTP send (via smtp-server) and IMAP operations (via real credentials in CI) | smtp-server v3.18.1 confirmed at current version; vitest `--config` flag plus `include` glob isolates integration tests from unit suite; `describe.skipIf(!process.env.TEST_IMAP_HOST)` confirmed as idiomatic vitest pattern |
</phase_requirements>

## Summary

Phase 13 creates an integration test suite that runs alongside but separately from the existing unit tests. The two distinct test populations are: (1) SMTP send/receive validated against an in-process `smtp-server` fixture with no mocking, and (2) IMAP operations validated against real server credentials injected via environment variables. Both live under a dedicated vitest config (`vitest.integration.config.ts`) invoked by `npm run test:integration`, which uses a different `include` glob pattern so it never conflicts with `npm test`.

The technical spine of the SMTP side is `smtp-server` (Nodemailer org, CJS, v3.18.1 — confirmed current). The server is started in `globalSetup`, its dynamically-assigned port is shared to tests via vitest's `provide/inject` API, and torn down in `teardown`. The SMTP test creates a nodemailer transporter pointed at `localhost:<injectedPort>` with no TLS and no auth, sends a message, and asserts the `onData` callback captured it. The IMAP side uses `describe.skipIf(!process.env.TEST_IMAP_HOST)` to skip cleanly (exit 0, printed skip message) when credentials are absent, which is the correct behaviour for developer workstations without CI secrets.

**Primary recommendation:** Use `vitest.integration.config.ts` with `include: ['tests/integration/**/*.integration.test.ts']`, `globalSetup` for the smtp-server lifecycle, and `describe.skipIf` for IMAP gating.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `smtp-server` | `3.18.1` | In-process SMTP server fixture | Nodemailer org, same ecosystem as nodemailer, zero network dependency, reliable onData stream API |
| `@types/smtp-server` | `3.5.12` | TypeScript types for smtp-server | Official types package, matches 3.x API |
| `vitest` | `4.1.0` (already installed) | Test runner for integration suite | Already the project test runner; `--config` flag and `include` glob handle isolation natively |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nodemailer` | already a dep | SMTP client transport for send-side of integration test | Re-use existing dep to create a transporter pointed at the smtp-server fixture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| smtp-server in-process | Ethereal Email (nodemailer test account) | Ethereal requires network; smtp-server is localhost-only and fully deterministic |
| smtp-server in-process | mailhog / mailpit via Docker | Docker adds external process management; smtp-server is pure Node.js in-process |
| describe.skipIf | separate vitest project per env | Simpler; single config file is easier to maintain |

**Installation:**
```bash
npm install --save-dev smtp-server @types/smtp-server
```

**Version verification:** Confirmed against npm registry 2026-03-22:
- `smtp-server`: `3.18.1` (latest)
- `@types/smtp-server`: `3.5.12` (latest)

## Architecture Patterns

### Recommended Project Structure
```
tests/
└── integration/
    ├── smtp.integration.test.ts   # send/receive cycle against smtp-server fixture
    └── imap.integration.test.ts   # list/search against real server (skipIf-guarded)
vitest.integration.config.ts       # separate vitest config, include: tests/integration/**
```

### Pattern 1: Separate vitest config with `include` glob isolation

**What:** A second `vitest.integration.config.ts` at the project root configures vitest to only discover `*.integration.test.ts` files. The default `vitest.config.ts` only matches `src/**/*.test.ts`. These two globs do not overlap — integration tests are never picked up by `npm test`.

**When to use:** Always. This is the only way to satisfy the requirement that integration tests do not appear in or interfere with the default `npm test` run.

**Example:**
```typescript
// vitest.integration.config.ts
// Source: https://vitest.dev/config/ — --config flag + include option
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    globalSetup: ['tests/integration/setup.ts'],
  },
});
```

```json
// package.json scripts addition
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### Pattern 2: globalSetup for smtp-server lifecycle with provide/inject

**What:** The smtp-server is started once before all integration tests in a `globalSetup` file. Its dynamically-assigned port is shared to test files via vitest's `provide/inject` API. The server is stopped in the `teardown` export.

**When to use:** Whenever a test fixture must be initialized once and shared across multiple test files (not per-file, not per-test).

**Important caveat:** `globalSetup` runs in the main vitest process. The `provide` method only accepts serializable (JSON-serializable) values. The SMTPServer instance itself cannot be provided — only the port number (a number). The server reference must be kept in module scope within the setup file.

**Example:**
```typescript
// tests/integration/setup.ts
// Source: https://vitest.dev/config/globalsetup
import { createRequire } from 'node:module';
import type { TestProject } from 'vitest/node';

const require = createRequire(import.meta.url);
const { SMTPServer } = require('smtp-server') as typeof import('smtp-server');

let server: InstanceType<typeof SMTPServer>;
const receivedMessages: string[] = [];

export async function setup(project: TestProject) {
  server = new SMTPServer({
    secure: false,
    authOptional: true,
    onData(stream, _session, callback) {
      let data = '';
      stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      stream.on('end', () => { receivedMessages.push(data); callback(); });
    },
  });

  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const port = (server.address() as { port: number }).port;
  project.provide('smtpPort', port);
}

export async function teardown() {
  await new Promise<void>((resolve, reject) =>
    server.close((err: Error | null) => (err ? reject(err) : resolve()))
  );
}
```

```typescript
// tests/integration/smtp.integration.test.ts
import { inject } from 'vitest';
import nodemailer from 'nodemailer';

describe('SMTP send/receive cycle', () => {
  it('delivers a message end-to-end without mocked transport', async () => {
    const port = inject('smtpPort');
    const transporter = nodemailer.createTransport({
      host: 'localhost',
      port,
      secure: false,
      ignoreTLS: true,
    });
    const info = await transporter.sendMail({
      from: 'sender@test.local',
      to: 'recipient@test.local',
      subject: 'Integration test',
      text: 'Hello from integration test',
    });
    expect(info.messageId).toBeDefined();
  });
});
```

### Pattern 3: describe.skipIf for credential-gated IMAP tests

**What:** IMAP tests are wrapped in `describe.skipIf(!process.env.TEST_IMAP_HOST)`. When that env var is absent, vitest emits a skip message and the suite exits zero — satisfying the requirement for clean developer-workstation runs.

**When to use:** Any test block that depends on external credentials or live network access.

**Example:**
```typescript
// tests/integration/imap.integration.test.ts
// Source: https://vitest.dev/api/test — describe.skipIf
import { describe, it, expect } from 'vitest';
import { ImapClient } from '../../src/protocol/imap.js';

const hasImapCredentials = Boolean(process.env.TEST_IMAP_HOST);

describe.skipIf(!hasImapCredentials)('IMAP operations (requires TEST_IMAP_HOST)', () => {
  it('lists messages from INBOX', async () => {
    const account = {
      id: 'ci-test',
      name: 'CI Test',
      host: process.env.TEST_IMAP_HOST!,
      port: Number(process.env.TEST_IMAP_PORT ?? '993'),
      user: process.env.TEST_IMAP_USER!,
      authType: 'login' as const,
      useTLS: true,
    };
    // ImapClient.connect() calls loadCredentials(); bypass by providing password
    // via TEST_IMAP_PASS in a custom wrapper or by patching loadCredentials.
    // See Open Questions #1.
  });
});
```

### Anti-Patterns to Avoid

- **Including integration tests in `src/**/*.test.ts`:** This is the worst outcome — integration tests run on every `npm test` and fail on developer workstations without credentials. Keep integration tests in `tests/integration/` only.
- **Using `process.env` for port sharing from globalSetup:** Vitest workers run in separate V8 contexts. Environment variables set in `globalSetup` main process scope are NOT reliably available in worker processes. Use `provide/inject` instead.
- **Starting smtp-server in `beforeAll` inside a test file:** This creates a port-per-file and does not allow sharing across multiple integration test files. Use `globalSetup` for the single fixture.
- **Using `smtp-server` with `secure: true` in tests:** Requires certificate setup. Use `secure: false` with `authOptional: true` for test fixtures — no TLS, no auth.
- **Relying on `SMTPServer.address()` before the listen callback fires:** `address()` returns null until the server is listening. Always call it inside the listen callback or after the promise resolves.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-process SMTP server | Custom net.createServer() TCP handler | `smtp-server` | Full SMTP protocol negotiation (EHLO, DATA, dot-stuffing) is non-trivial; smtp-server handles it |
| Test port allocation | Manual port numbers e.g. 2525 | `server.listen(0, ...)` then `server.address().port` | Port 2525 may be in use in CI; OS-assigned ephemeral port is always free |
| Credential injection between processes | process.env mutation in globalSetup | vitest `provide/inject` | Workers are spawned after globalSetup; env mutations in globalSetup main scope are unreliable in workers |
| IMAP test server | Custom IMAP server | Real credentials + `describe.skipIf` | No maintained in-process IMAP server exists for Node.js (hoodiecrow is deprecated, greenlock-imap is abandoned) |

**Key insight:** SMTP protocol compliance is more complex than it appears (EHLO negotiation, dot-stuffing, SIZE extension). smtp-server handles all of this; testing against it gives realistic confidence that nodemailer's output is protocol-correct.

## Runtime State Inventory

> Not applicable — this is a greenfield testing infrastructure phase with no rename, refactor, or migration involved.

## Common Pitfalls

### Pitfall 1: CJS import of smtp-server from ESM globalSetup
**What goes wrong:** `import { SMTPServer } from 'smtp-server'` fails in ESM context with "Named export 'SMTPServer' not found" because smtp-server only has `module.exports.SMTPServer` (CJS).
**Why it happens:** Node.js ESM cannot use named imports from CJS packages directly when the package has no `exports` field mapping.
**How to avoid:** Use `createRequire` from `node:module` to require smtp-server the CJS way inside the ESM globalSetup file:
```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SMTPServer } = require('smtp-server');
```
Alternatively, use a default import: `import smtpServerModule from 'smtp-server'` then `const { SMTPServer } = smtpServerModule` — Node.js wraps CJS `module.exports` as the default ESM export.
**Warning signs:** Runtime error "Named export 'SMTPServer' not found in module" at test startup.

### Pitfall 2: Integration tests leaking into unit suite via glob overlap
**What goes wrong:** If integration test files are placed in `src/` with a `.test.ts` suffix, `vitest.config.ts`'s `include: ['src/**/*.test.ts']` will pick them up during `npm test`. The IMAP suite throws credential errors on developer workstations.
**Why it happens:** Pattern overlap between unit and integration include globs.
**How to avoid:** Place all integration tests in `tests/integration/` with `.integration.test.ts` suffix. The unit vitest config uses `src/**/*.test.ts` — these two patterns never overlap.
**Warning signs:** IMAP credential errors during `npm test` on a machine without `TEST_IMAP_HOST` set.

### Pitfall 3: describe.skipIf condition evaluated after module load
**What goes wrong:** `describe.skipIf(!process.env.TEST_IMAP_HOST)` evaluates the condition at module parse time. If env vars are set after module load (e.g., in a setupFiles file), the skip guard is already evaluated and tests run unexpectedly.
**Why it happens:** JavaScript module evaluation is synchronous and top-level.
**How to avoid:** The `TEST_IMAP_*` variables must be set before vitest spawns workers — either in the shell environment, `.env.integration` loaded by the vitest config, or in the CI workflow `env:` block.
**Warning signs:** Tests marked as skipped even though env vars are set in a setupFiles file; or tests run when they should be skipped.

### Pitfall 4: ImapClient.connect() calls loadCredentials() (macOS Keychain)
**What goes wrong:** `ImapClient.connect()` internally calls `loadCredentials(account.id)` which reads from macOS Keychain. In CI, there is no Keychain — this throws immediately.
**Why it happens:** `loadCredentials` is hardwired into the connection path.
**How to avoid:** The integration test must bypass the keychain. Options: (a) Pass IMAP password via `TEST_IMAP_PASS` env var and construct a test-specific subclass or wrapper that overrides `loadCredentials`, or (b) mock `loadCredentials` in the integration test file (vi.mock is available in integration tests), or (c) build a thin `TestImapClient` that accepts password directly. Research indicates option (b) is simplest: `vi.mock('../../src/security/keychain.js', () => ({ loadCredentials: async () => process.env.TEST_IMAP_PASS }))`.
**Warning signs:** `Error: Credentials not found for account` in CI integration test run despite correct IMAP env vars.

### Pitfall 5: smtp-server listen(0) race condition
**What goes wrong:** Code calls `server.listen(0)` then immediately checks `server.address().port` outside the listen callback — returns `null`.
**Why it happens:** TCP binding is asynchronous; `address()` is only populated after the bind completes.
**How to avoid:** Wrap `server.listen(0, 'localhost', callback)` in a Promise and await it:
```typescript
await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
const port = (server.address() as { port: number }).port;
```

## Code Examples

Verified patterns from official sources:

### smtp-server: create no-auth test fixture
```typescript
// Source: https://nodemailer.com/extras/smtp-server (official docs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SMTPServer } = require('smtp-server');

const messages: string[] = [];

const server = new SMTPServer({
  secure: false,
  authOptional: true,
  onData(stream: NodeJS.ReadableStream, _session: unknown, callback: (err?: Error | null) => void) {
    let raw = '';
    stream.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
    stream.on('end', () => { messages.push(raw); callback(); });
  },
});

await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
const port = (server.address() as { port: number }).port;
```

### vitest globalSetup with provide/inject
```typescript
// Source: https://vitest.dev/config/globalsetup
import type { TestProject } from 'vitest/node';

export async function setup(project: TestProject) {
  // start fixture, then:
  project.provide('smtpPort', port); // number — JSON serializable
}

export async function teardown() {
  // stop fixture
}
```

### vitest inject in test file
```typescript
// Source: https://vitest.dev/config/globalsetup
import { inject } from 'vitest';

const port = inject('smtpPort'); // typed as number via module augmentation
```

### TypeScript type augmentation for inject
```typescript
// tests/integration/setup.ts — add to setup file
declare module 'vitest' {
  export interface ProvidedContext {
    smtpPort: number;
  }
}
```

### describe.skipIf for credential-gated tests
```typescript
// Source: https://vitest.dev/api/test — describe.skipIf
const hasImapCredentials = Boolean(process.env.TEST_IMAP_HOST);

describe.skipIf(!hasImapCredentials)('IMAP (requires TEST_IMAP_HOST)', () => {
  // ...
});
```

### nodemailer transporter pointed at localhost fixture
```typescript
// Source: https://nodemailer.com/smtp/ (official docs)
import nodemailer from 'nodemailer';
import { inject } from 'vitest';

const port = inject('smtpPort');
const transporter = nodemailer.createTransport({
  host: 'localhost',
  port,
  secure: false,
  ignoreTLS: true,
  // no auth — smtp-server started with authOptional: true
});
const info = await transporter.sendMail({
  from: 'sender@test.local',
  to: 'recipient@test.local',
  subject: 'Integration test',
  text: 'Hello from integration test',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.env` mutation in globalSetup for data sharing | vitest `provide/inject` API | vitest v1.x | Workers are isolated; env mutations unreliable cross-process |
| Named ESM import from CJS package | `createRequire` or default import | Node.js ESM stabilization | Named imports from CJS fail without `exports` field in package.json |
| Single vitest config with `testPathPattern` flag | Separate vitest config files with `include` glob | vitest v0.x onwards | Cleaner, no CLI flag required; config is self-documenting |

**Deprecated/outdated:**
- `hoodiecrow-imap`: Deprecated ~10 years, no ESM support — confirmed out of scope in REQUIREMENTS.md.
- `mailhog`/Docker for SMTP tests: Heavyweight, external process — replaced by smtp-server in-process.

## Open Questions

1. **loadCredentials keychain bypass for IMAP integration tests**
   - What we know: `ImapClient.connect()` calls `loadCredentials(account.id)` which reads macOS Keychain; CI has no Keychain.
   - What's unclear: The cleanest bypass — mock in test file vs. thin TestImapClient wrapper vs. `TEST_IMAP_PASS` env var + vi.mock.
   - Recommendation: Use `vi.mock('../../src/security/keychain.js', () => ({ loadCredentials: vi.fn(() => Promise.resolve(process.env.TEST_IMAP_PASS)) }))` at the top of `imap.integration.test.ts`. This is the least-invasive approach and doesn't require changing production code.

2. **CI secret injection strategy**
   - What we know: CONTEXT.md says "CI secrets" for IMAP; existing `.github/workflows/ci.yml` does not have a test:integration step.
   - What's unclear: Whether to add the integration test step to `ci.yml` for v1.1.0 or leave it as optional (CONTEXT.md marks it "optional for v1.1.0").
   - Recommendation: Add an optional integration job to `ci.yml` that gates on `TEST_IMAP_HOST` secret being set (`if: secrets.TEST_IMAP_HOST != ''`). If secret is absent in a fork PR, the job skips — same behaviour as local skip. Document required GitHub secrets: `TEST_IMAP_HOST`, `TEST_IMAP_PORT`, `TEST_IMAP_USER`, `TEST_IMAP_PASS`.

3. **Message capture assertion strategy for SMTP test**
   - What we know: The `onData` callback in smtp-server accumulates raw SMTP DATA stream content. The `receivedMessages` array is in the globalSetup module scope.
   - What's unclear: Whether `receivedMessages` array in `setup.ts` scope is accessible from test files (it is NOT — `provide/inject` only passes serializable values, not mutable references).
   - Recommendation: Assert on the nodemailer `info.messageId` being defined (confirms SMTP accepted the message), plus assert the transporter did not throw. Deep content assertion requires a different strategy — e.g., an HTTP endpoint served by the globalSetup that returns captured messages. For v1.1.0, `info.messageId` assertion is sufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.integration.config.ts` (Wave 0 — does not exist yet) |
| Quick run command | `npm run test:integration` |
| Full suite command | `npm run test:integration` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-02 | SMTP send/receive completes without mocked transport | integration | `npm run test:integration` | Wave 0 |
| QUAL-02 | IMAP tests skip cleanly (exit 0) when `TEST_IMAP_HOST` absent | integration | `npm run test:integration` | Wave 0 |
| QUAL-02 | Integration suite does not appear in default `npm test` run | integration | `npm test` (assert no integration test output) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (unit suite only — no regression to unit tests)
- **Per wave merge:** `npm run test:integration` (full integration suite)
- **Phase gate:** Both `npm test` and `npm run test:integration` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.integration.config.ts` — root-level config file for integration suite
- [ ] `tests/integration/setup.ts` — globalSetup file: smtp-server lifecycle + provide(smtpPort)
- [ ] `tests/integration/smtp.integration.test.ts` — SMTP send/receive test
- [ ] `tests/integration/imap.integration.test.ts` — IMAP operations test (describe.skipIf guarded)
- [ ] `npm run test:integration` script in `package.json`
- [ ] devDependencies: `smtp-server ^3.18.1`, `@types/smtp-server ^3.5.12`

## Sources

### Primary (HIGH confidence)
- [https://nodemailer.com/extras/smtp-server](https://nodemailer.com/extras/smtp-server) — SMTPServer constructor options, onData callback, server.listen(0), server.address().port, server.close()
- [https://vitest.dev/config/globalsetup](https://vitest.dev/config/globalsetup) — globalSetup provide/inject API, teardown export, TestProject type
- [https://vitest.dev/api/test](https://vitest.dev/api/test) — describe.skipIf API
- [https://vitest.dev/config/](https://vitest.dev/config/) — include glob, --config flag
- npm registry (checked 2026-03-22) — smtp-server@3.18.1, @types/smtp-server@3.5.12 confirmed current

### Secondary (MEDIUM confidence)
- [https://github.com/nodemailer/smtp-server](https://github.com/nodemailer/smtp-server) — confirmed CJS module.exports.SMTPServer export format
- [https://github.com/vitest-dev/vitest/issues/4025](https://github.com/vitest-dev/vitest/issues/4025) — provide/inject pattern for globalSetup-to-test data sharing

### Tertiary (LOW confidence)
- None. All critical claims verified against official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — smtp-server version confirmed via `npm view`; vitest version confirmed from installed node_modules
- Architecture: HIGH — vitest config isolation via include glob and --config flag is official documented feature; smtp-server API verified against official docs
- Pitfalls: HIGH — CJS/ESM interop pitfall verified against Node.js module docs and smtp-server source; describe.skipIf timing pitfall verified against vitest API docs; loadCredentials pitfall verified against source code inspection

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (vitest and smtp-server are stable; 90-day validity reasonable)
