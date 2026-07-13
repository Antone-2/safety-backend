import type { Database as SqlJsDatabase } from "sql.js";
/**
 * Runtime SQLite access has been retired. The type-compatible exports remain
 * temporarily so legacy modules fail closed instead of silently opening
 * `data.db`. The only supported SQLite access is the explicit
 * `db:import-sqlite` migration script, which opens its source file directly.
 */
export declare class PostgresOnlyDatabaseError extends Error {
    constructor();
}
export declare function getDb(): Promise<SqlJsDatabase>;
export declare function getDbSync(): SqlJsDatabase;
export declare function saveDb(_db: SqlJsDatabase): Promise<void>;
export declare function allRows(_db: SqlJsDatabase, _sql: string, _params?: unknown[]): any[];
