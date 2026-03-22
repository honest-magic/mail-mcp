import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { QuotaError } from '../errors.js';

export const DEFAULT_RATE_LIMIT_POINTS = 100;
export const DEFAULT_RATE_LIMIT_DURATION = 60;

export interface AccountRateLimiterOptions {
  points?: number;
  duration?: number;
}

/**
 * Per-account rate limiter.
 * Uses a separate RateLimiterMemory instance per accountId for true isolation.
 * Instantiate per MailMCPServer — NOT as a module-level singleton.
 */
export class AccountRateLimiter {
  private readonly limiters = new Map<string, RateLimiterMemory>();
  private readonly points: number;
  private readonly duration: number;

  constructor(opts: AccountRateLimiterOptions = {}) {
    this.points = opts.points ?? DEFAULT_RATE_LIMIT_POINTS;
    this.duration = opts.duration ?? DEFAULT_RATE_LIMIT_DURATION;
  }

  private getLimiter(accountId: string): RateLimiterMemory {
    let limiter = this.limiters.get(accountId);
    if (!limiter) {
      limiter = new RateLimiterMemory({
        points: this.points,
        duration: this.duration,
      });
      this.limiters.set(accountId, limiter);
    }
    return limiter;
  }

  async consume(accountId: string): Promise<void> {
    try {
      await this.getLimiter(accountId).consume(accountId);
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const wait = Math.ceil(err.msBeforeNext / 1000);
        throw new QuotaError(
          `Rate limit exceeded for account "${accountId}". Retry after ${wait} second(s).`,
        );
      }
      // Re-throw unexpected errors
      throw err;
    }
  }
}
