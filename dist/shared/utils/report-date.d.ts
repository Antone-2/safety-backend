export declare const GOOGLE_SHEETS_TIMEZONE = "Africa/Nairobi";
export declare function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number;
export declare function getSheetTimeZoneOffsetMinutes(date: Date): number;
export declare function getDateOrder(): "dmy" | "mdy";
export declare function getSheetLocalDateString(referenceDate?: Date): string;
export declare function getStartOfSheetDayUtc(referenceDate?: Date, dayOffset?: number, monthOffset?: number): Date;
export declare function getStartOfSheetMonthUtc(referenceDate?: Date, monthOffset?: number): Date;
export declare function tryParseReportDate(value: unknown): string | undefined;
export declare function parseReportDate(value: unknown): string;
export declare function tryParseReportDateWithFallbacks(value: unknown, ...fallbacks: unknown[]): string | undefined;
export declare function sanitizeReportDate(value: unknown, ...fallbacks: unknown[]): string;
export declare function parseValidatedReportDate(value: unknown, options?: {
    referenceDate?: Date;
    label?: string;
}): string;
