export declare function tryParseReportDate(value: unknown): string | undefined;
export declare function parseReportDate(value: unknown): string;
export declare function tryParseReportDateWithFallbacks(value: unknown, ...fallbacks: unknown[]): string | undefined;
export declare function sanitizeReportDate(value: unknown, ...fallbacks: unknown[]): string;
