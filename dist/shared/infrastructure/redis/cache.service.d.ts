export declare class CacheService {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    invalidate(pattern: string): Promise<void>;
    getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T>;
}
export declare const cacheService: CacheService;
