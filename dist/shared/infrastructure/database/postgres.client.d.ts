import { Pool } from "pg";
export declare const pgPool: Pool;
export declare function getDbClient(retries?: number): Promise<import("pg").PoolClient>;
export declare function checkDatabase(): Promise<{
    name: string;
    ok: boolean;
}>;
