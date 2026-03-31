import Redis from "ioredis";

export interface ProductCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

export interface RateLimitCounterStore {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export function createRedisClient(redisUrl: string) {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1
  });
}

export class RedisProductCacheStore implements ProductCacheStore {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string) {
    const rawValue = await this.redis.get(key);
    return rawValue ? (JSON.parse(rawValue) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number) {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async deleteByPrefix(prefix: string) {
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
  }
}

export class RedisRateLimitCounterStore implements RateLimitCounterStore {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttlSeconds: number) {
    const currentValue = await this.redis.incr(key);
    if (currentValue === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return currentValue;
  }
}
