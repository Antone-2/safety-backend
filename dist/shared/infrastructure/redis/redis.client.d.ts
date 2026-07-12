import { type RedisClientType } from "redis";
export declare const redisClient: RedisClientType;
export declare function connectRedis(): Promise<void>;
export declare function checkRedis(): Promise<{
    name: string;
    ok: boolean;
}>;
