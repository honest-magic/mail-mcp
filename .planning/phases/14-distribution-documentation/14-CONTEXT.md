# Phase 14: Distribution & Documentation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship Homebrew install support and update the README so users can install via `brew install`, update existing installs (npx/npm/brew), and choose the right install method. Also add GitHub Release creation to the existing publish workflow.

</domain>

<decisions>
## Implementation Decisions

### Homebrew formula
- **D-01:** Separate tap repo (`honest-magic/homebrew-tap` on GitHub), not formula-in-repo
- **D-02:** Users install via `brew tap honest-magic/tap && brew install mail-mcp`
- **D-03:** Formula downloads npm tarball from registry.npmjs.org (not GitHub release archive)
- **D-04:** Formula declares `depends_on "node"` — Homebrew manages Node.js installation
- **D-05:** Post-install: `caveats` block tells user to run `mail-mcp accounts add`. No directory creation.

### README update guide
- **D-06:** New `## Updating` section placed directly after `## Installation`
- **D-07:** Three subsections covering all install paths: npx users (always latest on re-run), global npm (`npm update -g`), Homebrew (`brew upgrade`)
- **D-08:** Include a brief version pinning tip with example: `npx @honest-magic/mail-mcp@1.1.0`
- **D-09:** Link to GitHub Releases page for version history / what's new

### Install method comparison
- **D-10:** Add a comparison table in README — columns: Method, Command, Best for, Auto-updates?
- **D-11:** Add `### Homebrew` as third subsection in existing Installation section (after "Run without installing" and "Global install")

### GitHub Releases
- **D-12:** Add a step to the existing `publish.yml` workflow that creates a GitHub Release when a version tag is pushed
- **D-13:** Release is auto-generated from the tag — no manual release notes required for now

### Claude's Discretion
- Exact wording of caveats block in Homebrew formula
- Comparison table row content and phrasing
- Whether to add a `## What's New` blurb or just link to Releases
- Formula test block content

</decisions>

<specifics>
## Specific Ideas

- No GitHub Releases exist yet — the publish workflow only pushes to npm. Adding release creation is part of this phase.
- Homebrew tap auto-publish via CI is explicitly out of scope (per REQUIREMENTS.md). Formula updates are manual.
- Man pages are out of scope.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Package metadata
- `package.json` — Package name (`@honest-magic/mail-mcp`), version, bin entry (`dist/index.js`), engines (`>=18`)
- `README.md` — Current Installation, Configuration, and Tools sections that will be modified

### CI/CD
- `.github/workflows/publish.yml` — Existing tag-triggered npm publish workflow (add GitHub Release step here)
- `.github/workflows/ci.yml` — CI workflow for reference

### Requirements
- `.planning/REQUIREMENTS.md` — DOC-01 and DIST-01 definitions, out-of-scope items (no tap auto-publish, no man pages)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `publish.yml` already handles tag-triggered builds with version verification — GitHub Release step slots in after npm publish
- `package.json` `bin` field already defines the `mail-mcp` binary entry point — Homebrew formula `bin.install` can reference this directly

### Established Patterns
- npm publish uses OIDC provenance (`--provenance`) — formula sha256 should be computed from the published tarball
- Version is managed in `package.json` and verified against git tags in CI

### Integration Points
- Homebrew formula `url` will point to `https://registry.npmjs.org/@honest-magic/mail-mcp/-/mail-mcp-{version}.tgz`
- The `homebrew-tap` repo is a new external repo — this phase creates it and the initial formula file
- README modifications happen in the existing `README.md` in this repo

</code_context>

<deferred>
## Deferred Ideas

- Homebrew tap auto-publish via CI (auto-update formula on npm publish) — future milestone
- Man pages — out of scope per requirements
- CHANGELOG.md file — GitHub Releases serves this purpose for now

</deferred>

---

*Phase: 14-distribution-documentation*
*Context gathered: 2026-03-23*
