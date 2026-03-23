# Phase 14: Distribution & Documentation - Research

**Researched:** 2026-03-23
**Domain:** Homebrew formula authoring, GitHub Actions release automation, README documentation
**Confidence:** HIGH

## Summary

This phase has two deliverables: (1) a Homebrew formula in a new `honest-magic/homebrew-tap` repo that lets users install `mail-mcp` via `brew tap honest-magic/tap && brew install mail-mcp`, and (2) README additions covering an "Updating" section and an install-method comparison table. A third deliverable is a GitHub Release step added to the existing `publish.yml` workflow.

All three deliverables are mechanical and well-understood. Homebrew has first-class support for npm-hosted tarballs. The `softprops/action-gh-release@v2` action is the standard approach for tag-triggered GitHub Releases. README edits are straightforward prose and table additions.

The only nuance worth flagging: the npm tarball URL for a scoped package (`@honest-magic/mail-mcp`) follows the standard registry format, and the SHA-256 must be computed from the published tarball rather than the SHA-1 `shasum` field in the npm registry response (npm provides SHA-1 by default; Homebrew requires SHA-256).

**Primary recommendation:** Use `brew tap-new` to scaffold the tap repo, write a formula following the official Node-for-Formula-Authors pattern, and add a single `softprops/action-gh-release@v2` step to `publish.yml` with `contents: write` permission.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Separate tap repo (`honest-magic/homebrew-tap` on GitHub), not formula-in-repo
- **D-02:** Users install via `brew tap honest-magic/tap && brew install mail-mcp`
- **D-03:** Formula downloads npm tarball from registry.npmjs.org (not GitHub release archive)
- **D-04:** Formula declares `depends_on "node"` — Homebrew manages Node.js installation
- **D-05:** Post-install: `caveats` block tells user to run `mail-mcp accounts add`. No directory creation.
- **D-06:** New `## Updating` section placed directly after `## Installation`
- **D-07:** Three subsections covering all install paths: npx users (always latest on re-run), global npm (`npm update -g`), Homebrew (`brew upgrade`)
- **D-08:** Include a brief version pinning tip with example: `npx @honest-magic/mail-mcp@1.1.0`
- **D-09:** Link to GitHub Releases page for version history / what's new
- **D-10:** Add a comparison table in README — columns: Method, Command, Best for, Auto-updates?
- **D-11:** Add `### Homebrew` as third subsection in existing Installation section (after "Run without installing" and "Global install")
- **D-12:** Add a step to the existing `publish.yml` workflow that creates a GitHub Release when a version tag is pushed
- **D-13:** Release is auto-generated from the tag — no manual release notes required for now

### Claude's Discretion
- Exact wording of caveats block in Homebrew formula
- Comparison table row content and phrasing
- Whether to add a `## What's New` blurb or just link to Releases
- Formula test block content

### Deferred Ideas (OUT OF SCOPE)
- Homebrew tap auto-publish via CI (auto-update formula on npm publish) — future milestone
- Man pages — out of scope per requirements
- CHANGELOG.md file — GitHub Releases serves this purpose for now
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | README.md contains a section explaining how to update the MCP server (npm update, npx, version pinning) | D-06 through D-09 decisions map directly; patterns documented in Architecture Patterns section |
| DIST-01 | A Homebrew formula exists that installs `mail-mcp` via `brew install` | Homebrew Node formula authoring documented; formula structure, sha256, tap repo layout all researched |
</phase_requirements>

---

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Homebrew tap | N/A (git repo) | Formula distribution | Official Homebrew mechanism for third-party formulae |
| `softprops/action-gh-release` | `v2` | GitHub Release creation in CI | Most widely used action for this purpose; active maintenance |
| `actions/checkout` | `v4` | Already used in publish.yml | Already present; no change needed |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `brew tap-new` CLI | Built into Homebrew | Scaffold the tap repo with correct structure | Run once when creating the `homebrew-tap` repo locally |
| `shasum -a 256` / `openssl dgst -sha256` | macOS built-in | Compute SHA-256 of the npm tarball | When writing or updating the formula |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `softprops/action-gh-release@v2` | `gh release create` via Bash step | gh CLI approach works but requires more scripting; softprops action is simpler and widely tested |
| `softprops/action-gh-release@v2` | `actions/create-release` | `actions/create-release` is archived/unmaintained since 2021; softprops is the current standard |

**Installation:** No new npm dependencies. Tap repo is a new GitHub repo with a `.rb` file. The GitHub Action step is added to an existing workflow.

---

## Architecture Patterns

### Homebrew Tap Repository Structure

```
homebrew-tap/                    # GitHub repo: honest-magic/homebrew-tap
├── Formula/
│   └── mail-mcp.rb              # Formula file
└── README.md                    # Optional but good practice
```

The repo name MUST be prefixed with `homebrew-` for the short `brew tap honest-magic/tap` syntax to work. With this naming, `honest-magic/tap` resolves to `github.com/honest-magic/homebrew-tap`.

### Pattern 1: Node npm-tarball Formula

**What:** A Homebrew formula that downloads the npm-published tarball, runs `npm install` into `libexec`, then symlinks executables to `bin`.

**When to use:** When the package is already published to npm and you want Homebrew users to get the exact same artifact without a separate build step.

**Example:**
```ruby
# Formula/mail-mcp.rb
# Source: https://docs.brew.sh/Node-for-Formula-Authors
class MailMcp < Formula
  desc "MCP server for AI-powered email access via IMAP and SMTP"
  homepage "https://github.com/honest-magic/mail-mcp"
  url "https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-1.1.0.tgz"
  sha256 "e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def caveats
    <<~EOS
      To get started, add your first email account:
        mail-mcp accounts add
    EOS
  end

  test do
    assert_match "mail-mcp", shell_output("#{bin}/mail-mcp --help 2>&1", 1)
  end
end
```

**Key mechanics:**
- `std_npm_args` expands to `--prefix libexec --no-save` (Homebrew-managed, installs to `libexec/`)
- `bin.install_symlink libexec.glob("bin/*")` creates PATH-accessible symlinks for all executables
- The class name `MailMcp` is the CamelCase of the formula filename `mail-mcp.rb`
- The `@honest-magic/` scope prefix does NOT appear in the formula filename or class name — the formula is named after the binary (`mail-mcp`), not the npm package

### Pattern 2: SHA-256 Computation for npm Tarballs

**What:** Homebrew requires SHA-256 of the tarball. The npm registry's `dist.shasum` field is SHA-1. You must compute SHA-256 yourself.

**When to use:** Every time the formula's version is bumped.

```bash
# Source: Verified against registry.npmjs.org + macOS shasum
curl -sL "https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-1.1.0.tgz" \
  | shasum -a 256
# e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a  -
```

### Pattern 3: GitHub Release Step in publish.yml

**What:** A job step that creates a GitHub Release with auto-generated notes when a version tag is pushed.

**When to use:** At the end of the `publish` job, after npm publish succeeds.

```yaml
# Source: https://github.com/softprops/action-gh-release (v2)
# Add to the publish job in publish.yml
# Also requires updating job permissions: contents: write

- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    generate_release_notes: true
```

**Permission requirement:** The `publish` job currently has `contents: read`. This must be changed to `contents: write` for the release step to work.

### Pattern 4: README "Updating" Section

**What:** A new `## Updating` section placed after `## Installation` with three method subsections.

**Structure:**
```markdown
## Updating

### npx (run without installing)
npx always fetches the latest version. No update step needed.

### Global npm install
npm update -g @honest-magic/mail-mcp

### Homebrew
brew upgrade mail-mcp

## Version pinning
npx @honest-magic/mail-mcp@1.1.0

Link to GitHub Releases for changelog.
```

### Anti-Patterns to Avoid
- **Using `Dir["#{libexec}/bin/*"]` (old syntax):** The current Homebrew pattern is `libexec.glob("bin/*")` — prefer the newer form.
- **Pointing the formula URL at a GitHub archive:** Use the npm tarball (D-03); it's smaller (no test files) and already compiled.
- **Adding `contents: write` to the entire workflow:** Only the `publish` job needs it. The `ci` job should stay `contents: read`.
- **Computing formula SHA-256 from the npm `dist.shasum` field:** That field is SHA-1. Always compute SHA-256 via `curl | shasum -a 256`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub Release creation | Custom script using `gh api` | `softprops/action-gh-release@v2` | Action handles tag detection, permission scoping, note generation, and idempotency |
| Formula update automation | CI that patches the `.rb` file | Manual formula update (deferred per CONTEXT.md) | Out of scope for this phase |

**Key insight:** The Homebrew formula pattern for npm packages is fully standardized. `std_npm_args` and `bin.install_symlink libexec.glob("bin/*")` are the two-line formula core; don't deviate.

---

## Common Pitfalls

### Pitfall 1: Wrong SHA-256 in Formula
**What goes wrong:** `brew install` fails with a checksum mismatch error.
**Why it happens:** Developer uses the `dist.shasum` field from the npm registry (SHA-1), or the tarball is re-fetched after an npm publish that modified it.
**How to avoid:** Always compute SHA-256 fresh: `curl -sL <tarball_url> | shasum -a 256`.
**Warning signs:** The sha256 in the formula is 40 characters (SHA-1) instead of 64 characters (SHA-256).

### Pitfall 2: Missing `contents: write` Permission
**What goes wrong:** The `softprops/action-gh-release` step fails with a 403 "Resource not accessible by integration" error.
**Why it happens:** The `publish` job currently has `contents: read` which is insufficient for creating releases.
**How to avoid:** Add `contents: write` to the `publish` job's permissions block. The `ci` job does not need this change.
**Warning signs:** Action log shows "HttpError: Resource not accessible by integration".

### Pitfall 3: Formula Class Name Mismatch
**What goes wrong:** `brew install` fails with "undefined method" or formula not found.
**Why it happens:** The Ruby class name in the `.rb` file must exactly match the CamelCase of the filename. `mail-mcp.rb` must contain `class MailMcp < Formula`.
**How to avoid:** Use the rule: lowercase filename with dashes → CamelCase with dashes removed. `mail-mcp` → `MailMcp`.
**Warning signs:** Homebrew reports "Invalid formula" or `brew audit` fails.

### Pitfall 4: Tap Repo Name Without `homebrew-` Prefix
**What goes wrong:** `brew tap honest-magic/tap` fails or requires the full URL.
**Why it happens:** Homebrew's short-form tap resolution requires the GitHub repo to be named `homebrew-<tapname>`. The tap name `tap` maps to repo `homebrew-tap`.
**How to avoid:** Name the GitHub repo `homebrew-tap` (not `tap` or `brew-tap`).
**Warning signs:** `brew tap honest-magic/tap` says "Repository not found".

### Pitfall 5: `std_npm_args` Behavior
**What goes wrong:** npm install writes to the system `node_modules` or fails with permission errors.
**Why it happens:** `std_npm_args` must be splatted (`*std_npm_args`) — without the splat, it passes the array as a single argument.
**How to avoid:** Always write `system "npm", "install", *std_npm_args`.
**Warning signs:** Formula installs but binary is not found in PATH, or permission errors during install.

---

## Code Examples

### Complete Formula (verified pattern)
```ruby
# Source: https://docs.brew.sh/Node-for-Formula-Authors
class MailMcp < Formula
  desc "MCP server for AI-powered email access via IMAP and SMTP"
  homepage "https://github.com/honest-magic/mail-mcp"
  url "https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-1.1.0.tgz"
  sha256 "e5d12fce3ad3330228c84e3d814f74b1a20ff2f505db1fbd2c2939be4ae7023a"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def caveats
    <<~EOS
      To get started, add your first email account:
        mail-mcp accounts add
    EOS
  end

  test do
    assert_match "mail-mcp", shell_output("#{bin}/mail-mcp --help 2>&1", 1)
  end
end
```

### GitHub Release Step Addition to publish.yml
```yaml
# Add to publish job — also change job-level permissions to contents: write
- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    generate_release_notes: true
```

Full updated permissions block for the `publish` job:
```yaml
permissions:
  contents: write    # was: read — needed for release creation
  id-token: write    # unchanged — needed for npm OIDC provenance
```

### SHA-256 computation command
```bash
curl -sL "https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-{VERSION}.tgz" \
  | shasum -a 256
```

### Install method comparison table for README
```markdown
| Method | Install command | Best for | Auto-updates? |
|--------|----------------|----------|---------------|
| npx (no install) | `npx @honest-magic/mail-mcp` | Trying it out, always-latest | Yes — on each run |
| Global npm | `npm install -g @honest-magic/mail-mcp` | Daily use, offline-friendly | No — run `npm update -g` |
| Homebrew | `brew tap honest-magic/tap && brew install mail-mcp` | macOS users who prefer brew | No — run `brew upgrade` |
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/create-release` | `softprops/action-gh-release@v2` | 2021 (create-release archived) | Must use softprops; create-release is unmaintained |
| `require "language/node"` + `Language::Node.std_npm_install_args` | `std_npm_args` built-in | ~2022 (Homebrew refactor) | Simpler formula; `require "language/node"` is no longer needed |
| `Dir["#{libexec}/bin/*"]` | `libexec.glob("bin/*")` | ~2022 | Newer Ruby-idiomatic form preferred by `brew audit` |

**Deprecated/outdated:**
- `require "language/node"` at top of formula: No longer needed; `std_npm_args` is available by default.
- `Language::Node.std_npm_install_args(libexec)`: Replaced by `*std_npm_args` (simpler, same result).
- `actions/create-release`: Archived. Do not use.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README contains an "Updating" section | manual-only | N/A — prose review | N/A |
| DIST-01 | Homebrew formula file exists with correct structure | manual-only | `brew audit --tap honest-magic/tap` | N/A — new file in new repo |

Both requirements are documentation/packaging deliverables with no testable runtime behavior in the unit test suite. No Wave 0 test gaps to fill.

### Sampling Rate
- **Per task commit:** `npm test` (existing unit tests — ensures no source regressions)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green + manual verification of formula install + README review before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements (the phase adds no new source code).

---

## Open Questions

1. **Formula test block — what does `mail-mcp --help` return?**
   - What we know: `mail-mcp` is a Node.js binary that launches an MCP server (stdio). `--help` may not be handled and might exit non-zero with an error message.
   - What's unclear: The exact exit code and output for `--help` or `--version`. The formula test using `shell_output(..., 1)` (expecting exit code 1) is a safe assumption but should be verified.
   - Recommendation: Implementer should run `node dist/index.js --help` locally and adjust the test block assertion accordingly.

2. **`contents: write` scope in publish workflow**
   - What we know: The `publish` job currently has `contents: read`. Adding `contents: write` is required for `softprops/action-gh-release`.
   - What's unclear: Whether changing to `contents: write` has any unintended side effects on the OIDC provenance publish step.
   - Recommendation: The `id-token: write` permission is separate and is not affected. The change is safe.

---

## Sources

### Primary (HIGH confidence)
- [Homebrew Node for Formula Authors](https://docs.brew.sh/Node-for-Formula-Authors) — formula structure, `std_npm_args`, `bin.install_symlink`, install pattern
- [Homebrew How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) — tap repo naming (`homebrew-` prefix required), `Formula/` subdirectory convention
- [softprops/action-gh-release v2](https://github.com/softprops/action-gh-release/tree/v2) — `generate_release_notes`, `contents: write` permission requirement
- npm registry API (`registry.npmjs.org/@honest-magic/mail-mcp/1.1.0`) — confirmed tarball URL and SHA-256 (verified by local `shasum -a 256` computation)

### Secondary (MEDIUM confidence)
- [Homebrew Taps documentation](https://docs.brew.sh/Taps) — tap structure confirmed against primary docs
- Homebrew GitHub issue #16881 — confirms `@` in formula names uses `AT` convention (class name is `MailMcp`, not `AtHonestMagicMailMcp` — formula is named after the binary)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official Homebrew docs and action repo verified
- Architecture: HIGH — formula pattern direct from docs.brew.sh; SHA-256 computed from live tarball
- Pitfalls: HIGH — each pitfall sourced from official docs or verified behavior

**Research date:** 2026-03-23
**Valid until:** 2026-09-23 (Homebrew formula pattern is stable; action-gh-release v2 is current)
