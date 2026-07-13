import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Pool, type PoolClient } from "pg";
import initSqlJs, { type Database } from "sql.js";

import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";

type Row = Record<string, unknown>;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const sourcePath = path.resolve(
  process.env.SQLITE_SOURCE_PATH || path.join(process.cwd(), "..", "data.db"),
);
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required");
if (!fs.existsSync(sourcePath)) throw new Error(`SQLite source not found: ${sourcePath}`);

const databaseUrl = new URL(connectionString);
const useSsl = databaseUrl.hostname.includes(".render.com") || args.has("--ssl");
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 15_000,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

function stableUuid(value: unknown): string {
  const text = String(value ?? "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return text;
  }
  const hash = createHash("sha256").update(`sqlite-import:${text}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function asText(value: unknown, fallback = ""): string {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function asOptionalText(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function asInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function asTimestamp(value: unknown, fallback = new Date()): Date {
  if (typeof value === "number" && value > 0 && value < 100_000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86_400_000);
  }
  const text = asText(value);
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dayFirst) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = dayFirst;
    const parsed = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function asJson(value: unknown, fallback: unknown): string {
  if (value == null || value === "") return JSON.stringify(fallback);
  if (typeof value !== "string") return JSON.stringify(value);
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return JSON.stringify(fallback);
  }
}

function tableExists(db: Database, table: string): boolean {
  const statement = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
  try {
    return statement.step();
  } finally {
    statement.free();
  }
}

function rows(db: Database, table: string): Row[] {
  if (!tableExists(db, table)) return [];
  const statement = db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`);
  const result: Row[] = [];
  try {
    while (statement.step()) result.push(statement.getAsObject() as Row);
  } finally {
    statement.free();
  }
  return result;
}

async function importUsers(client: PoolClient, db: Database) {
  let inserted = 0;
  for (const row of rows(db, "users")) {
    const result = await client.query(
      `INSERT INTO users
       (id, email, password_hash, name, role, phone, active, created_at, updated_at)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT DO NOTHING`,
      [
        stableUuid(row.id),
        asText(row.email),
        asText(row.passwordHash, "!otp-only-account!"),
        asText(row.name, "Imported user"),
        asText(row.role, "hse-officer"),
        asOptionalText(row.phone),
        row.active == null ? true : asBoolean(row.active),
        asTimestamp(row.createdAt),
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function importReports(client: PoolClient, db: Database) {
  let inserted = 0;
  for (const row of rows(db, "reports")) {
    const reportDate = asTimestamp(row.date);
    const slaHours = Math.max(1, asInteger(row.slaHours, 24));
    const fallbackDue = new Date(reportDate.getTime() + slaHours * 60 * 60 * 1000);
    const result = await client.query(
      `INSERT INTO reports
       (id, date, location, reporter, description, severity, status, category, type,
        resolution_days, sla_hours, due_at, assigned_to, assigned_to_copy, is_near_miss,
        anonymous, department, shift, compliance_required, compliance_due_at, photo_url,
        source, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$2,$2)
       ON CONFLICT (id) DO NOTHING`,
      [
        asText(row.id),
        reportDate,
        asText(row.location, "Unknown"),
        asText(row.reporter, "Unknown"),
        asText(row.description, "Imported report"),
        asText(row.severity, "Medium"),
        asText(row.status, "Open"),
        asText(row.category, "General"),
        asText(row.type, "Unsafe Condition"),
        row.resolutionDays == null ? null : asInteger(row.resolutionDays),
        slaHours,
        asTimestamp(row.dueAt, fallbackDue),
        asOptionalText(row.assignedTo),
        asJson(row.assignedToCopy, []),
        asBoolean(row.isNearMiss),
        asBoolean(row.anonymous),
        asText(row.department, "Unassigned"),
        asText(row.shift, "Unspecified"),
        asBoolean(row.complianceRequired),
        row.complianceDueAt ? asTimestamp(row.complianceDueAt) : null,
        asOptionalText(row.photoUrl),
        asText(row.source, "legacy-sqlite"),
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function importReportAudit(client: PoolClient, db: Database) {
  let inserted = 0;
  for (const row of rows(db, "report_audit")) {
    const legacyId = asText(row.id);
    const result = await client.query(
      `INSERT INTO audit_logs
       (id, actor_email, action, resource_type, resource_id, context, created_at)
       SELECT $1, $2, $3, 'report', $4, $5::jsonb, $6
       WHERE NOT EXISTS (
         SELECT 1 FROM audit_logs WHERE context->>'legacySqliteId' = $7
       )`,
      [
        randomUUID(),
        asOptionalText(row.actor),
        asText(row.action, "legacy.report.event"),
        asOptionalText(row.reportId),
        JSON.stringify({ legacySqliteId: legacyId, detail: asOptionalText(row.detail) }),
        asTimestamp(row.createdAt),
        legacyId,
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function importLoginAudit(client: PoolClient, db: Database) {
  let inserted = 0;
  for (const row of rows(db, "auth_login_audit")) {
    const legacyId = asText(row.id);
    const detail = JSON.stringify({ legacySqliteId: legacyId, detail: asOptionalText(row.detail) });
    const result = await client.query(
      `INSERT INTO auth_login_audit
       (id, user_id, email, event, successful, ip_address, user_agent, detail, created_at)
       SELECT $1, u.id, $2, $3, $4, $5, $6, $7, $8
       FROM (SELECT 1) seed
       LEFT JOIN users u ON u.email = lower($2)
       WHERE NOT EXISTS (SELECT 1 FROM auth_login_audit WHERE detail LIKE $9)`,
      [
        randomUUID(),
        asText(row.email, "unknown@invalid.local").toLowerCase(),
        asText(row.event, "legacy.login.event"),
        asBoolean(row.successful),
        asOptionalText(row.ipAddress),
        asOptionalText(row.userAgent),
        detail,
        asTimestamp(row.createdAt),
        `%${legacyId}%`,
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function importNotifications(client: PoolClient, db: Database) {
  let inserted = 0;
  for (const row of rows(db, "notifications")) {
    const legacyId = asText(row.id);
    const jobId = randomUUID();
    const result = await client.query(
      `INSERT INTO notification_jobs
       (id, event_key, workflow, resource_type, resource_id, payload, status, attempts, created_by, created_at, updated_at)
       SELECT $1, 'legacy.notification', 'sqlite-import', 'report', $2, $3::jsonb, $4, 0, 'migration', $5, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM notification_jobs WHERE payload->>'legacySqliteId' = $6
       )`,
      [
        jobId,
        asOptionalText(row.reportId),
        JSON.stringify({
          legacySqliteId: legacyId,
          subject: asOptionalText(row.subject),
          message: asOptionalText(row.message),
          read: asBoolean(row.read),
        }),
        asBoolean(row.delivered) ? "completed" : "failed",
        asTimestamp(row.createdAt),
        legacyId,
      ],
    );
    if ((result.rowCount ?? 0) === 0) continue;
    inserted += 1;
    await client.query(
      `INSERT INTO notification_recipients
       (job_id, channel, recipient, status, delivered_at, failed_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [
        jobId,
        asText(row.channel, "email"),
        asText(row.recipient, "unknown"),
        asBoolean(row.delivered) ? "delivered" : "failed",
        asBoolean(row.delivered) ? asTimestamp(row.createdAt) : null,
        asBoolean(row.delivered) ? null : asTimestamp(row.createdAt),
        asTimestamp(row.createdAt),
      ],
    );
  }
  return inserted;
}

async function main() {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database(await fs.promises.readFile(sourcePath));
  console.log(`Source: ${sourcePath}`);
  console.log(`Mode: ${dryRun ? "dry run (rollback)" : "import"}`);

  await runPostgresMigrations(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summary = {
      users: await importUsers(client, sqlite),
      reports: await importReports(client, sqlite),
      reportAudit: await importReportAudit(client, sqlite),
      loginAudit: await importLoginAudit(client, sqlite),
      notifications: await importNotifications(client, sqlite),
    };
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    sqlite.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
