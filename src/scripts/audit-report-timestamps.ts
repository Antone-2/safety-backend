import "dotenv/config";
import fs from "node:fs/promises";
import { logger } from "../shared/utils/logger.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { auditReportTimestamps } from "../modules/reports/report-timestamp-audit.service.js";

const JSON_OUTPUT = process.argv.includes("--json");
const outIndex = process.argv.indexOf("--out");
const OUTPUT_PATH =
  outIndex >= 0 && process.argv[outIndex + 1] ? process.argv[outIndex + 1] : "";

function toCsvValue(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const summary = await auditReportTimestamps();

  if (OUTPUT_PATH) {
    if (JSON_OUTPUT) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(summary, null, 2), "utf8");
    } else {
      const rows = [
        ...summary.repairableSamples.map((sample) => ({ state: "repairable", ...sample })),
        ...summary.unrecoverableSamples.map((sample) => ({
          state: "unrecoverable",
          ...sample,
        })),
      ];
      const header = [
        "state",
        "id",
        "source",
        "storedDate",
        "normalizedDate",
        "storedDueAt",
        "normalizedDueAt",
        "storedComplianceDueAt",
        "normalizedComplianceDueAt",
      ];
      const csv = [
        header.join(","),
        ...rows.map((row) =>
          header.map((key) => toCsvValue(row[key as keyof typeof row])).join(","),
        ),
      ].join("\n");
      await fs.writeFile(OUTPUT_PATH, `${csv}\n`, "utf8");
    }
  }

  logger.info(
    { ...summary, outputPath: OUTPUT_PATH || undefined, outputFormat: OUTPUT_PATH ? (JSON_OUTPUT ? "json" : "csv") : undefined },
    "Report timestamp audit completed.",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Report timestamp audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
