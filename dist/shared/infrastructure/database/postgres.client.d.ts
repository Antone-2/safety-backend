import { Pool } from "pg";
export declare const pgPool: Pool;
export declare function getDbClient(): Promise<import("pg").PoolClient>;
export declare function checkDatabase(): Promise<{
    name: string;
    ok: boolean;
}>;
