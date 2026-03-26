---
phase: 24
plan: 01
subsystem: templates
tags: [templates, mcp-tools, read-only, configuration]
dependency_graph:
  requires: [src/config.ts (pattern), src/utils/templates.ts (new)]
  provides: [list_templates tool, use_template tool]
  affects: [src/index.ts (tool count: 18->20)]
tech_stack:
  added: []
  patterns: [fs.watch cache invalidation, Zod per-item safeParse, {{var}} regex substitution]
key_files:
  created:
    - src/utils/templates.ts
    - src/utils/templates.test.ts
    - .planning/phases/24-email-templates/24-CONTEXT.md
    - .planning/phases/24-email-templates/24-01-PLAN.md
  modified:
    - src/index.ts
    - src/index.test.ts
decisions:
  - id: TPL-01
    summary: "Templates stored in ~/.config/mail-mcp/templates.json — separate file from accounts.json; same cache pattern"
  - id: TPL-02
    summary: "use_template is read-only — resolves template to args only; AI calls send_email/create_draft separately"
  - id: TPL-03
    summary: "{{variable}} regex replaces all occurrences globally; unknown placeholders left intact for AI awareness"
  - id: TPL-04
    summary: "list_templates with accountId returns global (no accountId) + account-scoped templates; omit returns all"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_changed: 4
---

# Phase 24 Plan 01: Email Templates Summary

## One-liner

Reusable email template system with `{{variable}}` substitution stored in `~/.config/mail-mcp/templates.json`, exposed as two read-only MCP tools (`list_templates`, `use_template`).

## What Was Built

### src/utils/templates.ts (new)

- `TEMPLATES_PATH` — `~/.config/mail-mcp/templates.json`
- `emailTemplateSchema` (Zod) — validates `id`, `name`, `body` (required) + `subject`, `isHtml`, `accountId` (optional)
- `getTemplates()` — reads disk with in-memory cache + `fs.watch` invalidation; skips invalid items with `console.error`; returns `[]` if file missing
- `applyVariables(template, vars)` — replaces `{{key}}` globally via regex; leaves unknown placeholders intact
- `resetTemplatesCache()` — exported for test isolation

### src/index.ts (modified)

Two new read-only MCP tools added to `getTools()` and `dispatchTool()`:

**`list_templates`**
- Optional `accountId` filter: returns global templates (no `accountId` field) + templates matching the given account
- Omit `accountId` to return all templates
- Returns JSON array

**`use_template`**
- Required `templateId`; optional `variables`, `to`, `cc`, `bcc`, `accountId`
- Finds template by id → applies `applyVariables` to body and subject
- Returns JSON args object ready for `send_email` or `create_draft`
- Returns `isError: true` if `templateId` not found

### Tool count change

Total tools: 18 → 20. Read-only tools: 10 → 12. Both new tools are read-only (not in `WRITE_TOOLS` set, appear in read-only server mode).

## Test Coverage

- `src/utils/templates.test.ts`: 16 tests — schema validation, cache (miss/hit/invalidation), error cases, `applyVariables` edge cases
- `src/index.test.ts`: 18 new tests — `TPL-01` (list_templates) and `TPL-02` (use_template) suites
- Full suite: **316 tests passing**

## Commits

| Hash    | Type | Description |
|---------|------|-------------|
| a34ae5d | test | add failing tests for template schema, cache, and applyVariables |
| dc0f0c1 | feat | implement template schema, cache, and applyVariables utility |
| 3aad6b8 | test | add failing tests for list_templates and use_template tools |
| 663ff3c | feat | add list_templates and use_template MCP tools |
| a7d5a9c | docs | add 24-CONTEXT.md and 24-01-PLAN.md |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Templates are optional (file missing = empty array). Tool output is fully wired.

## Self-Check: PASSED

- [x] `src/utils/templates.ts` exists
- [x] `src/utils/templates.test.ts` exists (16 tests)
- [x] `list_templates` and `use_template` in `getTools()`
- [x] Dispatch handlers in `dispatchTool()`
- [x] `npm test` — 316/316 pass
- [x] `npm run build` — clean, no errors
