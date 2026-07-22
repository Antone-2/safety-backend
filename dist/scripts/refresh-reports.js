import "dotenv/config";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { runGoogleSheetsSync } from "../routes/google-forms.js";
import { logger } from "../shared/utils/logger.js";
async function main() {
    const formId = process.env.GOOGLE_FORM_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!formId) {
        throw new Error("GOOGLE_FORM_ID environment variable is required");
    }
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY environment variable is required");
    }
    logger.info("Clearing all existing reports from PostgreSQL...");
    const deleteResult = await pgPool.query("DELETE FROM reports");
    logger.info({ deletedRows: deleteResult.rowCount }, "All reports deleted.");
    logger.info("Fetching real reports from Google Sheets...");
    const syncResult = await runGoogleSheetsSync({
        spreadsheetId: formId,
        apiKey,
        sheetName: process.env.GOOGLE_SHEET_NAME || "Unsafe Acts/ Conditions (Responses)",
        broadcast: true,
    });
    logger.info({
        imported: syncResult.imported,
        rows: syncResult.rows,
        sheetName: syncResult.sheetName,
    }, "Google Sheets sync complete.");
}
main()
    .catch((error) => {
    logger.error({ err: error }, "Report refresh failed.");
    process.exitCode = 1;
})
    .finally(async () => {
    await pgPool.end();
});
