export type CacheResolution = "hit" | "miss" | "coalesced" | "degraded";
export type CacheLookupResult<T> = {
    value: T;
    cacheStatus: CacheResolution;
};
export declare class CacheService {
    private inFlight;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    invalidate(pattern: string): Promise<void>;
    invalidateMany(patterns: string[]): Promise<void>;
    getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T>;
    getOrSetWithMeta<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<CacheLookupResult<T>>;
}
export declare const cacheService: CacheService;
