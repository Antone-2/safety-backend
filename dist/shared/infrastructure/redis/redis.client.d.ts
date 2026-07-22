import { Redis } from "ioredis";
export declare const redisClient: Redis | null;
export declare function connectRedis(): Promise<boolean>;
export declare function supportsBullMq(): Promise<boolean>;
export declare function getBullMqRedisVersion(): string | null;
export declare function checkRedis(): Promise<{
    name: string;
    ok: boolean;
}>;
