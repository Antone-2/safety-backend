import { redisClient } from "./redis.client.js";

export type CacheResolution = "hit" | "miss" | "coalesced" | "degraded";

export type CacheLookupResult<T> = {
  value: T;
  cacheStatus: CacheResolution;
};

export class CacheService {
  private inFlight = new Map<string, Promise<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    if (!redisClient || redisClient.status !== "ready") return null;
    const value = await redisClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!redisClient || redisClient.status !== "ready") return;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.setex(key, ttlSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    if (!redisClient || redisClient.status !== "ready") return;
    await redisClient.del(key);
  }

  async invalidate(pattern: string): Promise<void> {
    if (!redisClient || redisClient.status !== "ready") return;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        250,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== "0");
  }

  async invalidateMany(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await this.invalidate(pattern);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const result = await this.getOrSetWithMeta(key, factory, ttlSeconds);
    return result.value;
  }

  async getOrSetWithMeta<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number
  ): Promise<CacheLookupResult<T>> {
    if (!redisClient || redisClient.status !== "ready") {
      return {
        value: await factory(),
        cacheStatus: "degraded",
      };
    }

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return {
        value: cached,
        cacheStatus: "hit",
      };
    }

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return {
        value: await existing,
        cacheStatus: "coalesced",
      };
    }

    const pending = (async () => {
      try {
        const value = await factory();
        await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, pending);
    return {
      value: await pending,
      cacheStatus: "miss",
    };
  }
}

export const cacheService = new CacheService();
