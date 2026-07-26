import { Redis } from "ioredis";
export declare const MINIMUM_BULLMQ_REDIS_MAJOR = 5;
export declare class RedisRequiredError extends Error {
    constructor(message: string);
}
export declare class RedisVersionUnsupportedError extends Error {
    constructor(message: string);
}
export declare function isRedisRequired(): boolean;
export declare const redisClient: Redis | null;
export declare function connectRedis(): Promise<boolean>;
export declare function supportsBullMq(): Promise<boolean>;
export declare function getBullMqRedisVersion(): string | null;
export declare function ensureRedisProductionReady(): Promise<{
    connected: boolean;
    bullMqReady: boolean;
}>;
export declare function checkRedis(): Promise<{
    name: string;
    ok: boolean;
}>;
