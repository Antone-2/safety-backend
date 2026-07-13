/**
 * Runtime SQLite access has been retired. The type-compatible exports remain
 * temporarily so legacy modules fail closed instead of silently opening
 * `data.db`. The only supported SQLite access is the explicit
 * `db:import-sqlite` migration script, which opens its source file directly.
 */
export class PostgresOnlyDatabaseError extends Error {
    constructor() {
        super("SQLite runtime access is disabled; PostgreSQL is the only application database");
        this.name = "PostgresOnlyDatabaseError";
    }
}
export async function getDb() {
    throw new PostgresOnlyDatabaseError();
}
export function getDbSync() {
    throw new PostgresOnlyDatabaseError();
}
export async function saveDb(_db) {
    throw new PostgresOnlyDatabaseError();
}
export function allRows(_db, _sql, _params) {
    throw new PostgresOnlyDatabaseError();
}
