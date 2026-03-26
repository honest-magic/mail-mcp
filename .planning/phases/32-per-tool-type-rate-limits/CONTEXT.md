# Phase 32: Per-Tool-Type Rate Limits — Context

## Goal

Separate rate limit tiers for read operations (higher limit) vs write operations (stricter limit), all still per-account.

## Current State

`AccountRateLimiter` in `src/utils/rate-limiter.ts` is a single-tier per-account rate limiter.
- Default: 100 points / 60 seconds
- `index.ts` calls `rateLimiter.consume(accountId)` for every tool call that has an `accountId`
- `WRITE_TOOLS` set already exists in `index.ts` (lines 25–41) — lists all mutating tools

## Target State

- New class `TieredRateLimiter` (or extended `AccountRateLimiter`) supporting two tiers: `read` and `write`
- `consumeRead(accountId)` — 100 req/60s by default
- `consumeWrite(accountId)` — 20 req/60s by default
- Tool dispatch in `index.ts` calls `consumeRead` or `consumeWrite` based on whether the tool name is in `WRITE_TOOLS`
- Backward compatible: existing `AccountRateLimiter` stays unchanged; new `TieredRateLimiter` wraps two instances
- Configurable via constructor params for testability

## Design Decision

Use a `TieredRateLimiter` that internally owns two `AccountRateLimiter` instances (read + write).
This keeps the existing class untouched and composable.

## Key Constants

- `DEFAULT_READ_RATE_LIMIT_POINTS = 100` (req/60s)
- `DEFAULT_WRITE_RATE_LIMIT_POINTS = 20` (req/60s)
- Duration stays at 60 seconds for both tiers

## Files to Change

- `src/utils/rate-limiter.ts` — add `TieredRateLimiter` class + new constants
- `src/utils/rate-limiter.test.ts` — add TDD tests for `TieredRateLimiter`
- `src/index.ts` — replace `AccountRateLimiter` with `TieredRateLimiter`, call `consumeRead`/`consumeWrite`
