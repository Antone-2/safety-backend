import "dotenv/config";
import { Pool } from "pg";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
function normalizeDatabaseUrl(url) {
    if (!url.includes("render.com") &&
        !url.includes("amazonaws.com") &&
        !url.includes("googleapis.com") &&
        !url.includes("xata.tech")) {
        return url;
    }
    const parsed = new URL(url);
    const searchParams = new URLSearchParams(parsed.search);
    if (!searchParams.has("sslmode")) {
        searchParams.set("sslmode", "require");
    }
    if (!searchParams.has("uselibpqcompat")) {
        searchParams.set("uselibpqcompat", "true");
    }
    parsed.search = searchParams.toString();
    return parsed.toString();
}
function createPool(connectionString) {
    const normalized = normalizeDatabaseUrl(connectionString);
    const hostname = new URL(normalized).hostname;
    const useSsl = hostname.includes("render.com") ||
        hostname.includes("amazonaws.com") ||
        hostname.includes("googleapis.com") ||
        hostname.includes("xata.tech");
    return new Pool({
        connectionString: normalized,
        connectionTimeoutMillis: 15_000,
        idleTimeoutMillis: 30_000,
        max: 10,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
}
function quoteIdentifier(value) {
    return `"${value.replaceAll('"', '""')}"`;
}
async function getPublicTables(pool) {
    const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'schema_migrations'
    ORDER BY table_name
  `);
    return result.rows.map((row) => row.table_name);
}
async function getTableColumns(pool, table) {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    return result.rows.map((row) => row.column_name);
}
async function getDependencyOrder(pool, tables) {
    const dependencyResult = await pool.query(`
    SELECT
      child.relname AS table_name,
      parent.relname AS depends_on
    FROM pg_constraint constraint
    JOIN pg_class child ON child.oid = constraint.conrelid
    JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = constraint.confrelid
    JOIN pg_namespace parent_namespace ON parent_namespace.oid = parent.relnamespace
    WHERE constraint.contype = 'f'
      AND child_namespace.nspname = 'public'
      AND parent_namespace.nspname = 'public'
  `);
    const tableSet = new Set(tables);
    const dependencies = new Map();
    const dependents = new Map();
    for (const table of tables) {
        dependencies.set(table, new Set());
        dependents.set(table, new Set());
    }
    for (const row of dependencyResult.rows) {
        if (!tableSet.has(row.table_name) || !tableSet.has(row.depends_on))
            continue;
        if (row.table_name === row.depends_on)
            continue;
        dependencies.get(row.table_name)?.add(row.depends_on);
        dependents.get(row.depends_on)?.add(row.table_name);
    }
    const ready = tables
        .filter((table) => (dependencies.get(table)?.size ?? 0) === 0)
        .sort();
    const ordered = [];
    while (ready.length > 0) {
        const table = ready.shift();
        ordered.push(table);
        for (const dependent of dependents.get(table) ?? []) {
            const pending = dependencies.get(dependent);
            pending?.delete(table);
            if ((pending?.size ?? 0) === 0 && !ordered.includes(dependent) && !ready.includes(dependent)) {
                ready.push(dependent);
                ready.sort();
            }
        }
    }
    if (ordered.length === tables.length) {
        return ordered;
    }
    const remaining = tables.filter((table) => !ordered.includes(table)).sort();
    console.warn(`Detected a dependency cycle or unresolved ordering among: ${remaining.join(", ")}. Appending remaining tables alphabetically.`);
    return [...ordered, ...remaining];
}
async function truncateTargetTables(pool, tables) {
    if (tables.length === 0)
        return;
    const sql = `TRUNCATE TABLE ${tables.map((table) => quoteIdentifier(table)).join(", ")} RESTART IDENTITY CASCADE`;
    await pool.query(sql);
}
async function loadTableInfo(pool, tables) {
    const result = [];
    for (const table of tables) {
        result.push({
            name: table,
            columns: await getTableColumns(pool, table),
        });
    }
    return result;
}
function buildInsertSql(table, rowCount) {
    const columnsSql = table.columns.map(quoteIdentifier).join(", ");
    const values = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const placeholders = table.columns.map((_, columnIndex) => {
            const parameterIndex = rowIndex * table.columns.length + columnIndex + 1;
            return `$${parameterIndex}`;
        });
        values.push(`(${placeholders.join(", ")})`);
    }
    return `INSERT INTO ${quoteIdentifier(table.name)} (${columnsSql}) VALUES ${values.join(", ")}`;
}
async function copyTable(source, target, table, batchSize = 200) {
    if (table.columns.length === 0) {
        return 0;
    }
    const sourceRows = await source.query(`SELECT * FROM ${quoteIdentifier(table.name)}`);
    if (sourceRows.rowCount === 0) {
        return 0;
    }
    let inserted = 0;
    for (let offset = 0; offset < sourceRows.rows.length; offset += batchSize) {
        const batch = sourceRows.rows.slice(offset, offset + batchSize);
        const values = batch.flatMap((row) => table.columns.map((column) => row[column]));
        await target.query(buildInsertSql(table, batch.length), values);
        inserted += batch.length;
    }
    return inserted;
}
async function syncSequences(target) {
    const serials = await target.query(`
    SELECT
      table_name,
      column_name,
      pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval(%'
  `);
    for (const row of serials.rows) {
        if (!row.sequence_name)
            continue;
        await target.query(`
        SELECT setval(
          $1,
          COALESCE((SELECT MAX(${quoteIdentifier(row.column_name)})::bigint FROM ${quoteIdentifier(row.table_name)}), 1),
          EXISTS(SELECT 1 FROM ${quoteIdentifier(row.table_name)})
        )
      `, [row.sequence_name]);
    }
}
async function main() {
    const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL;
    const targetDatabaseUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (!sourceDatabaseUrl) {
        throw new Error("SOURCE_DATABASE_URL is required");
    }
    if (!targetDatabaseUrl) {
        throw new Error("TARGET_DATABASE_URL or DATABASE_URL is required");
    }
    const sourcePool = createPool(sourceDatabaseUrl);
    const targetPool = createPool(targetDatabaseUrl);
    try {
        await sourcePool.query("SELECT 1");
        await targetPool.query("SELECT 1");
        const migrations = await runPostgresMigrations(targetPool);
        if (migrations.length > 0) {
            console.log(`Applied target migrations: ${migrations.join(", ")}`);
        }
        const sourceTables = await getPublicTables(sourcePool);
        const targetTables = new Set(await getPublicTables(targetPool));
        const tablesToCopy = sourceTables.filter((table) => targetTables.has(table));
        const copyOrder = await getDependencyOrder(sourcePool, tablesToCopy);
        await truncateTargetTables(targetPool, copyOrder);
        const tableInfo = await loadTableInfo(targetPool, copyOrder);
        const summary = {};
        for (const table of tableInfo) {
            const inserted = await copyTable(sourcePool, targetPool, table);
            summary[table.name] = inserted;
            console.log(`Copied ${inserted} rows into ${table.name}`);
        }
        await syncSequences(targetPool);
        console.log("Clone complete");
        console.log(JSON.stringify(summary, null, 2));
    }
    finally {
        await Promise.all([sourcePool.end(), targetPool.end()]);
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
