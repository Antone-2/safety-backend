import type { Database as SqlJsDatabase } from "sql.js";

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

export async function getDb(): Promise<SqlJsDatabase> {
  throw new PostgresOnlyDatabaseError();
}

export function getDbSync(): SqlJsDatabase {
  throw new PostgresOnlyDatabaseError();
}

export async function saveDb(_db: SqlJsDatabase): Promise<void> {
  throw new PostgresOnlyDatabaseError();
}

export function allRows(
  _db: SqlJsDatabase,
  _sql: string,
  _params?: unknown[],
): Record<string, unknown>[] {
  throw new PostgresOnlyDatabaseError();
}
