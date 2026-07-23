const GOOGLE_SHEETS_UTC_OFFSET_MINUTES = Number(
  process.env.GOOGLE_SHEETS_UTC_OFFSET_MINUTES ?? "180",
);
const GOOGLE_SHEETS_DATE_ORDER = (process.env.GOOGLE_SHEETS_DATE_ORDER || "mdy").toLowerCase();

function getUtcOffsetMinutes(): number {
  return Number.isFinite(GOOGLE_SHEETS_UTC_OFFSET_MINUTES)
    ? GOOGLE_SHEETS_UTC_OFFSET_MINUTES
    : 180;
}

function fromSheetLocalTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
      getUtcOffsetMinutes() * 60_000,
  );
}

function parseSpreadsheetSerial(value: string): string | undefined {
  const spreadsheetSerial = Number(value);
  if (
    !Number.isFinite(spreadsheetSerial) ||
    spreadsheetSerial < 20000 ||
    spreadsheetSerial >= 100000
  ) {
    return undefined;
  }

  const excelEpoch = Date.UTC(1899, 11, 30);
  const parsed = new Date(
    excelEpoch + spreadsheetSerial * 86400000 - getUtcOffsetMinutes() * 60_000,
  );
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function parseLocalSlashDate(value: string): string | undefined {
  const localDate = value.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[T,\s]+(\d{1,2}):?(\d{2})?(?::?(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!localDate) return undefined;

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
  const localCheck = new Date(parsed.getTime() + getUtcOffsetMinutes() * 60_000);
  if (
    localCheck.getUTCFullYear() === year &&
    localCheck.getUTCMonth() === month - 1 &&
    localCheck.getUTCDate() === day
  ) {
    return parsed.toISOString();
  }

  return undefined;
}

function parseIsoLocalDateTime(value: string): string | undefined {
  const isoLocal = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!isoLocal) return undefined;

  const [, year, month, day, hour, minute, second = "0"] = isoLocal;
  return fromSheetLocalTime(+year, +month, +day, +hour, +minute, +second).toISOString();
}

function parseNativeDate(value: string): string | undefined {
  const parsed = new Date(value);
  if (
    Number.isNaN(parsed.getTime()) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() < 2000 ||
    parsed.getUTCFullYear() > 2100
  ) {
    return undefined;
  }
  return parsed.toISOString();
}

export function tryParseReportDate(value: unknown): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;

  return (
    parseSpreadsheetSerial(trimmed) ||
    parseLocalSlashDate(trimmed) ||
    parseIsoLocalDateTime(trimmed) ||
    parseNativeDate(trimmed)
  );
}

export function parseReportDate(value: unknown): string {
  const parsed = tryParseReportDate(value);
  if (!parsed) {
    throw new Error(`Invalid report date: ${String(value ?? "").trim() || "<empty>"}`);
  }
  return parsed;
}

export function tryParseReportDateWithFallbacks(
  value: unknown,
  ...fallbacks: unknown[]
): string | undefined {
  const primary = tryParseReportDate(value);
  if (primary) return primary;

  for (const fallback of fallbacks) {
    const parsed = tryParseReportDate(fallback);
    if (parsed) return parsed;
  }

  return undefined;
}

export function sanitizeReportDate(value: unknown, ...fallbacks: unknown[]): string {
  return tryParseReportDateWithFallbacks(value, ...fallbacks) ?? new Date().toISOString();
}
