import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ensureSchema as runMigrations } from "./migrations.js";

type SqlBindParams = (string | number | Uint8Array | null)[] | Record<string, string | number | Uint8Array | null> | null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "..", "..", "..", "data.db");

let dbPromise: Promise<SqlJsDatabase> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

async function getDb(): Promise<SqlJsDatabase> {
  if (!dbPromise) {
    const SQL = await initSqlJs();
    const hasFile = fs.existsSync(DB_PATH);
    const buf = hasFile ? await fs.promises.readFile(DB_PATH) : null;

    let database: SqlJsDatabase;

    if (buf) {
      try {
        database = new SQL.Database(buf);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // sql.js throws "database disk image is malformed" for corrupted/truncated files.
        if (message.toLowerCase().includes("malformed")) {
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          const corruptPath = `${DB_PATH}.corrupt.${ts}`;
          await fs.promises.rename(DB_PATH, corruptPath);
          console.warn(`[sqlite fallback] Corrupt DB detected. Renamed ${DB_PATH} -> ${corruptPath}. Rebuilding...`);

          database = new SQL.Database();
        } else {
          throw err;
        }
      }
    } else {
      database = new SQL.Database();
    }

    try {
      await runMigrations(database);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If migrations fail due to a malformed DB, treat it as corrupted and rebuild.
      if (message.toLowerCase().includes("malformed")) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const corruptPath = `${DB_PATH}.corrupt.${ts}`;
        if (fs.existsSync(DB_PATH)) {
          await fs.promises.rename(DB_PATH, corruptPath);
        }
        console.warn(`[sqlite fallback] Corrupt DB detected during migrations. Renamed ${DB_PATH} -> ${corruptPath}. Rebuilding...`);
        database = new SQL.Database();
        await runMigrations(database);
      } else {
        throw err;
      }
    }

    await saveDb(database);
    dbPromise = Promise.resolve(database);
  }
  return dbPromise;
}

async function saveDb(db: SqlJsDatabase) {
  const data = db.export();
  const buf = Buffer.from(data);
  saveQueue = saveQueue.then(async () => {
    await fs.promises.writeFile(DB_PATH, buf);
    try {
      db.run("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // Ignore checkpoint failures
    }
  }).catch(() => {
    // Ignore save errors
  });
  await saveQueue;
}

export function allRows(db: SqlJsDatabase, sql: string, params?: any[]): any[] {
  const stmt = db.prepare(sql, params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows;
}

/**
 * Synchronous accessor for callers that expect an already-resolved database
 * (e.g. repositories that call `getDb().prepare(...)` synchronously).
 * On first call it blocks until the cached promise resolves.
 */
export function getDbSync(): SqlJsDatabase {
  if (!dbPromise) {
    // Trigger async init; resolve synchronously via the cached promise.
    void getDb();
  }
  // At this point dbPromise is a resolved Promise<SqlJsDatabase>.
  return dbPromise as unknown as SqlJsDatabase;
}

export { getDb, saveDb };
