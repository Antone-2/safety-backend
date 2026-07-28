import { logger } from "./logger.js";

export const GOOGLE_SHEETS_TIMEZONE = "America/New_York";

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneDateParts(date: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
    second: lookup("second"),
  };
}

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getTimeZoneDateParts(date, timeZone);
  const zonedTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((zonedTimeAsUtc - date.getTime()) / 60000);
}

export function getSheetTimeZoneOffsetMinutes(date: Date): number {
  return getTimeZoneOffsetMinutes(date, GOOGLE_SHEETS_TIMEZONE);
}

export function getDateOrder(): "dmy" | "mdy" {
  const configured = String(process.env.GOOGLE_SHEETS_DATE_ORDER ?? "mdy").toLowerCase().trim();
  if (configured === "mdy") return "mdy";
  if (configured === "dmy") return "dmy";
  return "mdy";
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
  const localDateTime = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offset = getSheetTimeZoneOffsetMinutes(localDateTime);
  const utc = new Date(localDateTime.getTime() - offset * 60000);
  logger.debug(
    { year, month, day, hour, minute, second, offset, input: `${year}-${month}-${day}T${hour}:${minute}:${second}`, output: utc.toISOString() },
    "report-date.fromSheetLocalTime",
  );
  return utc;
}

export function getSheetLocalDateString(referenceDate: Date = new Date()): string {
  const parts = getTimeZoneDateParts(referenceDate, GOOGLE_SHEETS_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getStartOfSheetDayUtc(
  referenceDate: Date = new Date(),
  dayOffset = 0,
  monthOffset = 0,
): Date {
  const parts = getTimeZoneDateParts(referenceDate, GOOGLE_SHEETS_TIMEZONE);
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1 + monthOffset, parts.day + dayOffset, 0, 0, 0, 0),
  );
  return fromSheetLocalTime(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function getStartOfSheetMonthUtc(
  referenceDate: Date = new Date(),
  monthOffset = 0,
): Date {
  const parts = getTimeZoneDateParts(referenceDate, GOOGLE_SHEETS_TIMEZONE);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + monthOffset, 1, 0, 0, 0, 0));
  return fromSheetLocalTime(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function isReportDateInFuture(
  isoDate: string,
  referenceDate: Date = new Date(),
): boolean {
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return true;
  const reportDate = getSheetLocalDateString(parsed);
  const currentDate = getSheetLocalDateString(referenceDate);
  return reportDate > currentDate;
}

export function assertReportDateIsNotFuture(
  isoDate: string,
  referenceDate: Date = new Date(),
  label = "report date",
): void {
  if (!isReportDateInFuture(isoDate, referenceDate)) return;

  logger.warn(
    {
      label,
      parsedUtc: isoDate,
      parsedLocalDate: getSheetLocalDateString(new Date(isoDate)),
      currentLocalDate: getSheetLocalDateString(referenceDate),
      timezone: GOOGLE_SHEETS_TIMEZONE,
    },
    "report-date.futureDateRejected",
  );
  throw new Error(
    `Invalid ${label}: ${new Date(isoDate).toISOString()} is after the current ${GOOGLE_SHEETS_TIMEZONE} date ${getSheetLocalDateString(referenceDate)}`,
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
  const baseUtc = new Date(excelEpoch + spreadsheetSerial * 86400000);
  const offset = getSheetTimeZoneOffsetMinutes(baseUtc);
  const parsed = new Date(baseUtc.getTime() - offset * 60000);
  logger.debug(
    { spreadsheetSerial, offset, input: value, output: parsed.toISOString() },
    "report-date.parseSpreadsheetSerial",
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
  const dateOrder = getDateOrder();
  const isUnambiguouslyDayFirst = first > 12;
  const isUnambiguouslyMonthFirst = second > 12;
  const monthFirst = isUnambiguouslyMonthFirst || (!isUnambiguouslyDayFirst && dateOrder === "mdy");
  const day = monthFirst ? second : first;
  const month = monthFirst ? first : second;
  let hour = Number(hourRaw || 0);
  const minute = Number(minuteRaw || 0);
  const secondPart = Number(secondPartRaw || 0);
  const meridiem = meridiemRaw?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  const parsed = fromSheetLocalTime(year, month, day, hour, minute, secondPart);
  const offset = getSheetTimeZoneOffsetMinutes(parsed);
  const localCheck = new Date(parsed.getTime() + offset * 60000);
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
  const hasExplicitYear = /\b\d{4}\b/.test(value);
  if (!hasExplicitYear) {
    return undefined;
  }

  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
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

  const localMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):?(\d{2})(?::?(\d{2}))?)?$/);
  if (localMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = localMatch;
    return fromSheetLocalTime(+year, +month, +day, +hour, +minute, +second).toISOString();
  }

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

export function parseValidatedReportDate(
  value: unknown,
  options?: {
    referenceDate?: Date;
    label?: string;
  },
): string {
  const parsed = parseReportDate(value);
  assertReportDateIsNotFuture(
    parsed,
    options?.referenceDate,
    options?.label ?? "report date",
  );
  logger.debug(
    {
      raw: String(value ?? ""),
      parsedUtc: parsed,
      parsedLocalDate: getSheetLocalDateString(new Date(parsed)),
      timezone: GOOGLE_SHEETS_TIMEZONE,
    },
    "report-date.parseValidatedReportDate",
  );
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
  const parsed = tryParseReportDateWithFallbacks(value, ...fallbacks);
  if (!parsed) {
    logger.warn({ rawValue: value, fallbacks }, "report-date.sanitizeReportDate.fallbackToNow");
  }
  return parsed ?? new Date().toISOString();
}
