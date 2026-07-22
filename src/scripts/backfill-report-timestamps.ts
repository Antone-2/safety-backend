import "dotenv/config";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";

const GOOGLE_SHEETS_UTC_OFFSET_MINUTES = Number(
  process.env.GOOGLE_SHEETS_UTC_OFFSET_MINUTES ?? "180",
);
const GOOGLE_SHEETS_DATE_ORDER = (process.env.GOOGLE_SHEETS_DATE_ORDER || "mdy").toLowerCase();

function normalizeTimestamp(value: unknown, ...fallbacks: unknown[]): string {
  const utcOffsetMinutes = Number.isFinite(GOOGLE_SHEETS_UTC_OFFSET_MINUTES)
    ? GOOGLE_SHEETS_UTC_OFFSET_MINUTES
    : 180;

  const fromSheetLocalTime = (
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
  ) =>
    new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
        utcOffsetMinutes * 60_000,
    );

  const attempt = (rawValue: unknown) => {
    const raw = String(rawValue ?? "").trim();
    if (!raw) return "";

    const spreadsheetSerial = Number(raw);
    if (
      Number.isFinite(spreadsheetSerial) &&
      spreadsheetSerial >= 20000 &&
      spreadsheetSerial < 100000
    ) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const parsed = new Date(
        excelEpoch + spreadsheetSerial * 86400000 - utcOffsetMinutes * 60_000,
      );
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    const localDate = raw.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[T,\s]+(\d{1,2}):?(\d{2})?(?::?(\d{2}))?\s*(AM|PM)?)?$/i,
    );
    if (localDate) {
      const [, firstRaw, secondRaw, yearRaw, hourRaw, minuteRaw, secondPartRaw, meridiemRaw] =
        localDate;
      const first = Number(firstRaw);
      const second = Number(secondRaw);
      const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
      const monthFirst =
        GOOGLE_SHEETS_DATE_ORDER === "mdy"
          ? second > 12 || first <= 12
          : GOOGLE_SHEETS_DATE_ORDER === "dmy"
            ? false
            : second > 12 && first <= 12;
      const day = monthFirst ? second : first;
      const month = monthFirst ? first : second;
      let hour = Number(hourRaw || 0);
      const minute = Number(minuteRaw || 0);
      const secondPart = Number(secondPartRaw || 0);
      const meridiem = meridiemRaw?.toUpperCase();
      if (meridiem === "PM" && hour < 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const parsed = fromSheetLocalTime(year, month, day, hour, minute, secondPart);
      const localCheck = new Date(parsed.getTime() + utcOffsetMinutes * 60_000);
      if (
        localCheck.getUTCFullYear() === year &&
        localCheck.getUTCMonth() === month - 1 &&
        localCheck.getUTCDate() === day
      ) {
        return parsed.toISOString();
      }
    }

    const isoLocal = raw.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (isoLocal) {
      const [, year, month, day, hour, minute, second = "0"] = isoLocal;
      return fromSheetLocalTime(+year, +month, +day, +hour, +minute, +second).toISOString();
    }

    const parsed = new Date(raw);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Number.isFinite(parsed.getTime()) &&
      parsed.getUTCFullYear() >= 2000 &&
      parsed.getUTCFullYear() <= 2100
    ) {
      return parsed.toISOString();
    }

    return "";
  };

  for (const candidate of [value, ...fallbacks]) {
    const normalized = attempt(candidate);
    if (normalized) return normalized;
  }

  return new Date().toISOString();
}

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

    await client.query("BEGIN");
    for (const row of result.rows) {
      const normalizedDate = normalizeTimestamp(row.date, row.created_at, row.updated_at);
      const normalizedDueAt = normalizeTimestamp(row.due_at, normalizedDate, row.created_at);
      const normalizedComplianceDueAt = row.compliance_due_at
        ? normalizeTimestamp(row.compliance_due_at, normalizedDate, row.created_at)
        : null;

      const needsUpdate =
        row.date !== normalizedDate ||
        row.due_at !== normalizedDueAt ||
        (row.compliance_due_at ?? null) !== normalizedComplianceDueAt;

      if (!needsUpdate) continue;

      await client.query(
        `UPDATE reports
         SET date = $2,
             due_at = $3,
             compliance_due_at = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, normalizedDate, normalizedDueAt, normalizedComplianceDueAt],
      );
      updated += 1;
    }
    await client.query("COMMIT");

    logger.info(
      {
        scanned: result.rows.length,
        updated,
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
