# Phase 13: Integration Test Suite - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The full hardened server is validated end-to-end against real mail protocols in both local and CI environments. Covers QUAL-02 (integration test suite).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

Key constraints from research:
- SMTP tests: Use `smtp-server` (Nodemailer org, v3.18.1) as in-process fixture — real send/receive without network
- IMAP tests: Use real credentials via CI secrets (no viable in-process IMAP server exists). Skip when credentials absent.
- Test isolation: Separate vitest config for integration tests (`vitest.integration.config.ts`)
- `npm run test:integration` script in package.json
- Integration tests must NOT appear in or interfere with default `npm test` run
- `smtp-server` is a devDependency
- Tests guarded with `describe.skipIf(!process.env.TEST_IMAP_HOST)` for IMAP
- CJS interop: `smtp-server` is CJS but Node.js allows CJS default import from ESM

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vitest.config.ts` — existing test config to extend/parallel
- `src/protocol/smtp.ts` — `SmtpClient` with `sendEmail()` method
- `src/services/mail.ts` — `MailService` orchestrating IMAP+SMTP
- All Phase 10-12 hardening features now in place

### Established Patterns
- Test files use `.test.ts` suffix
- Vitest with `vi.mock()` for unit tests
- `describe`/`it`/`expect` pattern throughout

### Integration Points
- `package.json`: New `test:integration` script
- New `vitest.integration.config.ts` at project root
- New test files in `src/` or `tests/integration/` directory
- `.github/workflows/ci.yml`: Potentially add integration test step (optional for v1.1.0)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — testing infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
