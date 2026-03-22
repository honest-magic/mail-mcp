# Phase 7: npm Package Setup - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure `package.json` for public npm distribution under `@honest-magic/mail-mcp` and ensure `npm run build` produces a self-contained, executable `dist/index.js` that consumers can run via `npx` or global install.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Specific requirements are captured in success criteria:
- `name: "@honest-magic/mail-mcp"`, `version: "1.0.0"`, `publishConfig: { access: "public" }`
- `bin: { "mail-mcp": "dist/index.js" }`
- `files: ["dist", "README.md", "LICENSE"]`
- `npm run build` produces `dist/index.js` with shebang (`#!/usr/bin/env node` already in src/index.ts)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/index.ts` already has `#!/usr/bin/env node` shebang on line 1
- `tsconfig.json` outputs to `dist/` from `src/` — build pipeline already works
- `dist/index.js` already builds correctly via `npm run build` (tsc)

### Established Patterns
- Project uses ESM (`"type": "module"`)
- TypeScript compilation with `NodeNext` module resolution
- `npm run build` = `tsc`

### Integration Points
- `package.json` needs `name`, `version`, `publishConfig`, `bin`, `files`, `description`, `keywords`, `author`, `repository`, `engines` fields added/updated
- `LICENSE` file needs to exist (referenced in `files` field)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
