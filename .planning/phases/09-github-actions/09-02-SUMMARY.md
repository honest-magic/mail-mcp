---
phase: 09-github-actions
plan: 02
subsystem: infra
tags: [github-actions, npm-publish, cd, typescript, registry]

# Dependency graph
requires:
  - phase: 09-01-github-actions
    provides: CI workflow with job named 'ci' — referenced by needs: [ci] in this publish workflow
provides:
  - Tag-based npm publish workflow at .github/workflows/publish.yml
  - Inline CI gate (type-check + test) inside publish workflow blocking on failure
  - NPM_TOKEN secret integration for authenticated publish to npm registry
  - npm run build step ensuring dist/ is compiled before publish
affects: []

# Tech tracking
tech-stack:
  added: [GitHub Actions tag trigger (on.push.tags), actions/setup-node registry-url config]
  patterns: [CI-gate before publish via needs, inline CI job duplicated inside publish workflow to avoid workflow_call requirement, registry-url required for .npmrc auto-config by setup-node]

key-files:
  created: [.github/workflows/publish.yml]
  modified: []

key-decisions:
  - "Inline ci job inside publish.yml (not reusable workflow reference) — ci.yml has no on.workflow_call trigger so uses: ./.github/workflows/ci.yml would be rejected by GitHub Actions at runtime"
  - "needs: [ci] on publish job enforces GHA-03 — publish cannot run if CI fails"
  - "registry-url: 'https://registry.npmjs.org' required for actions/setup-node to auto-configure .npmrc with NODE_AUTH_TOKEN"
  - "npm run build before npm publish — compiles TypeScript to dist/ which is the published artifact"
  - "No --access public flag on npm publish — publishConfig.access=public in package.json handles scoped public publish"

patterns-established:
  - "Tag-based release pattern: push v* tag -> CI gate -> build -> publish"

requirements-completed: [GHA-02, GHA-03]

# Metrics
duration: ~1min
completed: 2026-03-22
---

# Phase 9 Plan 02: Publish Workflow Summary

**Tag-triggered GitHub Actions publish workflow with inline CI gate — pushing a v* tag type-checks, tests, builds, and publishes @honest-magic/mail-mcp to npm only after CI passes**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-22T09:32:32Z
- **Completed:** 2026-03-22T09:33:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `.github/workflows/publish.yml` triggered exclusively on `v*` tag pushes (e.g. v1.0.0, v1.2.3)
- Inline `ci` job runs type-check (`npx tsc --noEmit`) and tests (`npm test`) before any publish attempt
- `publish` job declares `needs: [ci]` — broken builds can never reach the npm registry (GHA-03)
- `registry-url: 'https://registry.npmjs.org'` enables `actions/setup-node` to auto-configure `.npmrc` with auth token
- `npm run build` compiles TypeScript to `dist/` before `npm publish`
- `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` with inline comment documenting required GitHub secret configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/workflows/publish.yml** - `8322d6c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `.github/workflows/publish.yml` - Publish workflow: v* tag trigger, inline ci gate job, publish job with build + npm publish via NPM_TOKEN

## Decisions Made
- Inline ci job inside publish.yml rather than `uses: ./.github/workflows/ci.yml` — ci.yml lacks `on: workflow_call:` trigger; GitHub Actions would reject the reusable workflow reference at runtime
- `needs: [ci]` on publish job: enforces the CI gate so GHA-03 is satisfied without any external workflow dependency
- `registry-url` required: `actions/setup-node` only writes `.npmrc` with auth configuration when `registry-url` is set; omitting it would cause `npm publish` to fail even with `NODE_AUTH_TOKEN` set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**One manual secret required.** Before the publish workflow can authenticate with npm:

1. Go to [npmjs.com](https://www.npmjs.com) → Account → Access Tokens → Generate New Token (type: Automation)
2. Copy the token
3. Go to `https://github.com/honest-magic/mail-mcp/settings/secrets/actions`
4. Click "New repository secret"
5. Name: `NPM_TOKEN`, Value: paste the token
6. Save

The workflow will then authenticate as the `honest-magic` npm org user and publish `@honest-magic/mail-mcp` with `publishConfig.access=public`.

## Next Phase Readiness

- Both GitHub Actions workflows are in place: ci.yml (push/PR to main) and publish.yml (v* tags)
- Phase 9 (github-actions) is complete — all three GHA requirements satisfied (GHA-01, GHA-02, GHA-03)
- To cut first release: ensure NPM_TOKEN secret is configured, then `git tag v1.0.0 && git push origin v1.0.0`
- No blockers

---
*Phase: 09-github-actions*
*Completed: 2026-03-22*
