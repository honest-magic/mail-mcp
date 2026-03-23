---
phase: 14-distribution-documentation
verified: 2026-03-23T11:00:00Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
human_verification:
  - test: "Run `brew tap honest-magic/tap && brew install mail-mcp` on macOS"
    expected: "Command completes without error; `mail-mcp` binary is available in PATH; `mail-mcp accounts list` runs"
    why_human: "Cannot verify an external GitHub repository (honest-magic/homebrew-tap) or a live Homebrew install from within this repo. Summary documents user confirmed end-to-end success, but programmatic verification is impossible from this codebase."
  - test: "Push a version tag (e.g. v1.2.0) and confirm HOMEBREW_TAP_TOKEN secret is configured"
    expected: "The `update-homebrew` CI job (present in publish.yml but out of original scope) succeeds in bumping the formula in honest-magic/homebrew-tap"
    why_human: "The update-homebrew job requires a HOMEBREW_TAP_TOKEN repository secret. Cannot verify the secret is set. If the secret is absent, the job will fail silently on the next release."
---

# Phase 14: Distribution & Documentation Verification Report

**Phase Goal:** Users can install and update mail-mcp via Homebrew, and existing npm users know how to keep their install current
**Verified:** 2026-03-23T11:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | README contains an Updating section with npx, npm, and Homebrew subsections | VERIFIED | `## Updating` at line 38; subsections at lines 40, 44, 50 |
| 2 | README contains an install-method comparison table with Method, Command, Best for, Auto-updates columns | VERIFIED | Table at lines 12-16 with all four columns |
| 3 | README contains a Homebrew subsection under Installation | VERIFIED | `### Homebrew` at line 31 with `brew tap honest-magic/tap` and `brew install mail-mcp` |
| 4 | publish.yml creates a GitHub Release when a version tag is pushed | VERIFIED | `softprops/action-gh-release@v2` at line 70; `generate_release_notes: true` at line 72 |
| 5 | A Homebrew formula file exists with correct class name, URL, sha256, depends_on, and caveats | VERIFIED | `Formula/mail-mcp.rb` — all required fields present and correct |
| 6 | Formula uses std_npm_args and bin.install_symlink libexec.glob pattern | VERIFIED | Lines 11-12 in `Formula/mail-mcp.rb` |
| 7 | `brew install mail-mcp` works end-to-end for a user | NEEDS HUMAN | External tap repo (honest-magic/homebrew-tap) cannot be verified programmatically from this repo |

**Score:** 6/7 truths verified (1 requires human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `README.md` | Updating section, Homebrew install subsection, comparison table | VERIFIED | Contains `## Updating` (line 38), `### Homebrew` under Installation (line 31), comparison table (line 12) |
| `.github/workflows/publish.yml` | GitHub Release creation step | VERIFIED | `softprops/action-gh-release@v2` step at line 69-72; `contents: write` permission at line 34 |
| `Formula/mail-mcp.rb` | Homebrew formula for mail-mcp | VERIFIED | Exists with correct class, URL, sha256 (64 chars), `depends_on "node"`, `std_npm_args`, caveats |

**Artifact detail — Formula/mail-mcp.rb:**
- Class name: `MailMcp` (correct CamelCase)
- URL: `https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-1.1.0.tgz`
- SHA-256: `e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a` (64 hex chars — valid)
- `depends_on "node"`: present
- `system "npm", "install", *std_npm_args`: present (splat operator correct)
- `bin.install_symlink libexec.glob("bin/*")`: present (modern Homebrew pattern)
- Caveats: `mail-mcp accounts add` instruction present
- Test block: `assert_predicate bin/"mail-mcp", :executable?` (correct deviation from plan — plan's `shell_output` would hang for an MCP server)
- No `require "language/node"`: confirmed absent
- No `Language::Node`: confirmed absent
- No `Dir["#{libexec}/bin/*"]`: confirmed absent

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `README.md` | `https://github.com/honest-magic/mail-mcp/releases` | Markdown link in Updating section | VERIFIED | Line 66: `[Releases page](https://github.com/honest-magic/mail-mcp/releases)` |
| `.github/workflows/publish.yml` | GitHub Releases API | `softprops/action-gh-release@v2` step | VERIFIED | Line 70: `uses: softprops/action-gh-release@v2` |
| `Formula/mail-mcp.rb` | `https://registry.npmjs.org/@honest-magic/mail-mcp` | `url` field in formula | VERIFIED | Line 4: URL points to npm registry tarball for v1.1.0 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOC-01 | 14-01-PLAN.md | README.md contains a section explaining how to update the MCP server (npm update, npx, version pinning) | SATISFIED | `## Updating` section (lines 38-66) covers npx re-run, `npm update -g`, `brew upgrade`, and `npx @honest-magic/mail-mcp@1.1.0` version pinning |
| DIST-01 | 14-01-PLAN.md, 14-02-PLAN.md | A Homebrew formula exists that installs `mail-mcp` via `brew install` | SATISFIED | `Formula/mail-mcp.rb` exists with correct structure; user confirmed end-to-end `brew install mail-mcp` works in 14-02-SUMMARY.md |

All requirement IDs declared in plan frontmatter (DOC-01, DIST-01) are accounted for. Both map to Phase 14 in REQUIREMENTS.md traceability table. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.github/workflows/publish.yml` | 74-117 | `update-homebrew` job not in plan scope; REQUIREMENTS.md lists "Homebrew tap auto-publish via CI" as Out of Scope | Info | Delivers more than required; requires `HOMEBREW_TAP_TOKEN` secret to be configured or the job fails on release. No blocker. |
| `.github/workflows/publish.yml` | 74 | `update-homebrew` job has no `permissions` block | Warning | Inherits default permissions. The `actions/github-script@v7` step uses `HOMEBREW_TAP_TOKEN` (a PAT), so missing `permissions` is likely intentional and not harmful, but it is inconsistent with the `publish` job pattern. |

No stub patterns found. No TODO/FIXME/placeholder comments in modified files.

---

### Human Verification Required

#### 1. End-to-End Homebrew Install

**Test:** On macOS, run:
```bash
brew tap honest-magic/tap
brew install mail-mcp
mail-mcp accounts list
```
**Expected:** `brew tap` resolves `honest-magic/homebrew-tap` on GitHub, `brew install` downloads the npm tarball, installs the binary, and `mail-mcp accounts list` runs (showing empty list or configured accounts).
**Why human:** The `honest-magic/homebrew-tap` repository is external to this repo. The 14-02-SUMMARY.md states the user confirmed this works (binary at `/opt/homebrew/bin/mail-mcp`, `mail-mcp accounts list` works), but this cannot be re-verified programmatically from the current codebase.

#### 2. HOMEBREW_TAP_TOKEN Secret Existence

**Test:** In the GitHub repository settings for `honest-magic/mail-mcp`, navigate to Settings > Secrets > Actions and confirm `HOMEBREW_TAP_TOKEN` exists.
**Expected:** Secret `HOMEBREW_TAP_TOKEN` is present with a valid PAT that has write access to `honest-magic/homebrew-tap`.
**Why human:** Repository secrets cannot be read via the filesystem or git. The `update-homebrew` job (present in publish.yml, not in original plan scope) depends on this secret — without it the job will fail on the next version tag push.

---

### Gaps Summary

No automated gaps found. All plan must-haves are verified in the codebase.

One notable out-of-scope addition: the `update-homebrew` CI job was not in the 14-01 or 14-02 plans, and REQUIREMENTS.md explicitly marks "Homebrew tap auto-publish via CI" as out of scope for v1.2.0. The job was nonetheless delivered and is functionally correct — it bumps the formula URL and sha256 in `honest-magic/homebrew-tap` after each npm publish. This represents scope expansion, not a regression. The README accurately reflects this capability ("The Homebrew formula is updated automatically when a new version is published to npm").

The single human-needed item (end-to-end `brew install`) is standard for distribution work — it cannot be verified programmatically from the source repo alone.

---

_Verified: 2026-03-23T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
