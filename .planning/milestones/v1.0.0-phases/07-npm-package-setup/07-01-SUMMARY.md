---
phase: 07-npm-package-setup
plan: 01
subsystem: infra
tags: [npm, package.json, license, mit, publish, bin, cli]

# Dependency graph
requires: []
provides:
  - "package.json configured for npm distribution as @honest-magic/mail-mcp"
  - "MIT LICENSE file at project root"
  - "bin entry enabling npx @honest-magic/mail-mcp and global install"
  - "files field scoping tarball to dist/, README.md, LICENSE only"
  - "publishConfig.access = public for scoped npm publish"
affects: [08-github-readme, 09-github-actions-ci-cd]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "npm scoped package under @honest-magic org with public access"
    - "bin-only ESM package (no main field, only bin pointing to dist/index.js)"

key-files:
  created:
    - LICENSE
  modified:
    - package.json

key-decisions:
  - "Package name is @honest-magic/mail-mcp (scoped to honest-magic org)"
  - "bin entry mail-mcp -> dist/index.js enables both npx usage and global install"
  - "Removed incorrect main: index.js field (file does not exist, package is bin-only)"
  - "files field limits tarball to dist/, README.md, LICENSE — no source leakage"
  - "MIT license dated 2024 (project inception year)"

patterns-established:
  - "Bin-only package pattern: no main field, ESM type, bin pointing to dist/"

requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 07 Plan 01: npm Package Setup Summary

**package.json configured for @honest-magic/mail-mcp npm distribution with MIT LICENSE, bin entry, files scoping, and publishConfig.access=public**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-22T07:22:49Z
- **Completed:** 2026-03-22T07:32:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- package.json fully configured for public npm distribution under @honest-magic/mail-mcp
- bin entry `mail-mcp -> dist/index.js` enables `npx @honest-magic/mail-mcp` and `npm install -g @honest-magic/mail-mcp`
- files field scopes published tarball to `dist/`, `README.md`, `LICENSE` only — no source, no dev files
- MIT LICENSE created at project root, satisfying the files field reference
- npm pack --dry-run confirms dist/ and LICENSE included; dist/index.js shebang preserved through tsc compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Update package.json for npm distribution** - `be3ee4d` (feat)
2. **Task 2: Create LICENSE file and verify build artifact** - `3834592` (feat)

**Plan metadata:** (docs commit — created after summary)

## Files Created/Modified
- `package.json` - Renamed to @honest-magic/mail-mcp, added bin/files/publishConfig/engines/repository/homepage/bugs, changed license to MIT, removed incorrect main field
- `LICENSE` - MIT license for project root (required by files field)

## Decisions Made
- Removed `"main": "index.js"` — file does not exist; for a bin-only ESM package the main field is misleading and incorrect
- MIT license dated 2024 (project inception year, not publication year)
- No package-lock.json changes were needed (no new dependencies added)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- package.json is fully configured; Phase 8 (GitHub repo and README) can proceed
- Phase 9 (GitHub Actions CI/CD) can reference the finalized package name and bin entry
- README.md is listed in the files field but does not yet exist — npm pack --dry-run shows a warning for it; Phase 8 will create it

## Self-Check: PASSED

- FOUND: package.json
- FOUND: LICENSE
- FOUND: .planning/phases/07-npm-package-setup/07-01-SUMMARY.md
- FOUND commit be3ee4d (feat: configure package.json)
- FOUND commit 3834592 (feat: add MIT LICENSE)
- All package.json assertions passed
- LICENSE OK
- shebang OK

---
*Phase: 07-npm-package-setup*
*Completed: 2026-03-22*
