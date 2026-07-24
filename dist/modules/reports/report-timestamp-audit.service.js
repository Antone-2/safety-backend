import { allRows, getDb } from "../../lib/database.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { tryParseReportDateWithFallbacks } from "../../shared/utils/report-date.js";
function isPgAvailable() {
    return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}
async function fetchRows() {
    if (isPgAvailable()) {
        const result = await pgPool.query(`
      SELECT id, source, date, due_at, compliance_due_at, created_at, updated_at
      FROM reports
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `);
        return result.rows;
    }
    const db = await getDb();
    return allRows(db, `SELECT id, source, date, due_at, compliance_due_at, created_at, updated_at
     FROM reports
     ORDER BY updated_at DESC, created_at DESC`);
}
export async function auditReportTimestamps(sampleLimit = 25) {
    const rows = await fetchRows();
    let valid = 0;
    let repairable = 0;
    let unrecoverable = 0;
    const repairableSamples = [];
    const unrecoverableSamples = [];
    for (const row of rows) {
        const normalizedDate = tryParseReportDateWithFallbacks(row.date, row.created_at, row.updated_at);
        if (!normalizedDate) {
            unrecoverable += 1;
            if (unrecoverableSamples.length < sampleLimit) {
                unrecoverableSamples.push({
                    id: row.id,
                    source: row.source,
                    storedDate: row.date,
                    normalizedDate: null,
                    storedDueAt: row.due_at,
                    normalizedDueAt: null,
                    storedComplianceDueAt: row.compliance_due_at,
                    normalizedComplianceDueAt: null,
                });
            }
            continue;
        }
        const normalizedDueAt = tryParseReportDateWithFallbacks(row.due_at, normalizedDate, row.created_at) ??
            normalizedDate;
        const normalizedComplianceDueAt = row.compliance_due_at
            ? tryParseReportDateWithFallbacks(row.compliance_due_at, normalizedDate, row.created_at) ?? null
            : null;
        const needsRepair = row.date !== normalizedDate ||
            row.due_at !== normalizedDueAt ||
            (row.compliance_due_at ?? null) !== normalizedComplianceDueAt;
        if (needsRepair) {
            repairable += 1;
            if (repairableSamples.length < sampleLimit) {
                repairableSamples.push({
                    id: row.id,
                    source: row.source,
                    storedDate: row.date,
                    normalizedDate,
                    storedDueAt: row.due_at,
                    normalizedDueAt,
                    storedComplianceDueAt: row.compliance_due_at,
                    normalizedComplianceDueAt,
                });
            }
            continue;
        }
        valid += 1;
    }
    return {
        scanned: rows.length,
        valid,
        repairable,
        unrecoverable,
        repairableSamples,
        unrecoverableSamples,
    };
}
