import "dotenv/config";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";
import { tryParseReportDateWithFallbacks } from "../shared/utils/report-date.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const client = await pgPool.connect();
  try {
    const result = await client.query<{
      id: string;
      source: string | null;
      date: string | null;
      due_at: string | null;
      compliance_due_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(`
      SELECT id, source, date, due_at, compliance_due_at, created_at, updated_at
      FROM reports
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `);

    let updated = 0;
    let skipped = 0;
    const skippedIds: string[] = [];
    const updatedIds: string[] = [];

    await client.query("BEGIN");
    for (const row of result.rows) {
      const normalizedDate = tryParseReportDateWithFallbacks(
        row.date,
        row.created_at,
        row.updated_at,
      );
      if (!normalizedDate) {
        skipped += 1;
        skippedIds.push(row.id);
        continue;
      }

      const normalizedDueAt =
        tryParseReportDateWithFallbacks(row.due_at, normalizedDate, row.created_at) ??
        normalizedDate;
      const normalizedComplianceDueAt = row.compliance_due_at
        ? tryParseReportDateWithFallbacks(
            row.compliance_due_at,
            normalizedDate,
            row.created_at,
          ) ?? null
        : null;

      const needsUpdate =
        row.date !== normalizedDate ||
        row.due_at !== normalizedDueAt ||
        (row.compliance_due_at ?? null) !== normalizedComplianceDueAt;

      if (!needsUpdate) continue;

      if (!DRY_RUN) {
        await client.query(
          `UPDATE reports
           SET date = $2,
               due_at = $3,
               compliance_due_at = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id, normalizedDate, normalizedDueAt, normalizedComplianceDueAt],
        );
      }
      updated += 1;
      updatedIds.push(row.id);
    }
    await client.query(DRY_RUN ? "ROLLBACK" : "COMMIT");

    logger.info(
      {
        dryRun: DRY_RUN,
        scanned: result.rows.length,
        updated,
        skipped,
        updatedIds: updatedIds.slice(0, 25),
        skippedIds: skippedIds.slice(0, 25),
      },
      "Report timestamp backfill completed.",
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Report timestamp backfill failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
