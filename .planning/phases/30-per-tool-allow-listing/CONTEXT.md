# Phase 30: Per-Tool Allow-Listing — Context

## User Vision

Granular tool permissions for the MCP server. Instead of binary read-only mode (all write tools disabled or all write tools enabled), users can specify exactly which write tools to allow. This is useful for automation scenarios where you want to permit only specific actions — e.g., allow `send_email` but not `delete_email`.

## Problem Being Solved

Currently `--read-only` is binary: either all 15 write tools are available, or none are. There is no middle ground. A user who wants an agent that can send emails but cannot delete them has no way to express that constraint.

## Key Decisions (from auto_decisions)

- New CLI flag: `--allow-tools tool1,tool2,...` (comma-separated list of write tools to enable)
- When `--allow-tools` is set, only those specific write tools are available (read tools always available)
- `--read-only` still works as before (disables ALL write tools)
- `--allow-tools` and `--read-only` are mutually exclusive (error if both set)
- If neither is set, all tools are available (current behavior)
- Implementation: modify `getTools()` to accept an `allowList` parameter
- Store in `MailMCPServer` constructor alongside `readOnly` flag
- Server instructions updated to mention which tools are enabled

## Current State

- `MailMCPServer` constructor takes `readOnly: boolean = false`
- `getTools(readOnly: boolean)` filters all tools or returns all
- `dispatchTool(name, readOnly, args)` checks write guard at call time
- `WRITE_TOOLS` is a `Set<string>` with 15 write tool names
- CLI `main()` parses `--read-only` via `parseArgs`
- Tests in `src/index.test.ts` validate current behavior with 29 total tools, 15 write, 14 read

## Implementation Approach

1. Add `allowedTools?: Set<string>` field to `MailMCPServer` (alongside `readOnly`)
2. Constructor signature: `constructor(private readonly readOnly: boolean = false, private readonly allowedTools?: Set<string>)`
3. `getTools()` receives the allow list and filters: read tools always visible, write tools only if in allow list (or all if no allow list)
4. `dispatchTool()` guard: if `allowedTools` is set and tool is a write tool and not in `allowedTools`, reject
5. Instructions string: if `allowedTools` set, list which write tools are enabled
6. CLI: parse `--allow-tools`, validate mutual exclusivity with `--read-only`, pass `Set` to constructor

## Test Strategy (TDD)

Tests go in `src/index.allowlist.test.ts` (separate file to avoid bloating existing test file).

Behaviors to test:
- `getTools()` with allowList returns read tools + only the allowed write tools
- `getTools()` with allowList excludes write tools not in the list
- `dispatchTool()` with allowList allows listed write tools
- `dispatchTool()` with allowList blocks non-listed write tools
- `readOnly=true` + `allowedTools` set → error / mutual exclusivity
- CLI parsing test (via unit test on `main` helper or server factory)
