import { redisClient } from "./redis.client.js";
export class CacheService {
    async get(key) {
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
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await redisClient.setEx(key, ttlSeconds, serialized);
        }
        else {
            await redisClient.set(key, serialized);
        }
    }
    async del(key) {
        await redisClient.del(key);
    }
    async invalidate(pattern) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    }
    async getOrSet(key, factory, ttlSeconds) {
        const cached = await this.get(key);
        if (cached !== null)
            return cached;
        const value = await factory();
        await this.set(key, value, ttlSeconds);
        return value;
    }
}
export const cacheService = new CacheService();
