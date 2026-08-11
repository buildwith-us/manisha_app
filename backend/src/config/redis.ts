import Redis from 'ioredis';
import { env, isProduction } from './env';
import { logger } from './logger';

/**
 * Redis backs OTP storage and rate-limit counters (PRD 2 / 8.11).
 *
 * In local development REDIS_URL may be blank — we fall back to an in-process
 * map so the API still boots. That fallback is refused in production, because
 * OTP state and rate-limit counters must survive a restart and be shared
 * across instances.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
}

class MemoryStore implements KeyValueStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number | null }>();

  private read(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    return this.read(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string) {
    this.entries.delete(key);
  }

  async incr(key: string) {
    const current = Number(this.read(key) ?? 0) + 1;
    const existing = this.entries.get(key);
    this.entries.set(key, { value: String(current), expiresAt: existing?.expiresAt ?? null });
    return current;
  }

  async expire(key: string, ttlSeconds: number) {
    const entry = this.entries.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
  }

  async ttl(key: string) {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }
}

class RedisStore implements KeyValueStore {
  constructor(private readonly client: Redis) {}

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async incr(key: string) {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number) {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string) {
    return this.client.ttl(key);
  }
}

let redisClient: Redis | null = null;
let store: KeyValueStore | null = null;

export function initRedis(): KeyValueStore {
  if (store) return store;

  if (!env.REDIS_URL) {
    if (isProduction) {
      throw new Error('REDIS_URL is required in production — OTP and rate-limit state cannot be in-process.');
    }
    logger.warn('REDIS_URL not set — using in-memory store (development only).');
    store = new MemoryStore();
    return store;
  }

  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error', (error) => logger.error('Redis error', error.message));

  store = new RedisStore(redisClient);
  return store;
}

export function getStore(): KeyValueStore {
  return store ?? initRedis();
}

/** Raw client for libraries that need it (rate-limit-redis). Null when falling back to memory. */
export function getRedisClient(): Redis | null {
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  store = null;
}
