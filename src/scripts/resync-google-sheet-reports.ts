import "dotenv/config";
import { runGoogleSheetsSync } from "../routes/google-forms.js";
import { logger } from "../shared/utils/logger.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

async function main() {
  const spreadsheetId = process.env.GOOGLE_FORM_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const sheetName =
    process.env.GOOGLE_SHEET_NAME || "Unsafe Acts/ Conditions (Responses)";

  if (!spreadsheetId) {
    throw new Error("GOOGLE_FORM_ID environment variable is required");
  }
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY environment variable is required");
  }

  logger.info(
    {
      spreadsheetId,
      sheetName,
      dateOrder: process.env.GOOGLE_SHEETS_DATE_ORDER ?? "dmy",
      utcOffsetMinutes: process.env.GOOGLE_SHEETS_UTC_OFFSET_MINUTES ?? "180",
    },
    "Re-syncing Google Sheets reports with current parser settings.",
  );

  const result = await runGoogleSheetsSync({
    spreadsheetId,
    apiKey,
    sheetName,
    broadcast: false,
  });

  logger.info(
    {
      imported: result.imported,
      rows: result.rows,
      sheetName: result.sheetName,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
    },
    "Google Sheets report re-sync completed.",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Google Sheets report re-sync failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
