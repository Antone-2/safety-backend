import { Pool } from "pg";
export declare const pgPool: Pool;
export declare function sleep(ms: number): Promise<void>;
/**
 * Detect connection-level failures that are safe to retry. These are transient
 * conditions (server restart, idle timeout, network blip, pool exhaustion) and
 * not deterministic application errors.
 */
export declare function isTransientConnectionError(error: unknown): boolean;
/**
 * Run a query with bounded exponential backoff on transient connection errors.
 */
export declare function queryWithRetry<T>(query: () => Promise<T>, opts?: {
    retries?: number;
    baseDelayMs?: number;
}): Promise<T>;
/**
 * Run a transaction with bounded retry. On a transient connection failure the
 * current client is released and a fresh one is checked out so the whole
 * transaction can be replayed cleanly.
 */
export declare function withTransactionRetry<T>(fn: (client: import("pg").PoolClient) => Promise<T>, opts?: {
    retries?: number;
    baseDelayMs?: number;
}): Promise<T>;
export declare function getDbClient(retries?: number): Promise<import("pg").PoolClient>;
export declare function checkDatabase(): Promise<{
    name: string;
    ok: boolean;
}>;
