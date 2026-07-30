import { redisClient } from "./redis.client.js";
export class CacheService {
    inFlight = new Map();
    async get(key) {
        if (!redisClient || redisClient.status !== "ready")
            return null;
        const value = await redisClient.get(key);
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!redisClient || redisClient.status !== "ready")
            return;
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await redisClient.setex(key, ttlSeconds, serialized);
        }
        else {
            await redisClient.set(key, serialized);
        }
    }
    async del(key) {
        if (!redisClient || redisClient.status !== "ready")
            return;
        await redisClient.del(key);
    }
    async invalidate(pattern) {
        if (!redisClient || redisClient.status !== "ready")
            return;
        let cursor = "0";
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 250);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
        } while (cursor !== "0");
    }
    async invalidateMany(patterns) {
        for (const pattern of patterns) {
            await this.invalidate(pattern);
        }
    }
    async getOrSet(key, factory, ttlSeconds) {
        const result = await this.getOrSetWithMeta(key, factory, ttlSeconds);
        return result.value;
    }
    async getOrSetWithMeta(key, factory, ttlSeconds) {
        if (!redisClient || redisClient.status !== "ready") {
            return {
                value: await factory(),
                cacheStatus: "degraded",
            };
        }
        const cached = await this.get(key);
        if (cached !== null) {
            return {
                value: cached,
                cacheStatus: "hit",
            };
        }
        const existing = this.inFlight.get(key);
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
            }
            finally {
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
