import rateLimit, { type Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Request } from 'express';
import { env } from '../config/env';
import { getRedisClient } from '../config/redis';

/**
 * PRD 8.6 / 8.11 — Rate Limiter stage.
 *
 * Applied to every public endpoint, not just OTP: ~100 req/min per IP
 * generally, with much tighter limits on the auth endpoints.
 *
 * Counters live in Redis so they are shared across instances and survive a
 * restart; without Redis (local dev) express-rate-limit's in-memory store is
 * used instead.
 */
function buildStore(prefix: string): Options['store'] | undefined {
  const client = getRedisClient();
  if (!client) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => client.call(...(args as [string, ...string[]])) as never,
  });
}

interface LimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  message?: string;
}

/**
 * Limiters are keyed by IP, not by user. The pipeline order in PRD 8.6 is
 * fixed — rate limiting runs *before* JWT authentication — so req.user does
 * not exist yet at this stage and cannot be part of the key.
 */
export function createRateLimiter({ windowMs, limit, prefix, message }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: buildStore(prefix),
    keyGenerator: (req: Request) => `ip:${req.ip ?? 'unknown'}`,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: message ?? 'Too many requests, please try again later.',
      },
    },
  });
}

/** ~100 req/min per IP across the API (PRD 8.11). */
export const generalLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_GENERAL_PER_MIN,
  prefix: 'general',
});

/**
 * Tighter ceiling on auth endpoints. The precise per-phone OTP quota
 * (PRD 8.7 — max 5/hour) is enforced separately in the OTP service, keyed by
 * phone number as well as IP, so an attacker cannot rotate IPs to bypass it.
 */
export const authLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 20,
  prefix: 'auth',
  message: 'Too many authentication attempts. Please wait a minute and try again.',
});

/** Writes are cheaper to abuse than reads; keep mutations bounded too. */
export const writeLimiter = createRateLimiter({
  windowMs: 60_000,
  limit: 60,
  prefix: 'write',
});
