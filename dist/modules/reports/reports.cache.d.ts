import type { Response } from "express";
export declare const REPORTS_LIST_CACHE_TTL_SECONDS = 15;
export declare const REPORTS_DASHBOARD_CACHE_TTL_SECONDS = 60;
export declare const REPORTS_DETAIL_CACHE_TTL_SECONDS = 30;
export declare function buildReportsCacheKey(scope: string, payload: Record<string, unknown>): string;
export declare function invalidateReportsCache(): Promise<void>;
export declare function setCachedJsonHeaders(res: Response, ttlSeconds?: number): void;
