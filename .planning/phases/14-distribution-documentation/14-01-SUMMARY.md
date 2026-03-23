---
phase: 14-distribution-documentation
plan: 01
subsystem: documentation, ci
tags: [readme, homebrew, updating, github-releases, publish-workflow]
dependency_graph:
  requires: []
  provides: [README-Homebrew-install, README-Updating-section, README-comparison-table, GitHub-Release-workflow]
  affects: [README.md, .github/workflows/publish.yml]
tech_stack:
  added: [softprops/action-gh-release@v2]
  patterns: [auto-generated GitHub Releases from tags]
key_files:
  created: []
  modified:
    - README.md
    - .github/workflows/publish.yml
decisions:
  - "Used softprops/action-gh-release@v2 with generate_release_notes: true for automatic release notes from commit messages"
  - "Placed install comparison table between ## Installation heading and ### Run without installing subsection as specified in plan"
  - "Updating section placed between ## Installation and ## Configuration maintaining existing document flow"
metrics:
  duration_minutes: 5
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
requirements_satisfied:
  - DOC-01
  - DIST-01
---

# Phase 14 Plan 01: README Updates and GitHub Release Workflow Summary

README updated with Homebrew install instructions, an Updating guide with 3 method subsections + version pinning + Releases link, and an install-method comparison table; publish workflow now creates a GitHub Release with auto-generated notes on every version tag push.

## Tasks Completed

### Task 1: Add Homebrew install subsection, Updating section, and comparison table to README

**Commit:** a06a2ab

Added three blocks of new content to README.md while preserving all existing content:

1. **Install-method comparison table** between the `## Installation` heading and `### Run without installing`, with columns: Method, Install command, Best for, Auto-updates?
2. **`### Homebrew` subsection** under `## Installation` with `brew tap honest-magic/tap` and `brew install mail-mcp`
3. **`## Updating` section** after `## Installation` and before `## Configuration` containing:
   - `### npx (run without installing)` — notes that npx always fetches latest
   - `### Global npm install` — `npm update -g @honest-magic/mail-mcp`
   - `### Homebrew` — `brew upgrade mail-mcp`
   - `### Version pinning` — `npx @honest-magic/mail-mcp@1.1.0` with link to Releases page

**Files modified:** README.md (+41 lines)

### Task 2: Add GitHub Release step to publish.yml

**Commit:** 164b6b6

Two changes to `.github/workflows/publish.yml`:

1. Changed `publish` job permissions from `contents: read` to `contents: write` (required for Release creation)
2. Added `Create GitHub Release` step after `Publish to npm` using `softprops/action-gh-release@v2` with `generate_release_notes: true`

The `ci` job remains unchanged with no permissions block.

**Files modified:** .github/workflows/publish.yml (+6 lines, -1 line)

## Verification

All automated checks passed:

- `grep "## Updating" README.md` — matched line 38
- `grep "brew tap honest-magic/tap" README.md` — matched lines 16, 34
- `grep "softprops/action-gh-release@v2" .github/workflows/publish.yml` — matched line 70
- `grep "contents: write" .github/workflows/publish.yml` — matched line 34
- `npm test` — 177 tests passed (11 test files)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The Homebrew install commands reference `honest-magic/tap` which does not yet exist as a public tap — this is intentional and tracked for Plan 14-02 (Homebrew formula creation + tap repo setup). The README content is accurate documentation for the future state that Plan 14-02 will fulfill.

## Self-Check: PASSED

- README.md exists and contains all required sections
- .github/workflows/publish.yml exists with contents: write and softprops/action-gh-release@v2
- Commit a06a2ab exists (Task 1)
- Commit 164b6b6 exists (Task 2)
