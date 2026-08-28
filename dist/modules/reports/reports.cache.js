import { cacheService } from "../../shared/infrastructure/redis/cache.service.js";
const REPORTS_CACHE_PREFIX = "reports";
export const REPORTS_LIST_CACHE_TTL_SECONDS = 15;
export const REPORTS_DASHBOARD_CACHE_TTL_SECONDS = 60;
export const REPORTS_DETAIL_CACHE_TTL_SECONDS = 30;
function normalizeValue(value) {
    if (Array.isArray(value))
        return value.map(normalizeValue);
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
            const normalized = normalizeValue(value[key]);
            if (normalized !== undefined && normalized !== "") {
                acc[key] = normalized;
            }
            return acc;
        }, {});
    }
    return value;
}
export function buildReportsCacheKey(scope, payload) {
    return `${REPORTS_CACHE_PREFIX}:${scope}:${JSON.stringify(normalizeValue(payload))}`;
}
export async function invalidateReportsCache() {
    await cacheService.invalidateMany([
        `${REPORTS_CACHE_PREFIX}:list:*`,
        `${REPORTS_CACHE_PREFIX}:stats:*`,
        `${REPORTS_CACHE_PREFIX}:summary:*`,
        `${REPORTS_CACHE_PREFIX}:dashboard:*`,
        `${REPORTS_CACHE_PREFIX}:detail:*`,
        `${REPORTS_CACHE_PREFIX}:top-reporters:*`,
    ]);
}
export function setCachedJsonHeaders(res, ttlSeconds = REPORTS_DASHBOARD_CACHE_TTL_SECONDS) {
    res.setHeader("Cache-Control", `private, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`);
    res.setHeader("Vary", "Authorization");
}
