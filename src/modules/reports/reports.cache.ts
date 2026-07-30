import type { Response } from "express";
import { cacheService } from "../../shared/infrastructure/redis/cache.service.js";

const REPORTS_CACHE_PREFIX = "reports";
export const REPORTS_LIST_CACHE_TTL_SECONDS = 15;
export const REPORTS_DASHBOARD_CACHE_TTL_SECONDS = 15;
export const REPORTS_DETAIL_CACHE_TTL_SECONDS = 30;

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const normalized = normalizeValue((value as Record<string, unknown>)[key]);
        if (normalized !== undefined && normalized !== "") {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }
  return value;
}

export function buildReportsCacheKey(
  scope: string,
  payload: Record<string, unknown>,
): string {
  return `${REPORTS_CACHE_PREFIX}:${scope}:${JSON.stringify(normalizeValue(payload))}`;
}

export async function invalidateReportsCache(): Promise<void> {
  await cacheService.invalidateMany([
    `${REPORTS_CACHE_PREFIX}:list:*`,
    `${REPORTS_CACHE_PREFIX}:stats:*`,
    `${REPORTS_CACHE_PREFIX}:summary:*`,
    `${REPORTS_CACHE_PREFIX}:dashboard:*`,
    `${REPORTS_CACHE_PREFIX}:detail:*`,
    `${REPORTS_CACHE_PREFIX}:top-reporters:*`,
  ]);
}

export function setCachedJsonHeaders(
  res: Response,
  ttlSeconds = REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
): void {
  res.setHeader(
    "Cache-Control",
    `private, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
  );
  res.setHeader("Vary", "Authorization");
}
