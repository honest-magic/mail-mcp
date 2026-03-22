# Phase 9: GitHub Actions - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Create two GitHub Actions workflow files: a CI workflow that type-checks and tests every push to `main` and every PR, and a publish workflow that publishes `@honest-magic/mail-mcp` to npm on `v*` tag push — but only after CI passes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Specific requirements:
- CI workflow: runs `tsc --noEmit` + `npm test` on push to `main` and pull requests
- Publish workflow: triggers on `v*` tag push, publishes to npm, requires `needs: ci` (GHA-03)
- npm publish requires `NPM_TOKEN` secret in GitHub repo
- Node.js version: >=18.0.0 (from engines field), use `node-version: '20'` for CI consistency
- Package manager: npm

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `npm run build` = `tsc` (TypeScript compilation)
- `npm test` = `vitest run` (5 test files, 26 tests)
- `npm run build` already works and outputs to `dist/`
- Package: `@honest-magic/mail-mcp` at `honest-magic/mail-mcp` on GitHub

### Established Patterns
- ESM TypeScript project
- Node.js >=18 required (engines field)
- CI environment: no macOS Keychain needed for tests (keychain is mocked in test files)

### Integration Points
- `.github/workflows/ci.yml` — new file
- `.github/workflows/publish.yml` — new file
- Publish workflow needs `NPM_TOKEN` secret in GitHub repo settings (must document)
- `needs: ci` in publish job enforces GHA-03

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
