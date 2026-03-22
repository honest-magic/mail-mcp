import { describe, it, expect } from 'vitest';
import { QuotaError } from '../errors.js';
import { AccountRateLimiter, DEFAULT_RATE_LIMIT_POINTS, DEFAULT_RATE_LIMIT_DURATION } from './rate-limiter.js';

describe('DEFAULT_RATE_LIMIT_POINTS', () => {
  it('is 100', () => {
    expect(DEFAULT_RATE_LIMIT_POINTS).toBe(100);
  });
});

describe('DEFAULT_RATE_LIMIT_DURATION', () => {
  it('is 60', () => {
    expect(DEFAULT_RATE_LIMIT_DURATION).toBe(60);
  });
});

describe('AccountRateLimiter', () => {
  it('consume() resolves without error when under limit', async () => {
    const limiter = new AccountRateLimiter({ points: 3, duration: 60 });
    await expect(limiter.consume('acct1')).resolves.toBeUndefined();
  });

  it('consume() throws QuotaError after limit is exceeded', async () => {
    const limiter = new AccountRateLimiter({ points: 3, duration: 60 });
    // Exhaust the 3 points
    await limiter.consume('acct1');
    await limiter.consume('acct1');
    await limiter.consume('acct1');
    // 4th call should throw QuotaError
    await expect(limiter.consume('acct1')).rejects.toBeInstanceOf(QuotaError);
  });

  it('QuotaError message contains "Rate limit exceeded" and account id', async () => {
    const limiter = new AccountRateLimiter({ points: 1, duration: 60 });
    await limiter.consume('acct-test');
    let thrown: unknown;
    try {
      await limiter.consume('acct-test');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(QuotaError);
    const msg = (thrown as QuotaError).message;
    expect(msg).toMatch(/Rate limit exceeded/);
    expect(msg).toMatch(/acct-test/);
  });

  it('QuotaError message contains "Retry after" with seconds value', async () => {
    const limiter = new AccountRateLimiter({ points: 1, duration: 60 });
    await limiter.consume('acct-retry');
    let thrown: unknown;
    try {
      await limiter.consume('acct-retry');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as QuotaError).message).toMatch(/Retry after \d+ second/);
  });

  it('exhausting account A does not affect account B (per-account isolation)', async () => {
    const limiter = new AccountRateLimiter({ points: 2, duration: 60 });
    // Exhaust account A
    await limiter.consume('account-a');
    await limiter.consume('account-a');
    // account-a is now exhausted
    await expect(limiter.consume('account-a')).rejects.toBeInstanceOf(QuotaError);
    // account-b should still be fine
    await expect(limiter.consume('account-b')).resolves.toBeUndefined();
  });

  it('constructor accepts custom points and duration', async () => {
    // With points=1, second call should fail immediately
    const limiter = new AccountRateLimiter({ points: 1, duration: 1 });
    await limiter.consume('acct-custom');
    await expect(limiter.consume('acct-custom')).rejects.toBeInstanceOf(QuotaError);
  });
});
