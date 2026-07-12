import { Database as SqlJsDatabase } from "sql.js";
declare function getDb(): Promise<SqlJsDatabase>;
declare function saveDb(db: SqlJsDatabase): Promise<void>;
export declare function allRows(db: SqlJsDatabase, sql: string, params?: any[]): any[];
/**
 * Synchronous accessor for callers that expect an already-resolved database
 * (e.g. repositories that call `getDb().prepare(...)` synchronously).
 * On first call it blocks until the cached promise resolves.
 */
export declare function getDbSync(): SqlJsDatabase;
export { getDb, saveDb };
