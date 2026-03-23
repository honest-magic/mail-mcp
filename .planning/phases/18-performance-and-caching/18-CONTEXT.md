# Phase 18: Performance & Caching - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add in-memory response caching for message body fetches to reduce redundant IMAP operations. Connection pooling is already implemented (services Map with auto-reconnect) — this phase focuses on data caching only.

</domain>

<decisions>
## Implementation Decisions

### Cache scope
- **D-01:** Cache message bodies only (read_email results) — keyed by accountId + uid + folder
- **D-02:** Do NOT cache search results, folder lists, or message listings — scope limited to biggest win
- **D-03:** AI agents often re-read the same email multiple times in a conversation — this is the primary use case

### Cache eviction
- **D-04:** TTL-based expiry: 5 minutes per entry
- **D-05:** Max 100 cached entries
- **D-06:** Entries evicted when TTL expires OR when max entries exceeded (oldest first)

### Cache storage
- **D-07:** In-memory Map with TTL wrapper — zero dependencies, no persistent state
- **D-08:** Cache lost on server restart — acceptable for a session-oriented MCP server
- **D-09:** No external library (no lru-cache) — hand-roll a simple TTL Map wrapper

### Claude's Discretion
- Exact TTL Map implementation (wrapper class vs utility functions)
- Where in the call chain to check/populate cache (ImapClient vs MailService vs tool handler)
- Whether to expose cache stats via a tool or log

</decisions>

<specifics>
## Specific Ideas

- Connection pooling is already done via the `services` Map in MailMCPServer — don't re-implement
- `fetchMessageBody` in ImapClient does full `simpleParser` each call — cache the ParsedMail result
- Cache key: `${accountId}:${folder}:${uid}` — simple string concatenation
- When a message is moved (move_email), invalidate its cache entry at old key

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### IMAP client
- `src/protocol/imap.ts` line 140 — `fetchMessageBody()` where cache check/populate goes

### Service layer
- `src/services/mail.ts` — MailService wraps ImapClient, may be better cache location

### Connection management
- `src/index.ts` lines 74-103 — `_createAndCacheService()` and `getService()` — existing connection pool pattern to follow

### Rate limiter pattern
- `src/utils/rate-limiter.ts` — existing in-memory utility pattern (per-account Map) worth following for cache

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- `services` Map in MailMCPServer — connection pool pattern (Map<string, MailService>)
- `rate-limiter.ts` — per-account in-memory utility with Map storage
- Config cache in `config.ts` — `cachedAccounts` with fs.watch invalidation

### Integration Points
- `ImapClient.fetchMessageBody(uid, folder)` returns `ParsedMail` — cache this return value
- `MailMCPServer.getService()` — the cache could live per-MailService or as a shared utility
- `move_email` handler — should invalidate cache entry for the moved message

### Established Conventions
- No external dependencies for utilities (rate limiter is hand-rolled)
- Map-based storage for in-memory state
- Per-account scoping for resources

</code_context>

<deferred>
## Deferred Ideas

- Search result caching — defer until measured as a bottleneck
- Folder list caching — folders rarely change but caching adds invalidation complexity
- Disk-based persistent cache — changes stateless gateway model
- Cache stats MCP tool — nice-to-have, not essential

</deferred>

---

*Phase: 18-performance-and-caching*
*Context gathered: 2026-03-23*
