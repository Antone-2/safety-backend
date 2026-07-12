import type { Pool } from "pg";
export type PostgresMigration = {
    id: string;
    description: string;
    sql: string;
};
export declare const POSTGRES_MIGRATIONS: PostgresMigration[];
export declare function runPostgresMigrations(pool?: Pool): Promise<string[]>;
