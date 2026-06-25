import { Database as SqlJsDatabase } from "sql.js";
type SqlBindParams = (string | number | Uint8Array | null)[] | Record<string, string | number | Uint8Array | null> | null;
declare function getDb(): Promise<SqlJsDatabase>;
declare function saveDb(db: SqlJsDatabase): Promise<void>;
export declare function allRows(db: SqlJsDatabase, sql: string, params?: SqlBindParams): any[];
export { getDb, saveDb };
