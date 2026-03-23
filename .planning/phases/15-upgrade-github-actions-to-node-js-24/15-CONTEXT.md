# Phase 15: Upgrade GitHub Actions to Node.js 24 - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade GitHub Actions workflows to Node.js 24-compatible action versions and standardize CI Node.js version. Deadline: before GitHub forces Node.js 24 on 2026-06-02.

</domain>

<decisions>
## Implementation Decisions

### CI Node.js version
- **D-01:** Standardize on Node.js 22 across all workflows (ci.yml currently uses 20, publish.yml uses 22)
- **D-02:** Keep `package.json` engines at `>=18` — no reason to exclude users on older Node

### Action version strategy
- **D-03:** Upgrade `actions/checkout` and `actions/setup-node` to latest versions that support Node.js 24 runtime
- **D-04:** Check `softprops/action-gh-release` and `actions/github-script` for Node.js 24 compatibility too
- **D-05:** Do NOT set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var — let GitHub handle the transition naturally

### Claude's Discretion
- Exact action version numbers (v4 → v5 if available, or stay on v4 if compatible)
- Whether to add a comment noting the Node.js 24 migration context

</decisions>

<specifics>
## Specific Ideas

- The deprecation warning specifically calls out `actions/checkout@v4` and `actions/setup-node@v4`
- The `update-homebrew` job in publish.yml also uses `actions/checkout@v4` — don't miss it
- There are 6 total `actions/checkout@v4` references and 4 `actions/setup-node@v4` references across both workflows

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CI/CD workflows
- `.github/workflows/ci.yml` — CI workflow (node 20, checkout@v4, setup-node@v4)
- `.github/workflows/publish.yml` — Publish workflow (node 22, checkout@v4, setup-node@v4, github-script@v7, action-gh-release@v2)

### Package config
- `package.json` — engines field (>=18), stays unchanged

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to modify
- `.github/workflows/ci.yml` — 2x checkout@v4, 2x setup-node@v4, node-version: '20' → '22'
- `.github/workflows/publish.yml` — 3x checkout@v4, 2x setup-node@v4 (node-version already '22')

### Integration Points
- publish.yml's `update-homebrew` job uses `actions/github-script@v7` — check compatibility
- publish.yml uses `softprops/action-gh-release@v2` — check compatibility

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-upgrade-github-actions-to-node-js-24*
*Context gathered: 2026-03-23*
