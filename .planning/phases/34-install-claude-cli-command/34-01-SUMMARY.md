---
phase: 34
plan: 01
subsystem: cli
tags: [cli, install, setup, claude-desktop]
dependency_graph:
  requires: []
  provides: [install-claude-flag]
  affects: [src/index.ts, src/cli/install-claude.ts]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN, CLI flag handler, config file merge]
key_files:
  created:
    - src/cli/install-claude.ts
    - src/cli/install-claude.test.ts
    - .planning/phases/34-install-claude-cli-command/CONTEXT.md
    - .planning/phases/34-install-claude-cli-command/34-01-PLAN.md
  modified:
    - src/index.ts
key_decisions:
  - installClaude takes explicit (configPath, binaryPath) params for testability without touching real FS
  - Binary detection uses `which mail-mcp` with fallback to process.argv[1]
  - Only Claude Desktop supported (claude_desktop_config.json); Claude Code CLI uses different schema
  - Config merge preserves all existing keys and other mcpServers entries
  - File written with 2-space indentation + trailing newline
metrics:
  duration: "~8 minutes"
  completed: "2026-03-26T20:07:00Z"
  tasks_completed: 4
  files_changed: 3
---

# Phase 34 Plan 01: Install Claude CLI Command Summary

## One-liner

`--install-claude` flag that writes `mcpServers.mail` config to Claude Desktop's JSON config file with binary path auto-detection.

## What Was Built

Added `mail-mcp --install-claude` CLI command that configures Claude Desktop with the mail-mcp server in a single command. No manual JSON editing required.

### New files

**`src/cli/install-claude.ts`** — Core installer function:
- `installClaude(configPath: string, binaryPath: string): Promise<string>`
- Creates config directory (recursive mkdir) if it doesn't exist
- Creates or merges into existing `claude_desktop_config.json`
- Preserves all existing `mcpServers` entries and top-level config keys
- Writes with 2-space indentation and trailing newline
- Throws descriptive error on malformed JSON

**`src/cli/install-claude.test.ts`** — 6 tests covering:
1. Creates new config file with `mcpServers.mail` entry
2. Creates parent directory recursively when neither dir nor file exist
3. Merges into existing config preserving other mcpServers and config keys
4. Updates an existing `mail` entry with new binary path
5. Writes with 2-space indentation
6. Throws with clear message on malformed JSON

### Modified files

**`src/index.ts`** — Wired `--install-claude` flag:
- Import added: `import { installClaude } from './cli/install-claude.js'`
- parseArgs option: `'install-claude': { type: 'boolean', default: false }`
- Handler: detects binary via `which mail-mcp` (fallback: `process.argv[1]`)
- Config path: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Success output: config path, binary path, restart reminder
- Help text updated with `--install-claude` description

## Decisions Made

- **Explicit params for testability**: `installClaude(configPath, binaryPath)` takes paths as arguments rather than computing them internally. This allows unit tests to use temp directories without touching the real Claude Desktop config.

- **Binary detection order**: `which mail-mcp` first (installed binary), fall back to `process.argv[1]` (current script path). No third option needed.

- **Claude Desktop only**: Claude Code CLI's `~/.claude/settings.json` does not have an `mcpServers` field — it uses a different configuration mechanism. Supporting only Claude Desktop keeps the scope clean and avoids writing to the wrong location.

- **Config merge strategy**: Read → parse → set `mcpServers.mail` → write. All other top-level keys and other `mcpServers` entries are preserved. This is idempotent — running `--install-claude` multiple times is safe.

## Test Results

- 494 tests passing across 24 test files
- 6 new tests added for `installClaude()` — all pass
- 3 pre-existing `process.exit` unhandled rejection warnings in index test files (from prior phases, not caused by Phase 34)

## Deviations from Plan

None — plan executed as written. TDD RED/GREEN followed correctly.

## Known Stubs

None. The installer is fully functional: reads, merges, and writes the config.

## Self-Check

## Self-Check: PASSED

- FOUND: src/cli/install-claude.ts
- FOUND: src/cli/install-claude.test.ts
- FOUND: .planning/phases/34-install-claude-cli-command/34-01-SUMMARY.md
- COMMIT c483b52: test(34-01): add failing tests for installClaude()
- COMMIT 4f048b1: feat(34-01): implement installClaude() for Claude Desktop config
- COMMIT c8888e2: feat(31-01): wire --redact CLI flag end-to-end (contains --install-claude wiring)
