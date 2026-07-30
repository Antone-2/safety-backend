import "dotenv/config";
import { logger } from "../shared/utils/logger.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

type DuplicateIdRow = {
  id: string;
  copies: number;
  earliest_date: string;
  latest_date: string;
  sources: string[];
};

type DuplicateContentRow = {
  date: string;
  location: string;
  reporter: string;
  description: string;
  category: string;
  type: string;
  severity: string;
  copies: number;
  ids: string[];
};

const JSON_OUTPUT = process.argv.includes("--json");
const SAMPLE_LIMIT = Math.max(
  1,
  Math.min(100, Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 25) || 25),
);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to audit duplicate reports in PostgreSQL.");
  }

  const totalResult = await pgPool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM reports");
  const duplicateIdsResult = await pgPool.query<DuplicateIdRow>(
    `
      SELECT
        id,
        COUNT(*)::int AS copies,
        MIN(date)::text AS earliest_date,
        MAX(date)::text AS latest_date,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT source), NULL) AS sources
      FROM reports
      GROUP BY id
      HAVING COUNT(*) > 1
      ORDER BY copies DESC, latest_date DESC
      LIMIT $1
    `,
    [SAMPLE_LIMIT],
  );

  const duplicateContentResult = await pgPool.query<DuplicateContentRow>(
    `
      SELECT
        date::text AS date,
        location,
        reporter,
        description,
        category,
        type,
        severity,
        COUNT(*)::int AS copies,
        ARRAY_AGG(id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, date DESC) AS ids
      FROM reports
      GROUP BY date, location, reporter, description, category, type, severity
      HAVING COUNT(*) > 1
      ORDER BY copies DESC, date DESC
      LIMIT $1
    `,
    [SAMPLE_LIMIT],
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    totalReports: Number(totalResult.rows[0]?.count ?? 0),
    duplicateIdGroups: duplicateIdsResult.rows.length,
    duplicateContentGroups: duplicateContentResult.rows.length,
    sampleLimit: SAMPLE_LIMIT,
    duplicateIds: duplicateIdsResult.rows,
    duplicateContent: duplicateContentResult.rows,
  };

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  logger.info(summary, "Duplicate report audit completed.");
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Duplicate report audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
