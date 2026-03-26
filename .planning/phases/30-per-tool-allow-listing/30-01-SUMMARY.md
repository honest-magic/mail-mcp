---
phase: 30
plan: 01
subsystem: server-core
tags: [permissions, cli, allow-list, tool-filtering]
dependency_graph:
  requires: []
  provides: [per-tool-allow-listing, allow-tools-flag]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [allow-list filtering, mutually-exclusive flags, constructor validation]
key_files:
  created:
    - src/index.allowlist.test.ts
  modified:
    - src/index.ts
decisions:
  - "allowedTools stored as instance field on MailMCPServer (alongside readOnly)"
  - "Constructor signature uses overloaded param: allowedTools?: Set<string> after readOnly"
  - "getTools() extended with optional allowedTools param — read tools always pass, write tools filtered"
  - "Both dispatchTool() and CallToolRequestSchema handler guard against non-allowed write tools"
  - "Error message for blocked allow-list tool is distinct from read-only error (no 'read-only mode' phrase)"
  - "CLI --allow-tools is comma-separated string split into Set at startup"
  - "--read-only and --allow-tools mutual exclusivity enforced at both CLI level and constructor level"
metrics:
  duration_seconds: 411
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_modified: 2
---

# Phase 30 Plan 01: Per-Tool Allow-Listing Summary

**One-liner:** Granular write-tool permissions via `--allow-tools tool1,tool2,...` flag, with read tools always available and mutual exclusivity enforced against `--read-only`.

## What Was Built

Added per-tool allow-listing to `MailMCPServer` so users can permit only specific write tools rather than using the binary all-or-nothing `--read-only` flag.

### Changes to `src/index.ts`

1. **New `allowedTools` field:** `private readonly allowedTools?: Set<string>` on `MailMCPServer`.

2. **Constructor update:**
   - New signature: `constructor(readOnly: boolean = false, allowedTools?: Set<string>)`
   - Throws `Error` if both `readOnly=true` and `allowedTools` are provided
   - Builds `instructionsSuffix` dynamically — mentions allow-listed tools by name when set

3. **`getTools(readOnly, allowedTools?)`:**
   - `readOnly=true` → read tools only (existing behavior)
   - `allowedTools` set → read tools + only write tools in the set
   - Neither → all 29 tools (backward compatible)

4. **`dispatchTool()` guard:** After the read-only guard, checks `this.allowedTools` and rejects write tools not in the set with message: `"Tool 'X' is not available: not in the allowed tools list. Allowed write tools: ..."`

5. **`CallToolRequestSchema` handler:** Same allow-list guard applied in the request handler path.

6. **CLI (`main()`):**
   - `--allow-tools` parsed as `string` via `parseArgs`
   - Comma-split into `Set<string>` at startup
   - Mutual exclusivity check with `--read-only` (exits 1 with error)
   - Help text updated

### New file: `src/index.allowlist.test.ts`

20 tests across 10 describe blocks (AL-01 to AL-10) covering:
- Tool filtering with various allow sets
- Dispatch guards (allowed and blocked tools)
- Constructor mutual-exclusivity
- Backward compatibility (no allowedTools = all 29 tools)
- Instructions string content
- Error message distinctness (allow-list vs read-only)

## Test Results

- **New tests:** 20/20 pass
- **Existing tests (index.test.ts, index.sieve.test.ts, all others):** 422 pass
- **Pre-existing failures (index.confirm.test.ts):** 15 failures — Phase 29 TDD RED tests written before implementation. These are out of scope for this plan and were failing before Phase 30 started.

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy adaptation: the `dispatchTool()` signature was not changed (tests pass a 4th argument which is silently ignored; the instance field `this.allowedTools` is used instead). This is correct behavior — the server's allow list is set at construction time.

## Self-Check: PASSED

- FOUND: src/index.allowlist.test.ts
- FOUND: src/index.ts (modified)
- FOUND commit b4b830e: test(30-01) TDD RED
- FOUND commit 43f9044: feat(30-01) TDD GREEN implementation
