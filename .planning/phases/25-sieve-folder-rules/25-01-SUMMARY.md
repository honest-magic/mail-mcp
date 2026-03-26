---
phase: 25
plan: 01
subsystem: protocol/sieve
tags: [sieve, manageSieve, filters, rfc5804, tls, email-rules]
dependency_graph:
  requires: [src/config.ts, src/index.ts, src/security/keychain.ts]
  provides: [SieveClient, list_filters, get_filter, set_filter, delete_filter]
  affects: [src/index.ts, src/config.ts]
tech_stack:
  added: [node:tls raw TCP/TLS for ManageSieve, SASL PLAIN over ManageSieve]
  patterns: [per-request SieveClient lifecycle, try/finally disconnect, promise-based response reader]
key_files:
  created:
    - src/protocol/sieve.ts
    - src/protocol/sieve.test.ts
    - src/index.sieve.test.ts
  modified:
    - src/config.ts
    - src/index.ts
    - src/index.test.ts
decisions:
  - SieveClient created per-request (stateless, not cached in MailService) — simpler lifecycle for infrequently-used ManageSieve operations
  - Dynamic import of loadCredentials inside dispatch handler to avoid circular dep at module load time
  - rejectUnauthorized:false for TLS to support self-signed certs on self-hosted servers
  - Non-synchronizing literal {N+} for PUTSCRIPT upload so server does not send continuation
  - ECONNREFUSED/ENOTFOUND/ETIMEDOUT produce informative "ManageSieve not supported" error with context
metrics:
  duration_seconds: 583
  completed_date: "2026-03-26T19:35:03Z"
  tasks_completed: 6
  tasks_total: 6
  files_created: 4
  files_modified: 3
  tests_added: 36
---

# Phase 25 Plan 01: SIEVE Folder Rules Summary

## One-Liner

ManageSieve (RFC 5804) client with PLAIN SASL auth over raw TLS, exposing four MCP tools for server-side SIEVE filter management on self-hosted mail servers.

## What Was Built

Four new MCP tools backed by a `SieveClient` class that speaks the ManageSieve text protocol over a raw TLS connection:

| Tool | Type | Description |
|------|------|-------------|
| `list_filters` | read-only | List all SIEVE scripts with active marker |
| `get_filter` | read-only | Retrieve a SIEVE script's content by name |
| `set_filter` | write | Create or replace a SIEVE script |
| `delete_filter` | write | Delete a named SIEVE script |

## Architecture

```
src/protocol/sieve.ts      — SieveClient class (ManageSieve over TLS)
src/config.ts              — manageSievePort optional field in emailAccountSchema
src/index.ts               — tool definitions + dispatch handlers (both paths)
```

**SieveClient lifecycle:** Created fresh per-request using `getAccounts()` + `loadCredentials()`. After the operation, `disconnect()` is called in a `try/finally` block ensuring the connection is always released.

**Response parsing:** The client maintains a string buffer accumulating all incoming socket data. A `_tryConsumeResponse()` method scans the buffer for a terminal line (`OK`, `NO`, `BYE`), handling RFC 5804 literal strings (`{N}\r\n` / `{N+}\r\n`). Promise waiters are resolved when a complete response is detected.

## Key Decisions

1. **SieveClient per-request, not cached** — ManageSieve is used infrequently (filter management, not email reading). Creating a connection per call is simpler and avoids connection lifetime management.

2. **Dynamic import of `loadCredentials`** — To avoid a circular module dependency at load time, `loadCredentials` is dynamically imported inside the dispatch handler.

3. **`rejectUnauthorized: false`** — Self-hosted mail servers commonly use self-signed TLS certificates. Strict certificate validation would break Dovecot/Cyrus deployments without extra configuration.

4. **Non-synchronizing literal `{N+}`** for PUTSCRIPT — The `+` suffix means the client does not wait for a server continuation `{OK}` before sending the literal content, which simplifies the send path.

5. **Graceful error for unsupported servers** — ECONNREFUSED/ENOTFOUND/ETIMEDOUT are mapped to an informative message: "ManageSieve not supported by this server. SIEVE filters require ManageSieve (RFC 5804), typically available on self-hosted servers but not on Gmail or Outlook."

## Test Coverage

- `src/protocol/sieve.test.ts` — 15 unit tests covering: connect/auth, listScripts, getScript, putScript, deleteScript, disconnect, and ECONNREFUSED graceful error. Uses mocked TLS socket.
- `src/index.sieve.test.ts` — 21 integration tests covering: tool registration, annotations, read-only mode, dispatchTool handlers with mocked SieveClient, and constructor argument verification.

Total test suite: 371 tests across 18 files (all pass).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all tools are fully wired. SIEVE script content is passed through as-is (AI authors it).

## Self-Check: PASSED
