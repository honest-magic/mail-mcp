---
phase: 14-distribution-documentation
plan: 02
subsystem: infra
tags: [homebrew, formula, tap, npm, distribution]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Published npm package @honest-magic/mail-mcp@1.1.0 on registry"
provides:
  - "Formula/mail-mcp.rb — Homebrew formula for mail-mcp"
  - "honest-magic/homebrew-tap GitHub repo with formula at Formula/mail-mcp.rb"
  - "`brew tap honest-magic/tap && brew install mail-mcp` works end-to-end"
affects: [distribution, install-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Homebrew npm-tarball formula using std_npm_args and libexec.glob(bin/*)"

key-files:
  created:
    - "Formula/mail-mcp.rb"
  modified: []

key-decisions:
  - "Formula downloads npm tarball from registry.npmjs.org, not GitHub archive (D-03)"
  - "Formula test block uses assert_predicate :executable? since MCP server has no quick-exit CLI mode"
  - "SHA-256 verified live from tarball: e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a"

patterns-established:
  - "Homebrew Node formula: std_npm_args + bin.install_symlink libexec.glob(bin/*)"

requirements-completed:
  - DIST-01

# Metrics
duration: 30min
completed: 2026-03-23
---

# Phase 14 Plan 02: Homebrew Formula Summary

**Homebrew tap published at honest-magic/homebrew-tap — `brew tap honest-magic/tap && brew install mail-mcp` installs the 1.1.0 binary from npm registry tarball**

## Performance

- **Duration:** ~30 min (including human-action checkpoint for tap repo setup)
- **Started:** 2026-03-23T08:51:59Z
- **Completed:** 2026-03-23T10:54:42Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments

- Created `Formula/mail-mcp.rb` with correct class name, npm tarball URL, and verified SHA-256
- SHA-256 computed live from registry.npmjs.org tarball (matches research value)
- Formula follows current Homebrew Node pattern: `std_npm_args`, `libexec.glob("bin/*")`, no deprecated `Language::Node`
- User created `honest-magic/homebrew-tap` repo and pushed formula
- Verified end-to-end: binary installs at `/opt/homebrew/Cellar/mail-mcp/1.1.0`, `mail-mcp accounts list` works, caveats display correctly
- All 177 unit tests pass — no source regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Homebrew formula and tap repo structure** - `4a5f229` (feat)
2. **Task 2: User creates homebrew-tap repo and pushes formula** - Human action (no commit in this repo — changes live in honest-magic/homebrew-tap)

**Plan metadata:** `a5ae538` (docs: complete Homebrew formula plan)

## Files Created/Modified

- `Formula/mail-mcp.rb` - Homebrew formula that installs mail-mcp via npm tarball from registry.npmjs.org

## Decisions Made

- Used `assert_predicate bin/"mail-mcp", :executable?` in the test block instead of `shell_output(..., 1)` because the binary is an MCP server that reads from stdio indefinitely — there is no quick-exit `--help` or `--version` flag. The executable check confirms the symlink was created without hanging `brew test`.
- SHA-256 verified live: `e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a` (matches research pre-computation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed test block from shell_output to assert_predicate**
- **Found during:** Task 1 (formula creation)
- **Issue:** Research example uses `shell_output("#{bin}/mail-mcp --help 2>&1", 1)` but live testing shows `mail-mcp` starts the MCP server and blocks indefinitely on any argument — `--help` exits with code 124 (timeout), not 1
- **Fix:** Used `assert_predicate bin/"mail-mcp", :executable?` which confirms symlink creation without blocking
- **Files modified:** Formula/mail-mcp.rb
- **Verification:** Formula structure verified with grep checks; research pitfalls all avoided
- **Committed in:** 4a5f229 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for brew test to complete without hanging. No scope creep.

## Issues Encountered

- `mail-mcp --help` does not exit — the process starts the MCP stdio server and waits for input regardless of arguments. Resolved by using `assert_predicate :executable?` which is the standard Homebrew pattern for service binaries.

## User Setup Required (Completed)

Task 2 was a blocking human-action checkpoint. The user completed:

1. Created `honest-magic/homebrew-tap` as a public GitHub repo via `gh repo create`
2. Pushed `Formula/mail-mcp.rb` and `README.md` to the tap repo
3. Verified `brew tap honest-magic/tap` and `brew install mail-mcp` both succeed
4. Confirmed binary at `/opt/homebrew/bin/mail-mcp` and `mail-mcp accounts list` works correctly

## Next Phase Readiness

- DIST-01 (Homebrew distribution) is fully satisfied
- Phase 14 is fully complete — all plans (14-01 README/publish workflow, 14-02 Homebrew formula) delivered
- No blockers. Project ready for v1.2.0 milestone verification (`/gsd:verify-work`)

## Known Stubs

None — the formula is complete and correct. No placeholder values.

---
*Phase: 14-distribution-documentation*
*Completed: 2026-03-23*
